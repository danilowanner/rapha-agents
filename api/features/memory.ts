import { randomUUID } from "node:crypto";

import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";
import { formatDateTime } from "../../libs/utils/formatDateTime.ts";
import { formatRelativeTime } from "../../libs/utils/formatRelativeTime.ts";
import { shorten } from "../../libs/utils/shorten.ts";
import { XmlBuilder } from "../../libs/utils/XmlBuilder.ts";
import { createMemoryEntry as dbCreateMemoryEntry, getMemoryEntries, updateCompaction } from "../db/memoryEntry.ts";
import { getOrCreateUser } from "../db/user.ts";

import { compactExchange, TOPIC_MAX_LENGTH } from "./compaction.ts";

const ALL_ENTRIES_COUNT = 100;
const FULL_ENTRIES_COUNT = Math.floor((ALL_ENTRIES_COUNT * 10) / 100);
const CONDENSED_ENTRIES_COUNT = Math.floor((ALL_ENTRIES_COUNT * 40) / 100);
const AGENT_ID = "main";

/**
 * Adds a new memory entry for a user. Triggers async compaction of the exchange.
 * When chatId is omitted (e.g. wordsmith), a UUID is generated per call so the entry is not tied to a conversation.
 */
export function addMemoryEntry(
  userId: string,
  entry: { userMessage: string; agentMessage: string },
  chatId?: string | null,
): void {
  const topic = shorten(entry.userMessage, TOPIC_MAX_LENGTH);
  dbCreateMemoryEntry({
    userId,
    agentId: AGENT_ID,
    chatId: chatId ?? randomUUID(),
    topic,
    userMessage: entry.userMessage,
    agentMessage: entry.agentMessage,
  })
    .then((created) => {
      compactExchange(created.userMessage, created.agentMessage)
        .then((compacted) => updateCompaction(created.id, compacted.topic, compacted.condensed))
        .catch((err) => {
          console.warn(`[MEMORY] Compaction failed:`, getErrorMessage(err));
        });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[MEMORY] Failed to create entry:`, message);
    });
}

/**
 * Gets memory as XML block for injection into system prompt.
 * excludeChatId omits entries from that conversation (avoids duplicating current chat history).
 * Newest 10% of the cap include original messages. Next entries up to 40% include a condensed agent reply. The rest keep the topic only.
 */
export async function getMemoryAsXml(userId: string, options?: { excludeChatId?: string }): Promise<string> {
  const user = await getOrCreateUser(userId);
  const entries = await getMemoryEntries(userId, AGENT_ID, {
    limit: ALL_ENTRIES_COUNT,
    excludeChatId: options?.excludeChatId,
  });
  if (!user.context && entries.length === 0) return "";

  const now = new Date();
  const xml = new XmlBuilder("conversationHistory");
  if (user.context) xml.child("userContext", user.context);
  xml.child("now", `Current date and time: ${formatDateTime()}`);

  const fullStart = Math.max(entries.length - FULL_ENTRIES_COUNT, 0);
  const condensedStart = Math.max(entries.length - CONDENSED_ENTRIES_COUNT, 0);

  entries.reverse().forEach((entry, index) => {
    if (!entry.topic) return;
    const ago = formatRelativeTime(entry.createdAt, now);
    const time = formatDateTime(entry.createdAt);
    const exchangeXml = xml.child("exchange", undefined, { ago, time });
    exchangeXml.child("topic", entry.topic);
    if (index >= fullStart) {
      exchangeXml.child("user", entry.userMessage);
      exchangeXml.child("agent", entry.agentMessage);
      return;
    }
    if (index >= condensedStart && entry.condensedAgentMessage)
      exchangeXml.child("agent", entry.condensedAgentMessage, { condensed: "true" });
  });

  const result = xml.build();
  const condensedCount = entries.filter((entry) => entry.condensedAgentMessage).length;
  console.log(`[MEMORY] ${userId}: ${result.length} chars, ${condensedCount}/${entries.length} condensed/entries`);
  return result;
}

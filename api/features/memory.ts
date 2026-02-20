import { randomUUID } from "node:crypto";

import { formatDateTime } from "../../libs/utils/formatDateTime.ts";
import { formatRelativeTime } from "../../libs/utils/formatRelativeTime.ts";
import { shorten } from "../../libs/utils/shorten.ts";
import { XmlBuilder } from "../../libs/utils/XmlBuilder.ts";
import {
  createMemoryEntry as dbCreateMemoryEntry,
  getMemoryEntries,
  updateCondensed,
  updateTopic,
} from "../db/memoryEntry.ts";
import { getOrCreateUser } from "../db/user.ts";

import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";
import { compactMessage, TOPIC_MAX_LENGTH } from "./compaction.ts";

const RECENT_ENTRIES_COUNT = 10;
const ALL_ENTRIES_COUNT = 100;
const AGENT_ID = "main";

/**
 * Adds a new memory entry for a user. Triggers async condensation.
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
      compactMessage(created.agentMessage, "assistant")
        .then((compacted) =>
          compacted.condensed
            ? updateCondensed(created.id, compacted.condensed, compacted.topic)
            : updateTopic(created.id, compacted.topic),
        )
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

  const recentXml = xml.child("recent");
  const recentStart = Math.max(entries.length - RECENT_ENTRIES_COUNT, 0);

  entries.reverse().forEach((entry, index) => {
    const ago = formatRelativeTime(entry.createdAt, now);
    const time = formatDateTime(entry.createdAt);
    const exchangeXml = recentXml.child("exchange", undefined, { ago, time });
    exchangeXml.child("topic", entry.topic);
    if (index >= recentStart) {
      exchangeXml.child("user", entry.userMessage);
      exchangeXml.child("agent", entry.condensedAgentMessage ?? entry.agentMessage);
    }
  });

  const result = xml.build();
  const condensedCount = entries.filter((e) => e.condensedAgentMessage).length;
  console.debug(result);
  console.log(`[MEMORY] ${userId}: ${result.length} chars, ${condensedCount}/${entries.length} condensed/entries`);
  return result;
}

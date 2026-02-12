import { generateText } from "ai";
import { randomUUID } from "node:crypto";

import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { env } from "../../libs/env.ts";
import { formatDateTime } from "../../libs/utils/formatDateTime.ts";
import { formatRelativeTime } from "../../libs/utils/formatRelativeTime.ts";
import { shorten } from "../../libs/utils/shorten.ts";
import { XmlBuilder } from "../../libs/utils/XmlBuilder.ts";
import { createMemoryEntry as dbCreateMemoryEntry, getMemoryEntries, updateCondensed } from "../db/memoryEntry.ts";

const RECENT_ENTRIES_COUNT = 5;
const TOPIC_MAX_LENGTH = 200;
const AGENT_ID = "main";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

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
      condenseEntry(created.id, created.agentMessage).catch((err) => {
        console.warn(`[MEMORY] Condensation failed:`, err.message);
      });
    })
    .catch((err) => {
      console.warn(`[MEMORY] Failed to create entry:`, err.message);
    });
}

/**
 * Gets memory as XML block for injection into system prompt.
 * excludeChatId omits entries from that conversation (avoids duplicating current chat history).
 */
export async function getMemoryAsXml(userId: string, options?: { excludeChatId?: string }): Promise<string> {
  const entries = await getMemoryEntries(userId, AGENT_ID, { order: "asc", excludeChatId: options?.excludeChatId });
  if (entries.length === 0) return "";

  const recentEntries = entries.slice(-RECENT_ENTRIES_COUNT);
  const now = new Date();

  const xml = new XmlBuilder("conversationHistory");
  const recentXml = xml.child("recent");
  for (const entry of recentEntries) {
    const ago = formatRelativeTime(entry.createdAt, now);
    const time = formatDateTime(entry.createdAt);
    const exchangeXml = recentXml.child("exchange", undefined, { ago, time });
    exchangeXml.child("user", entry.userMessage);
    exchangeXml.child("agent", entry.condensedAgentMessage ?? entry.agentMessage);
  }

  const result = xml.build();
  const condensedCount = entries.filter((e) => e.condensedAgentMessage).length;
  console.debug(result);
  console.log(`[MEMORY] ${userId}: ${result.length} chars, ${condensedCount}/${entries.length} condensed/entries`);
  return result;
}

function condenseEntry(entryId: number, agentMessage: string): Promise<void> {
  if (agentMessage.length < TOPIC_MAX_LENGTH * 2) return Promise.resolve();

  return generateText({
    model: poe("GPT-5-nano"),
    system: `Condense this AI assistant response into two sections separated by a blank line.

TOPIC — one line, no label/prefix. A scannable summary of what the memory contains.
Examples: "Translation to German; benefits of Omega 3 supplements, vegetarian, dosage"
"WhatsApp reply drafted for Danilo's mother, upcoming dinner plans, making lasagna"

BODY — after the blank line, no label/prefix. Key facts, names, numbers, and context needed for follow-up (~100 words).

Output nothing else — no bullet markers, no "Summary:", no "Content:", just the two raw sections.`,
    prompt: agentMessage,
  }).then((result) => {
    const text = result.text.trim();
    const blankLineIdx = text.indexOf("\n\n");
    const topic =
      blankLineIdx === -1 ? shorten(text, TOPIC_MAX_LENGTH) : shorten(text.slice(0, blankLineIdx).trim(), TOPIC_MAX_LENGTH);
    const condensed = blankLineIdx === -1 ? text : text.slice(blankLineIdx + 2).trim();
    return updateCondensed(entryId, condensed, topic);
  });
}

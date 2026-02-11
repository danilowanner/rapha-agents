import { generateText } from "ai";

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
 */
export function addMemoryEntry(userId: string, entry: { userMessage: string; agentMessage: string }): void {
  const topic = shorten(entry.userMessage, TOPIC_MAX_LENGTH);
  dbCreateMemoryEntry({
    userId,
    agentId: AGENT_ID,
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
 */
export async function getMemoryAsXml(userId: string): Promise<string> {
  const entries = await getMemoryEntries(userId, AGENT_ID, { order: "asc" });
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
  console.log(`[MEMORY] ${userId}: ${result.length} chars, ${condensedCount}/${entries.length} condensed/entries`);
  return result;
}

function condenseEntry(entryId: number, agentMessage: string): Promise<void> {
  if (agentMessage.length < TOPIC_MAX_LENGTH * 2) return Promise.resolve();

  return generateText({
    model: poe("GPT-5-nano"),
    system: `Condense this AI assistant response for memory. Use this exact format:
- First line: a short summary of what the condensed memory below contains (e.g. "Translation to German; benefits of Omega 3 supplements, vegetarian, dosage", "WhatsApp reply drafted for Danilo's mother, upcoming dinner plans, making lasagna"). Useful so someone scanning topics can tell which entry to open for full details.
- Following lines: the full condensed content — key facts, names, numbers, and context needed for follow-up (around 100 words total).
Output only those two parts, no other preamble.`,
    prompt: agentMessage,
  }).then((result) => {
    const text = result.text.trim();
    const firstNewline = text.indexOf("\n");
    const topic = firstNewline === -1 ? shorten(text, TOPIC_MAX_LENGTH) : text.slice(0, firstNewline).trim();
    return updateCondensed(entryId, text, topic);
  });
}

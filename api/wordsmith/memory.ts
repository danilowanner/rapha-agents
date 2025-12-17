import { generateText } from "ai";

import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { env } from "../../libs/env.ts";
import { formatDateTime } from "../../libs/utils/formatDateTime.ts";
import { formatRelativeTime } from "../../libs/utils/formatRelativeTime.ts";
import { XmlBuilder } from "../../libs/utils/XmlBuilder.ts";

const RECENT_ENTRIES_COUNT = 5;
const MAX_MEMORY_ENTRIES = 10;
const SUMMARIZE_EVERY_N_ENTRIES = 5;

type UserMemory = {
  entries: MemoryEntry[];
  summary?: string;
};

type MemoryEntry = {
  userMessage: string;
  agentMessage: string;
  condensedAgentMessage?: string;
  timestamp: Date;
};

const memoryStore = new Map<string, UserMemory>();

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

/**
 * Retrieves memory for a specific user.
 */
export const getUserMemory = (userId: string): UserMemory => {
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, { entries: [] });
  }
  return memoryStore.get(userId)!;
};

/**
 * Adds a new memory entry for a user. Triggers async condensation and summarization.
 */
export const addMemoryEntry = (userId: string, entry: { userMessage: string; agentMessage: string }): void => {
  const memory = getUserMemory(userId);

  const newEntry: MemoryEntry = {
    userMessage: entry.userMessage,
    agentMessage: entry.agentMessage,
    timestamp: new Date(),
  };
  memory.entries.push(newEntry);

  condenseEntry(newEntry).catch((err) => {
    console.warn(`[MEMORY] Condensation failed:`, err.message);
  });

  if (memory.entries.length >= MAX_MEMORY_ENTRIES) {
    summarizeMemory(userId).catch((err) => {
      console.warn(`[MEMORY] Summarization failed for ${userId}:`, err.message);
    });
  }
};

/**
 * Gets memory as XML block for injection into system prompt.
 */
export const getMemoryAsXml = (userId: string): string => {
  const memory = getUserMemory(userId);
  if (memory.entries.length === 0 && !memory.summary) return "";

  const recentEntries = memory.entries.slice(-RECENT_ENTRIES_COUNT);
  const now = new Date();

  const xml = new XmlBuilder("conversationHistory");

  if (memory.summary) {
    xml.child("summary", memory.summary);
  }

  if (recentEntries.length > 0) {
    const recentXml = xml.child("recent");
    for (const entry of recentEntries) {
      const ago = formatRelativeTime(entry.timestamp, now);
      const time = formatDateTime(entry.timestamp);
      const exchangeXml = recentXml.child("exchange", undefined, { ago, time });
      exchangeXml.child("user", entry.userMessage);
      exchangeXml.child("agent", entry.condensedAgentMessage ?? entry.agentMessage);
    }
  }

  const result = xml.build();

  const condensedCount = memory.entries.filter((e) => e.condensedAgentMessage).length;
  const summaryText = memory.summary ? "with summary" : "no summary";
  console.log(
    `[MEMORY] ${userId}: ${result.length} chars, ${condensedCount}/${memory.entries.length} condensed/entries, ${summaryText}`
  );

  return result;
};

/**
 * Async condensation of a single entry's agent message.
 */
const condenseEntry = async (entry: MemoryEntry): Promise<void> => {
  if (entry.agentMessage.length < 500) return;

  const result = await generateText({
    model: poe("GPT-5-nano"),
    system: `Condense this AI assistant response to ~100 words while preserving key facts, names, numbers, and context needed for follow-up questions. Output only the condensed version.`,
    prompt: entry.agentMessage,
  });

  entry.condensedAgentMessage = result.text.trim();
};

/**
 * Async summarization of conversation history.
 * Triggers when memory exceeds max entries.
 */
const summarizeMemory = async (userId: string): Promise<void> => {
  const memory = getUserMemory(userId);

  if (memory.entries.length < MAX_MEMORY_ENTRIES) return;

  const conversationText = memory.entries
    .map((entry, idx) => {
      return `## Exchange ${idx + 1}:
User: ${entry.userMessage}
Assistant: ${entry.agentMessage}
`;
    })
    .join("\n\n");

  const previousSummarySection = memory.summary
    ? `\n\nPrevious summary to incorporate and build upon:\n${memory.summary}`
    : "";

  const systemPrompt = `You are analyzing a user's conversation history with an AI writing assistant called Wordsmith.

Extract and summarize:
1. Recent actions taken (translations, replies, formatting, etc.)
2. Recurring user instructions or preferences (tone, style, language preferences)
3. Names, topics, or context that may be referenced in follow-ups
4. Patterns in how the user uses different options

Focus on extractable patterns, NOT verbatim content. Keep it concise.`;

  const userPrompt = `Analyze this conversation history and provide a concise summary:${previousSummarySection}

${conversationText}`;

  const result = await generateText({
    model: poe("GPT-5-nano"),
    system: systemPrompt,
    prompt: userPrompt,
  });

  memory.summary = result.text.trim();
  memory.entries = memory.entries.slice(-SUMMARIZE_EVERY_N_ENTRIES);
};

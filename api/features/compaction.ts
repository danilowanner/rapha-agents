import { extractJsonMiddleware, generateText, Output, wrapLanguageModel } from "ai";
import z from "zod";

import { createPoeChat } from "../../libs/ai/providers/poe-chat.ts";
import { env } from "../../libs/env.ts";
import { XmlBuilder } from "../../libs/utils/XmlBuilder.ts";

const poe = createPoeChat({ apiKey: env.poeApiKey });

const model = wrapLanguageModel({
  model: poe("deepseek-v4.1-flash"),
  middleware: extractJsonMiddleware(),
});

export const TOPIC_MAX_LENGTH = 250;

const COMPACTION_PROMPT = `Write long-term memory for the attached exchange.
Return only raw JSON matching the schema. No markdown, no code blocks, no backticks.
Key order: privateReasoning, topic, condensed.

privateReasoning:
- Write this first. Decide the topic line and whether any facts remain for condensed.
- Do not write the topic or condensed text here. Those are separate keys. All three keys are required. topic and condensed may be null.

topic:
- One line, at most ${TOPIC_MAX_LENGTH} characters. No bullets, no labels, no line breaks.
- What the user asked and what the agent did or decided. Name the subject and the outcome.
- Leave drafts, lists, and specific facts for condensed.
- null if nothing notable, such as a greeting, an ack, or filler.

condensed:
- Shortened agent reply: what is still worth keeping after the topic. Plain prose, no lists.
- Keep the useful remainder: a draft, translation, or corrected text; advice worth reusing; facts, names, numbers, and decisions.
- Skip drafts, reasoning, edit lists, and other in-between steps. Keep the final version. Keep an earlier step only when it holds a fact the final version drops.
- Do NOT repeat the topic! Drop filler, repeated blocks, and pure offers to help more.
- Write condensed only from facts the topic does not already state. If none remain, condensed is null.`;

const compactionSchema = z.object({
  privateReasoning: z
    .string()
    .describe(
      "Decide the topic line and whether any facts remain for condensed. This will be discarded and never shown!",
    ),
  topic: z
    .string()
    .nullable()
    .describe(
      "One line for the exchange: subject and outcome, without the detailed reply. e.g. 'Corrected German status update for Pat'. null if nothing notable.",
    ),
  condensed: z
    .string()
    .nullable()
    .describe(
      "Useful remainder of the agent reply that the topic does not already state. Final version only, unless an earlier step holds a fact the final version drops. Plain prose. null if the topic is enough.",
    ),
});

export type CompactExchangeResult = {
  privateReasoning: string;
  topic: string | null;
  condensed: string | null;
};

/**
 * Builds a topic for the exchange and a condensed agent reply.
 * privateReasoning is scratch space for this call. Do not store it.
 * topic and condensed are null when that part has nothing notable to keep.
 */
export async function compactExchange(userMessage: string, agentMessage: string): Promise<CompactExchangeResult> {
  const exchange = new XmlBuilder("exchange");
  exchange.child("user", userMessage.trim());
  exchange.child("agent", agentMessage.trim());

  const { output } = await generateText({
    model,
    system: exchange.build(),
    output: Output.object({ schema: compactionSchema }),
    prompt: COMPACTION_PROMPT,
  });

  return {
    privateReasoning: output.privateReasoning.trim(),
    topic: normalizeTopic(output.topic),
    condensed: emptyToNull(output.condensed),
  };
}

const normalizeTopic = (value: string | null): string | null => {
  const topic = value?.replace(/\s+/g, " ").trim();
  if (!topic) return null;
  return topic.length <= TOPIC_MAX_LENGTH ? topic : topic.slice(0, TOPIC_MAX_LENGTH);
};

const emptyToNull = (value: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

import { extractJsonMiddleware, generateText, Output, wrapLanguageModel } from "ai";
import z from "zod";

import { createPoeAdapter } from "../../libs/ai/providers/poe-provider.ts";
import { env } from "../../libs/env.ts";

const poe = createPoeAdapter({ apiKey: env.poeApiKey });

const model = wrapLanguageModel({
  model: poe("Claude-Haiku-4.5"),
  middleware: extractJsonMiddleware(),
});

export const TOPIC_MAX_LENGTH = 200;
const TOPIC_AND_CONDENSE_MIN_LENGTH = TOPIC_MAX_LENGTH * 2;

const TOPIC_DESCRIPTION =
  "A scannable summary of what the message contains, e.g. 'Translation to German; benefits of Omega 3 supplements, vegetarian, dosage', 'WhatsApp reply drafted for Danilo's mother, upcoming dinner plans, making lasagna'";
const CONDENSED_DESCRIPTION =
  "Shortened version of the message. Keep key facts, names, numbers, and context needed for follow-up. Remove unnecessary filler text and duplication. Write plain prose, no lists.";

const TOPIC_PROMPT = `Summarize the attached message in one short topic line.
Return only raw JSON matching the schema. No markdown, no code blocks, no backticks. No bullets, no labels, no line breaks in the topic.`;

const TOPIC_AND_CONDENSE_PROMPT = `Summarize and condense the attached message for memory.
Return only raw JSON matching the schema. No markdown, no code blocks, no backticks.

Rules:
- topic: one concise, scannable line.
- condensed: shortened plain prose; keep key facts, names, numbers; remove filler and repetition.`;

const topicSchema = z.object({
  topic: z.string().max(TOPIC_MAX_LENGTH).describe(TOPIC_DESCRIPTION),
});

const topicAndCondensedSchema = z.object({
  topic: z.string().max(TOPIC_MAX_LENGTH).describe(TOPIC_DESCRIPTION),
  condensed: z.string().describe(CONDENSED_DESCRIPTION),
});

export type CompactMessageResult = {
  topic: string;
  condensed?: string;
};

export async function compactMessage(message: string, from: "user" | "assistant"): Promise<CompactMessageResult> {
  const trimmedMessage = message.trim();
  if (trimmedMessage.length <= TOPIC_MAX_LENGTH) return { topic: trimmedMessage };

  if (trimmedMessage.length < TOPIC_AND_CONDENSE_MIN_LENGTH) {
    const { output } = await generateText({
      model,
      system: `<attached_message from="${from}">${trimmedMessage}</attached_message>`,
      output: Output.object({ schema: topicSchema }),
      prompt: TOPIC_PROMPT,
    });
    return { topic: output.topic };
  }

  const { output } = await generateText({
    model,
    system: `<attached_message from="${from}">${trimmedMessage}</attached_message>`,
    output: Output.object({ schema: topicAndCondensedSchema }),
    prompt: TOPIC_AND_CONDENSE_PROMPT,
  });
  return output;
}

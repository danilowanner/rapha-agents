import { extractJsonMiddleware, generateText, Output, wrapLanguageModel } from "ai";
import z from "zod";

import { createPoeChat } from "../../../libs/ai/providers/poe-chat.ts";
import { env } from "../../../libs/env.ts";
import { formatRecentMessages, type RecentMessage } from "./recentMessages.ts";

const poe = createPoeChat({ apiKey: env.poeApiKey });
const judgeModel = wrapLanguageModel({
  model: poe("deepseek-v4.1-flash"),
  middleware: extractJsonMiddleware(),
});

const judgeTimeoutMs = 15_000;
const judgeSchema = z.object({
  addressBot: z.boolean().describe("True only when the latest message is meant for the bot"),
});
const judgePrompt = `Decide if the latest message in a family Telegram group is meant for MooBot.
MooBot is the science, games, and technology buddy in the chat.
The message with latest="true" is the one to judge. Earlier messages are context only.

addressBot true when that message asks MooBot something, continues a thread with MooBot, or clearly wants MooBot to answer.
A short follow-up after MooBot spoke, such as "and what about Mars?", is true.

addressBot false when people are talking to each other, the message is chatter, or it replies to someone else and is not clearly also for MooBot.
Unsure means false.`;

/**
 * Mention or a reply to the bot always counts. Other lines go through the judge.
 * Judge failure means the bot stays silent.
 */
export async function shouldAddressBot(recent: RecentMessage[]): Promise<boolean> {
  const latest = recent.at(-1);
  if (!latest || latest.fromBot) return false;
  if (latest.mentionedBot || latest.replyToBot) return true;
  if (!latest.text.trim() || isShortReaction(latest.text)) return false;

  try {
    const { output } = await generateText({
      model: judgeModel,
      system: judgePrompt,
      prompt: formatRecentMessages(recent, { markLatest: true }),
      output: Output.object({ schema: judgeSchema }),
      timeout: judgeTimeoutMs,
      maxRetries: 0,
    });
    console.log(`[FAMILY CHAT BOT] Judge addressBot=${output.addressBot} from=${latest.senderName}`);
    return output.addressBot;
  } catch (error) {
    console.error("[FAMILY CHAT BOT] Judge failed:", error);
    return false;
  }
}

const isShortReaction = (text: string): boolean => {
  const normalized = text.trim().toLowerCase().replace(/[!?.]+$/g, "");
  return /^(ok|okay|lol+|ha(ha)+)$/.test(normalized);
};

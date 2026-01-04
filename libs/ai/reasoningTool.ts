import { tool } from "ai";
import z from "zod";
import { telegramBot } from "../utils/telegram.ts";

export const reasoning = z.object({
  title: z.string().max(120).describe("The title of the reasoning step (max 120 characters)"),
  details: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "Detailed internal reasoning or chain-of-thought style notes. Use markdown. WRITE OUT ALL OF YOUR WORK. Remains internal and not exposed to end users."
    ),
});

export type Reasoning = z.infer<typeof reasoning>;
type Handler = (reasoning: Reasoning) => Promise<void>;

export const reasoningTool = (handler: Handler | null, chatId?: string) =>
  tool({
    description: `Add a step to the reasoning process. Use BEFORE other tools to outline approach.
    Use tool for updates when significant changes occur or if unclear about next steps. NEVER duplicate prior reasoning.`,
    inputSchema: reasoning,
    execute: async ({ title, details }) => {
      try {
        await handler?.({ title, details });
        if (chatId) {
          telegramBot.api.sendMessage(chatId, `*${title}*\n🤔Thinking...`, { parse_mode: "Markdown" });
        }
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

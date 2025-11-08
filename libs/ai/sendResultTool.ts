import { tool } from "ai";
import { InputFile } from "grammy";
import z from "zod";
import { telegramBot } from "../../carousell/utils/telegram.ts";

export const result = z.object({
  userMessage: z.string().min(1).max(4000).describe("The message to be sent to the user."),
  resultClipboard: z
    .string()
    .max(4000)
    .optional()
    .describe("A composed text snippet to be copied to the user's clipboard for easy access."),
});

export type Result = z.infer<typeof result>;
type Handler = (result: Result) => Promise<void>;

export const sendResult = (handler: Handler, chatId: string | undefined) =>
  tool({
    description: `Send a message to the user. Keep the message relevant and to the point. Optionally provide a text snippet that the user can easily copy to their clipboard.`,
    inputSchema: result,
    execute: async ({ resultClipboard, userMessage }) => {
      try {
        const clipboardFile = resultClipboard
          ? new InputFile(Buffer.from(resultClipboard, "utf-8"), "clipboard.txt")
          : undefined;
        await handler({ resultClipboard, userMessage });
        if (chatId) {
          await telegramBot.api.sendMessage(chatId, userMessage);
          if (clipboardFile) await telegramBot.api.sendDocument(chatId, clipboardFile);
        }
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

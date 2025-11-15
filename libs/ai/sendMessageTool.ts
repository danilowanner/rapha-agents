import { tool } from "ai";
import z from "zod";
import { telegramBot } from "../../carousell/utils/telegram.ts";

export const message = z.object({
  userMessage: z.string().min(1).max(2000).describe("The message to be sent to the user."),
});

export type Message = z.infer<typeof message>;
type Handler = (message: Message) => Promise<void>;

export const sendMessage = (handler: Handler, chatId?: string) =>
  tool({
    description: `Send a message to the user. Keep the user up to date on what you are doing. Keep the message relevant and to the point. `,
    inputSchema: message,
    execute: async ({ userMessage }) => {
      try {
        await handler({ userMessage });
        if (chatId) telegramBot.api.sendMessage(chatId, userMessage);
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

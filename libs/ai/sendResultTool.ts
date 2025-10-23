import { tool } from "ai";
import z from "zod";

export const result = z.object({
  userMessage: z.string().min(1).max(2000).describe("The message to be sent to the user."),
  resultClipboard: z
    .string()
    .max(2000)
    .optional()
    .describe("A composed text snippet to be copied to the user's clipboard for easy access."),
});

export type Result = z.infer<typeof result>;

export const sendResult = (handler: (result: Result) => Promise<void>) =>
  tool({
    description: `Send a message to the user. Keep the message relevant and to the point. Optionally provide a text snippet that the user can easily copy to their clipboard.`,
    inputSchema: result,
    execute: async ({ resultClipboard, userMessage }) => {
      try {
        await handler({ resultClipboard, userMessage });
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

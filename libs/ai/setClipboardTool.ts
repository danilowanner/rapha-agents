import { tool } from "ai";
import z from "zod";

const setClipboardInput = z.object({
  content: z.string().min(1).max(50000).describe("Reusable text snippet for the user's clipboard."),
});

export const setClipboardToolName = "setClipboard";

type SetClipboardInput = z.infer<typeof setClipboardInput>;
type Handler = (input: SetClipboardInput) => boolean;

/**
 * Tool for attaching reusable text content to a response clipboard.
 */
export const setClipboard = (handler: Handler) =>
  tool({
    description: "Attach reusable text content to the response clipboard.",
    inputSchema: setClipboardInput,
    execute: async (input) => {
      const success = handler(input);
      return { success } as const;
    },
  });

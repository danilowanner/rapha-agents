import { tool } from "ai";
import z from "zod";

const submitFilenameInput = z.object({
  filename: z
    .string()
    .min(1)
    .max(120)
    .describe("Filename without extension in format: YYYY-MM-DD Title"),
});

export const submitFilenameToolName = "submitFilename";

type SubmitFilenameInput = z.infer<typeof submitFilenameInput>;
type Handler = (input: SubmitFilenameInput) => void;

/**
 * Tool for submitting the final generated filename after reasoning.
 */
export const submitFilename = (handler: Handler) =>
  tool({
    description: `Submit the final filename after analyzing the document. Call this AFTER reasoning. Do not include the file extension.`,
    inputSchema: submitFilenameInput,
    execute: async (input) => {
      handler(input);
      return { success: true, done: true, filename: input.filename } as const;
    },
  });

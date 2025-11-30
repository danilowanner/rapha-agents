import { tool } from "ai";
import z from "zod";

const finishTaskInput = z.object({
  summary: z.string().optional().describe("Optional brief summary of what was accomplished"),
});

/**
 * Tool for explicitly signaling task completion.
 * When called, indicates the AI has finished its work and should stop.
 */
export const finishTask = tool({
  description: `Call this tool when you have completed your task and have nothing more to add. This signals that you are done and the conversation should end.`,
  inputSchema: finishTaskInput,
  execute: async (input) => {
    return { done: true, summary: input.summary } as const;
  },
});

import z from "zod";
import { scheduleExecutionIn } from "./scheduleExecutionIn.ts";

export const task = z.object({
  task: z.string().describe("The instructions of the task."),
  url: z.string().optional().describe("The URL of the page to perform the task on."),
  scheduleExecutionIn,
});

export type Task = z.infer<typeof task>;

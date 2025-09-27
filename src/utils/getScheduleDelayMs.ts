import type { Task } from "../schemas/task.ts";

export function getScheduleDelayMs(scheduleExecutionIn: Task["scheduleExecutionIn"]): number {
  const { minutes = 0, hours = 0, days = 0 } = scheduleExecutionIn ?? {};
  return minutes * 60000 + hours * 3600000 + days * 86400000;
}

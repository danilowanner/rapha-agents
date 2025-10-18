import { addSystemTask } from "../scheduler.ts";
import type { ScheduleExecutionIn } from "../schemas/scheduleExecutionIn.ts";
import { getScheduleDelayMs } from "./getScheduleDelayMs.ts";

export type SystemTaskSpec = {
  name: string;
  action: () => Promise<void>;
  scheduleExecutionIn: ScheduleExecutionIn;
  retries?: number; // retry attempts (default 1)
};

/**
 * Helper to enqueue a system task using a relative delay specification.
 */
export function scheduleSystemTask(spec: SystemTaskSpec) {
  const retries = spec.retries ?? 2;
  addSystemTask({
    name: spec.name,
    action: spec.action,
    scheduledTimestamp: Date.now() + getScheduleDelayMs(spec.scheduleExecutionIn),
    retry:
      retries > 0
        ? {
            remaining: retries,
            attempt: 1,
            backoffMinutes: 1,
          }
        : undefined,
  });
}

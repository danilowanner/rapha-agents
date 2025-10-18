import z from "zod";

export const scheduleExecutionIn = z.object({
  minutes: z.number().optional(),
  hours: z.number().optional(),
  days: z.number().optional(),
});

export type ScheduleExecutionIn = z.infer<typeof scheduleExecutionIn>;

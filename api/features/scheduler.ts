type Schedule = {
  minutes?: number;
  hours?: number;
  days?: number;
};

type CronTask = {
  name: string;
  schedule: Schedule;
  handler: () => void | Promise<void>;
  nextRun: Date;
};

const tasks: CronTask[] = [];
let intervalId: NodeJS.Timeout | null = null;

/**
 * Register a new scheduled task
 */
export const registerTask = (name: string, schedule: Schedule, handler: () => void | Promise<void>): void => {
  const nextRun = calculateNextRun(schedule);
  tasks.push({ name, schedule, handler, nextRun });
  console.log(`Registered task: ${name} - Next run: ${nextRun.toISOString()}`);
};

/**
 * Start the scheduler
 */
export const startScheduler = (): void => {
  if (intervalId) {
    console.log("Scheduler already running");
    return;
  }

  console.log("Starting scheduler...");
  intervalId = setInterval(() => {
    executeDueTasks().catch((error) => {
      console.error("Error executing tasks:", error);
    });
  }, 1000);

  executeDueTasks().catch((error) => {
    console.error("Error executing initial tasks:", error);
  });
};

/**
 * Stop the scheduler
 */
export const stopScheduler = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Scheduler stopped");
  }
};

/**
 * Get all registered tasks
 */
export const getTasks = (): ReadonlyArray<Readonly<CronTask>> => {
  return tasks;
};

const calculateNextRun = (schedule: Schedule): Date => {
  const now = Date.now();
  const { minutes = 0, hours = 0, days = 0 } = schedule;
  const delayMs = (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000;
  return new Date(now + delayMs);
};

const executeDueTasks = async (): Promise<void> => {
  const now = new Date();

  for (const task of tasks) {
    if (task.nextRun > now) {
      continue;
    }

    console.log(`Executing task: ${task.name}`);
    try {
      await task.handler();
      task.nextRun = calculateNextRun(task.schedule);
      console.log(`Task ${task.name} completed. Next run: ${task.nextRun.toISOString()}`);
    } catch (error) {
      console.error(`Task ${task.name} failed:`, error);
      task.nextRun = calculateNextRun(task.schedule);
    }
  }
};

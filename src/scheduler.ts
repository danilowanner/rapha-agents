import { logger } from "./log.ts";

const log = logger("SCHEDULER");

const pollingIntervalMs = 60_000; // 1 minute
let timer: NodeJS.Timeout | undefined = undefined;
const tasks: Array<Task> = [];

type Task = {
  schedule: "startup" | "every minute" | "every 5 minutes" | "hourly";
  action: () => Promise<void>;
};

// @todo Make sure the scheduler does not run multiple tasks concurrently

export function start(newTasks: Array<Task>) {
  tasks.push(...newTasks);
  tasks.filter((t) => t.schedule === "startup").forEach((t) => t.action().catch((e) => log.error(e)));
  if (timer) return;
  timer = setInterval(() => loop().catch((e) => console.error(e)), pollingIntervalMs);
}

export function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

async function loop() {
  try {
    const now = new Date();
    for (const task of tasks) {
      switch (task.schedule) {
        case "every minute":
          log.info("Running task...");
          await task.action();
          break;
        case "every 5 minutes":
          if (now.getMinutes() % 5 === 0) {
            log.info("Running 5 minute task...");
            await task.action();
          }
          break;
        case "hourly":
          if (now.getMinutes() === 0) {
            log.info("Running 'hourly' task...");
            await task.action();
          }
          break;
      }
    }
  } catch (e) {
    log.error("Loop error:", e);
  }
}

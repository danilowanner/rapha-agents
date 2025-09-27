import { agent } from "./agent.ts";
import { db } from "./db.ts";
import { logger } from "./log.ts";

const log = logger("SCHEDULER");

let timer: NodeJS.Timeout | undefined = undefined;

type SystemTask = {
  name: string;
  scheduledTimestamp: number;
  action: () => Promise<void>;
};

const taskQueue = new Set<SystemTask>();
let processing = false;

export function start() {
  if (timer) return;
  timer = setInterval(() => processQueue().catch((e) => console.error(e)), 1_000);
  log.info("Scheduler started");
}

export function addSystemTask(task: SystemTask) {
  taskQueue.add(task);
}

export function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    const now = Date.now();
    const combined = [
      ...[...taskQueue].map((t) => ({ source: "system" as const, task: t })),
      ...db.getTasks().map((t) => ({ source: "db" as const, task: t })),
    ];

    const due = combined.filter((c) => c.task.scheduledTimestamp <= now);
    if (due.length === 0) return;

    due.sort((a, b) => a.task.scheduledTimestamp - b.task.scheduledTimestamp);
    const next = due[0];

    if (next.source === "system") {
      taskQueue.delete(next.task);
      log.info(`Running scheduled system task: ${next.task.name}`);
      await next.task.action();
      log.info(`Completed task: ${next.task.name}`);
    } else {
      log.info("Running scheduled DB task:");
      log.info(next.task.task);
      await agent.handleTask(next.task);
      await db.removeTask(next.task);
      log.info("Completed DB task.");
    }
  } catch (e) {
    log.error("Task error:", e);
  } finally {
    processing = false;
  }
}

import { env } from "../libs/env.ts";
import { telegramBot } from "../libs/utils/telegram.ts";
import { startFamilyChatBot, stopFamilyChatBot } from "./features/familyChatBot.ts";
import { startScheduler, stopScheduler } from "./features/scheduler.ts";

let started = false;
let stopping: Promise<void> | null = null;

/** Starts long-lived API background services once per Node process. */
export function startApiProcess(): void {
  if (started) return;
  started = true;

  if (env.telegramFamilyBotToken) startFamilyChatBot(env.telegramFamilyBotToken);
  else console.warn("Warning: Family Telegram bot not configured, skipping start");
  startScheduler();
}

/** Stops long-lived API background services once. */
export function stopApiProcess(): Promise<void> {
  stopping ??= stopServices();
  return stopping;
}

async function stopServices(): Promise<void> {
  stopScheduler();
  await Promise.all([
    stopFamilyChatBot().then(() => console.log("Family Telegram bot stopped")),
    telegramBot.stop().then(() => console.log("Telegram bot stopped")),
  ]);
}

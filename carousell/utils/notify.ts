import { execFile } from "node:child_process";
import { shorten } from "../../libs/utils/shorten.ts";
import { telegramBot } from "./telegram.ts";

const MAX_LENGTH = 600;

export async function notify(message?: string, maxLength = MAX_LENGTH): Promise<void> {
  if (!message) return;
  await Promise.all([runNotifyShortcut(message, maxLength), runTelegramNotify(message, maxLength)]);
}

/**
 * Runs the "Agent Notify" macOS Shortcut passing string input.
 */
export function runNotifyShortcut(message: string, maxLength = MAX_LENGTH): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args = ["run", "Agent Notify"];
      const child = execFile("shortcuts", args, (err, _stdout, _stderr) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
      const truncated = shorten(message, maxLength);
      child.stdin?.write(truncated + "\n", "utf8");
      child.stdin?.end();
    } catch (err) {
      console.error("Error occurred while running notify shortcut:", err);
    }
  });
}

export async function runTelegramNotify(message: string, maxLength = MAX_LENGTH): Promise<void> {
  const daniloChatId = "30318273";
  await telegramBot.api.sendMessage(daniloChatId, shorten(message, maxLength));
}

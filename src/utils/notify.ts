import { execFile } from "node:child_process";
import { telegramBot } from "./telegram.ts";

const MAX_LENGTH = 600;

export async function notify(message?: string): Promise<void> {
  if (!message) return;
  await Promise.all([runNotifyShortcut(message), runTelegramNotify(message)]);
}

/**
 * Runs the "Agent Notify" macOS Shortcut passing string input.
 */
export function runNotifyShortcut(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args = ["run", "Agent Notify"];
      const child = execFile("shortcuts", args, (err, _stdout, _stderr) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
      const truncated = shorten(message);
      child.stdin?.write(truncated + "\n", "utf8");
      child.stdin?.end();
    } catch (err) {
      console.error("Error occurred while running notify shortcut:", err);
    }
  });
}

export async function runTelegramNotify(message: string): Promise<void> {
  const daniloChatId = "30318273";
  await telegramBot.api.sendMessage(daniloChatId, shorten(message));
}

function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const sliceLen = MAX_LENGTH - 2;
  return text.slice(0, sliceLen).trimEnd() + "…";
}

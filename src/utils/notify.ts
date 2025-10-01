import { execFile } from "node:child_process";

const MAX_SHORTCUT_INPUT = 600;

/**
 * Shows a macOS user notification via AppleScript.
 */
export function notifyMac({ title = "Agent", body, subtitle }: { title?: string; body: string; subtitle?: string }) {
  return new Promise<void>((res, rej) =>
    execFile(
      "osascript",
      [
        "-e",
        `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)} subtitle ${JSON.stringify(
          subtitle || ""
        )}`,
      ],
      (e) => (e ? rej(e) : res())
    )
  );
}

/**
 * Sends an iMessage using the Messages app AppleScript interface.
 */
export function imessage({ handle, text }: { handle: string; text: string }) {
  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type is iMessage
      send ${JSON.stringify(text)} to buddy ${JSON.stringify(handle)} of targetService
    end tell`;
  return new Promise<void>((res, rej) => execFile("osascript", ["-e", script], (e) => (e ? rej(e) : res())));
}

/**
 * Runs the "Agent Notify" macOS Shortcut optionally passing string input.
 */
export function runNotifyShortcut(input?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args = ["run", "Agent Notify"];
      const child = execFile("shortcuts", args, (err, _stdout, _stderr) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
      if (input != null) {
        const truncated = shortenForShortcut(input);
        child.stdin?.write(truncated + "\n", "utf8");
        child.stdin?.end();
      }
    } catch (err) {
      console.error("Error occurred while running notify shortcut:", err);
    }
  });
}

function shortenForShortcut(text: string): string {
  if (text.length <= MAX_SHORTCUT_INPUT) return text;
  const sliceLen = MAX_SHORTCUT_INPUT - 2;
  return text.slice(0, sliceLen).trimEnd() + "…";
}

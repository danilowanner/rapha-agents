import { env } from "../../../libs/env.ts";
import { getErrorMessage } from "../../../libs/utils/getErrorMessage.ts";
import { markdownToTelegramHtml } from "../../../libs/utils/markdownToTelegramHtml.ts";
import { telegramBot } from "../../../libs/utils/telegram.ts";
import { onResponseRemoved } from "./state.ts";

/** 36 hours */
const LINK_TTL_MS = 36 * 60 * 60 * 1000;

type TrackedLink = {
  chatId: number | string;
  messageId: number;
  timer: ReturnType<typeof setTimeout>;
};

const links = new Map<string, TrackedLink>();
let stopping = false;

onResponseRemoved((id) => {
  if (stopping) return;
  void deleteTrackedLink(id);
});

/**
 * Sends the response view link. Deletes that Telegram message after 36 hours, when the response leaves the cache, or on shutdown.
 */
export async function sendTelegramResponseLink(chatId: number | string, responseId: string): Promise<void> {
  if (!chatId || stopping || links.has(responseId)) return;

  try {
    const message = await telegramBot.api.sendMessage(
      chatId,
      markdownToTelegramHtml(`${env.baseUrl}/responses/view/${responseId}`),
      { parse_mode: "HTML" },
    );

    console.log("[RESPONSES/TELEGRAM]", responseId, "link");
    const timer = setTimeout(() => {
      void deleteTrackedLink(responseId);
    }, LINK_TTL_MS);
    links.set(responseId, { chatId, messageId: message.message_id, timer });
  } catch (error) {
    console.debug(error);
    console.error("[RESPONSES/TELEGRAM] Failed to send link:", getErrorMessage(error));
  }
}

/**
 * Deletes every tracked response link and clears its timer.
 */
export function stopTelegramResponseLinks(): Promise<void> {
  if (stopping) return Promise.resolve();
  stopping = true;
  return deleteAllTrackedLinks();
}

async function deleteAllTrackedLinks(): Promise<void> {
  const pending = [...links.values()];
  links.clear();
  pending.forEach((link) => clearTimeout(link.timer));
  if (pending.length === 0) return;
  console.log("[RESPONSES/TELEGRAM] Deleting", pending.length, "response links");
  await Promise.all(pending.map((link) => deleteTelegramMessage(link.chatId, link.messageId)));
}

async function deleteTrackedLink(responseId: string): Promise<void> {
  const link = links.get(responseId);
  if (!link) return;
  links.delete(responseId);
  clearTimeout(link.timer);
  await deleteTelegramMessage(link.chatId, link.messageId);
}

async function deleteTelegramMessage(chatId: number | string, messageId: number): Promise<void> {
  try {
    await telegramBot.api.deleteMessage(chatId, messageId);
  } catch (error) {
    console.error("[RESPONSES/TELEGRAM] Failed to delete link:", getErrorMessage(error));
  }
}

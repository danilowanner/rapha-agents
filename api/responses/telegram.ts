import { InputFile } from "grammy";

import { env } from "../../libs/env.ts";
import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";
import { markdownToTelegramHtml } from "../../libs/utils/markdownToTelegramHtml.ts";
import { shorten } from "../../libs/utils/shorten.ts";
import { telegramBot } from "../../libs/utils/telegram.ts";
import { getResponseResult } from "./state.ts";

export async function sendTelegramResponseFile(chatId: number | string, responseId: string): Promise<void> {
  const file = await getResponseResult(responseId);
  if (!file || !chatId) return;

  const fileName = file.name;
  const content = file.result;
  const caption = file.description ?? shorten(content, 30);
  console.log("[RESPONSES/TELEGRAM]", responseId, fileName);

  try {
    await telegramBot.api.sendMessage(chatId, markdownToTelegramHtml(`${env.baseUrl}/responses/view/${responseId}`), {
      parse_mode: "HTML",
    });
    await telegramBot.api.sendDocument(chatId, new InputFile(Buffer.from(content, "utf-8"), fileName), {
      caption: markdownToTelegramHtml(caption),
      parse_mode: "HTML",
    });
  } catch (error) {
    console.debug(error);
    console.error("[RESPONSES/TELEGRAM] Failed to send:", getErrorMessage(error));
  }
}

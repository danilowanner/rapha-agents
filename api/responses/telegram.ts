import { InputFile } from "grammy";

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

  telegramBot.api
    .sendDocument(chatId, new InputFile(Buffer.from(content, "utf-8"), fileName), {
      caption: markdownToTelegramHtml(caption),
      parse_mode: "HTML",
    })
    .catch((e) => console.error("Telegram error:", e));
}

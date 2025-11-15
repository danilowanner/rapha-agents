import { env } from "../../libs/env.ts";

import { Bot } from "grammy";
import { logger } from "../log.ts";

const log = logger("TELEGRAM");

export const telegramBot = new Bot(env.telegramBotToken);

telegramBot.command("start", (ctx) => {
  const chatId = ctx.chat.id;
  ctx.reply(`Welcome! Your unique chat ID is: ${chatId}`);
  log.info("User started bot", JSON.stringify({ chatId, username: ctx.from?.username }));
});

telegramBot.start();

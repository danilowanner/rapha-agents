import { env } from "../env.ts";

import { Bot } from "grammy";

export const telegramBot = new Bot(env.telegramBotToken);

telegramBot.command("start", (ctx) => {
  const chatId = ctx.chat.id;
  ctx.reply(`Welcome! Your unique chat ID is: ${chatId}`);
});

telegramBot.start();

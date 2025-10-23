import { env } from "../../libs/env.ts";

import { Bot } from "grammy";
import { agent } from "../agent.ts";
import { logger } from "../log.ts";

const log = logger("TELEGRAM");

export const telegramBot = new Bot(env.telegramBotToken);
telegramBot.start();

telegramBot.on("message", ({ message }) => {
  const { from, text } = message;
  if (from.username !== "danilowanner") return;
  if (!text) return;

  log.info(`Received: ${text}`);
  agent.handleDanilosMessage(text);
});

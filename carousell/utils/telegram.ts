import { env } from "../../libs/env.ts";

import { Bot } from "grammy";
import { logger } from "../log.ts";

const log = logger("TELEGRAM");

export const telegramBot = new Bot(env.telegramBotToken);
telegramBot.start();

import "dotenv/config";
import z from "zod";

export const env = {
  get poeApiKey() {
    return z.string().min(1, "POE_API_KEY is required").parse(process.env.POE_API_KEY);
  },
  get telegramBotToken() {
    return z.string().min(1, "TELEGRAM_BOT_TOKEN is required").parse(process.env.TELEGRAM_BOT_TOKEN);
  },
  get apiKey() {
    return z.string().min(1, "API_KEY is required").parse(process.env.API_KEY);
  },
  get port() {
    return z.string().default("3000").parse(process.env.PORT);
  },
  get youtubeCookie() {
    return z.string().optional().parse(process.env.YOUTUBE_COOKIE);
  },
};

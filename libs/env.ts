import "dotenv/config";
import z from "zod";

export const env = {
  get baseUrl() {
    return z.url("BASE_URL must be a valid URL").parse(process.env.BASE_URL);
  },
  get poeApiKey() {
    return z.string().min(1, "POE_API_KEY is required").parse(process.env.POE_API_KEY);
  },
  get telegramBotToken() {
    return z.string().min(1, "TELEGRAM_BOT_TOKEN is required").parse(process.env.TELEGRAM_BOT_TOKEN);
  },
  get telegramFamilyBotToken() {
    return z.string().min(1, "TELEGRAM_FAMILY_BOT_TOKEN is required").parse(process.env.TELEGRAM_FAMILY_BOT_TOKEN);
  },
  get telegramFamilyBotAllowedChatIds() {
    return z
      .string()
      .default("")
      .parse(process.env.TELEGRAM_FAMILY_BOT_ALLOWED_CHAT_IDS)
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
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
  get oxylabsUsername() {
    return z.string().optional().parse(process.env.OXYLABS_USERNAME);
  },
  get oxylabsPassword() {
    return z.string().optional().parse(process.env.OXYLABS_PASSWORD);
  },
  get braveSearchApiKey() {
    return z.string().min(1, "BRAVE_SEARCH_API_KEY is required").parse(process.env.BRAVE_SEARCH_API_KEY);
  },
  get databaseUrl() {
    return z.string().min(1, "DATABASE_URL is required").parse(process.env.DATABASE_URL);
  },
};

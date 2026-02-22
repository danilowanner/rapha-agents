import "dotenv/config";
import z from "zod";

export const env = {
  get baseUrl() {
    return z.url("BASE_URL must be a valid URL").parse(process.env.BASE_URL);
  },
  get poeApiKey() {
    return z
      .string({ error: "POE_API_KEY is required" })
      .min(1, "POE_API_KEY is required")
      .parse(process.env.POE_API_KEY);
  },
  get telegramBotToken() {
    const error = "TELEGRAM_BOT_TOKEN is required";
    return z.string({ error }).min(1, { error }).parse(process.env.TELEGRAM_BOT_TOKEN);
  },
  get telegramFamilyBotToken() {
    const error = "TELEGRAM_FAMILY_BOT_TOKEN is required";
    return z.string({ error }).min(1, { error }).parse(process.env.TELEGRAM_FAMILY_BOT_TOKEN);
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
    const error = "API_KEY is required";
    return z.string({ error }).min(1, { error }).parse(process.env.API_KEY);
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
    const error = "BRAVE_SEARCH_API_KEY is required";
    return z.string({ error }).min(1, { error }).parse(process.env.BRAVE_SEARCH_API_KEY);
  },
  get databaseUrl() {
    const error = "DATABASE_URL is required";
    return z.string({ error }).min(1, { error }).parse(process.env.DATABASE_URL);
  },
};

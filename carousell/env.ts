export function getEnv() {
  const poeApiKey = process.env.POE_API_KEY;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!poeApiKey) throw new Error("POE_API_KEY is required");
  if (!telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is required");

  return {
    poeApiKey,
    telegramBotToken,
  };
}

export function getEnv() {
  const poeApiKey = process.env.POE_API_KEY;
  if (!poeApiKey) throw new Error("POE_API_KEY is required");

  return {
    poeApiKey,
  };
}

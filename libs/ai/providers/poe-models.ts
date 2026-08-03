export const POE_BASE_URL = "https://api.poe.com/v1";

export type PoeModelId =
  | "gpt-5.2-instant"
  | "gpt-5.2-pro"
  | "gpt-5.2"
  | "gpt-5.4-nano"
  | "gemini-3-flash"
  | "gemini-3.1-flash-lite"
  | "gemini-3.5-flash"
  | "gemini-3-pro"
  | "claude-opus-4.7"
  | "claude-opus-4.6"
  | "claude-sonnet-4.6"
  | "claude-haiku-4.5"
  | "grok-4"
  | "deepseek-v4-flash-e"
  | "kimi-k2.6";

export type PoeOptions = {
  apiKey: string;
};

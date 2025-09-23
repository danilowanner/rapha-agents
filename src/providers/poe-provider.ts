import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type ModelId =
  | "Assistant"
  | "App-Creator"
  | "GPT-5-Chat"
  | "GPT-5"
  | "GPT-5-mini"
  | "GPT-5-nano"
  | "GPT-4o"
  | "GPT-4o-Mini"
  | "Gemini-2.5-Flash-Image"
  | "Gemini-2.5-Flash"
  | "Gemini-2.5-Flash-Lite"
  | "Gemini-2.5-Pro"
  | "Gemini-2.5-Mini"
  | "Claude-Sonnet-4"
  | "Claude-Opus-4.1"
  | "Grok-4-Fast-Reasoning"
  | "Grok-4-Fast-Non-Reasoning"
  | "Grok-4"
  | "o3-pro"
  | "Seedream-4.0"
  | "Web-Search"
  | "FLUX-schnell";

export function createPoeAdapter(options: { apiKey: string }) {
  return createOpenAICompatible<ModelId, string, string, string>({
    name: "poe",
    baseURL: "https://api.poe.com/v1",
    apiKey: options.apiKey,
  }).chatModel;
}

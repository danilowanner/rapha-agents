import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type ModelId =
  | "GPT-5-Chat"
  | "GPT-5" // ✅ tool calling
  | "GPT-5-mini"
  | "GPT-5-nano"
  | "GPT-5-Codex" // ✅ tool calling
  | "GPT-4o"
  | "GPT-4o-Mini"
  | "o3-pro"
  | "o4-mini"
  | "Gemini-2.5-Flash-Image"
  | "Gemini-2.5-Flash" // ❌ tool calling
  | "Gemini-2.5-Flash-Lite"
  | "Gemini-2.5-Pro"
  | "Gemini-2.5-Mini"
  | "Gemini-3.0-Pro"
  | "Claude-Sonnet-4" // ✅ tool calling
  | "Claude-Sonnet-4-Reasoning"
  | "Claude-Opus-4.1" // ✅ tool calling
  | "Claude-Haiku-4.5"
  | "Claude-Sonnet-4.5"
  | "Grok-4-Fast-Reasoning" // ❌ tool calling
  | "Grok-4-Fast-Non-Reasoning" // ❌ tool calling
  | "Grok-Code-Fast-1" // ❌ tool calling
  | "Grok-4" // ❌ tool calling
  | "Kimi-K2" // ❌ tool calling
  | "Seedream-4.0" // Image
  | "FLUX-schnell" // Image
  | "DeepSeek-R1"; // ❌ tool calling

export function createPoeAdapter(options: { apiKey: string }) {
  return createOpenAICompatible<ModelId, string, string, string>({
    name: "poe",
    baseURL: "https://api.poe.com/v1",
    apiKey: options.apiKey,
  }).chatModel;
}

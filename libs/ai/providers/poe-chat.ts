import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";

import { POE_BASE_URL, type PoeModelId, type PoeOptions } from "./poe-models.ts";

type PoeChat = (modelId: PoeModelId) => LanguageModelV3;

const providerCache = new Map<string, PoeChat>();

/**
 * Poe adapter using OpenAI Chat Completions (`/v1/chat/completions`).
 * Prefer for multi-provider tool loops.
 */
export function createPoeChat(options: PoeOptions): PoeChat {
  const cached = providerCache.get(options.apiKey);
  if (cached) return cached;

  const provider = createOpenAICompatible({
    name: "poe",
    baseURL: POE_BASE_URL,
    apiKey: options.apiKey,
  });

  const poe: PoeChat = (modelId) => provider.chatModel(modelId);
  providerCache.set(options.apiKey, poe);
  return poe;
}

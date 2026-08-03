import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3 } from "@ai-sdk/provider";

import { POE_BASE_URL, type PoeModelId, type PoeOptions } from "./poe-models.ts";

type PoeMessages = (modelId: PoeModelId) => LanguageModelV3;

const providerCache = new Map<string, PoeMessages>();

/**
 * Poe adapter using Anthropic Messages (`/v1/messages`).
 * Prefer for Claude-specific features (thinking, prompt cache).
 */
export function createPoeMessages(options: PoeOptions): PoeMessages {
  const cached = providerCache.get(options.apiKey);
  if (cached) return cached;

  const provider = createAnthropic({
    name: "poe.messages",
    baseURL: POE_BASE_URL,
    apiKey: options.apiKey,
  });

  const poe: PoeMessages = (modelId) => provider(modelId);
  providerCache.set(options.apiKey, poe);
  return poe;
}

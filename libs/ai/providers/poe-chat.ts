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
    supportsStructuredOutputs: true,
    transformRequestBody: (args) => {
      const request = deliverJsonSchema(args);
      return {
        ...request,
        extra_body: {
          ...(isRecord(request.extra_body) ? request.extra_body : {}),
          web_search: false,
        },
      };
    },
  });

  const poe: PoeChat = (modelId) => provider.chatModel(modelId);
  providerCache.set(options.apiKey, poe);
  return poe;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Poe chat rejects `response_format` for Claude and DeepSeek.
 * The JSON schema is copied into the system prompt so the model still receives it.
 */
const deliverJsonSchema = (args: Record<string, unknown>): Record<string, unknown> => {
  if (typeof args.model !== "string" || !rejectsResponseFormat(args.model)) return args;
  const schema = readJsonSchema(args.response_format);
  const { response_format, ...rest } = schema ? withSchemaInstruction(args, schema) : args;
  void response_format;
  return rest;
};

const rejectsResponseFormat = (model: string): boolean => model.startsWith("claude-") || model.startsWith("deepseek-");

const readJsonSchema = (responseFormat: unknown): unknown => {
  if (!isRecord(responseFormat) || responseFormat.type !== "json_schema" || !isRecord(responseFormat.json_schema))
    return undefined;
  return responseFormat.json_schema.schema;
};

const withSchemaInstruction = (args: Record<string, unknown>, schema: unknown): Record<string, unknown> => {
  const instruction = `Return JSON matching this schema:\n${JSON.stringify(schema)}`;
  const messages = Array.isArray(args.messages) ? args.messages : [];
  return { ...args, messages: [{ role: "system", content: instruction }, ...messages] };
};

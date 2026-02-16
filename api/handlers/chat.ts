import { streamText, type FilePart, type ImagePart, type ModelMessage, type TextPart } from "ai";
import type { Context } from "hono";
import { stream } from "hono/streaming";
import z from "zod";

import { createPoeAdapter, type PoeModelId } from "../../libs/ai/providers/poe-provider.ts";
import { env } from "../../libs/env.ts";

const openAITextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const openAIImageUrlSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.union([
    z.string(),
    z.object({
      url: z.string(),
      detail: z.enum(["auto", "low", "high"]).optional(),
    }),
  ]),
});

const openAIInputAudioSchema = z.object({
  type: z.literal("input_audio"),
  input_audio: z.object({
    data: z.string(),
    format: z.enum(["wav", "mp3"]),
  }),
});

const openAIContentPartSchema = z.union([openAITextContentSchema, openAIImageUrlSchema, openAIInputAudioSchema]);

const openAIToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const openAIMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(openAIContentPartSchema)]).optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(openAIToolCallSchema).optional(),
});

const openAIRequestSchema = z.object({
  model: z.string().default("claude-sonnet-4.5"),
  messages: z.array(openAIMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.unknown()).optional(),
});

type OpenAIMessage = z.infer<typeof openAIMessageSchema>;
type OpenAIContentPart = z.infer<typeof openAIContentPartSchema>;

/**
 * OpenAI-compatible chat completions endpoint.
 * Accepts standard OpenAI API requests and returns responses using Poe models underneath.
 */
export const chatHandler = async (c: Context) => {
  try {
    const body = await c.req.json();
    const parsed = openAIRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: `Invalid request: ${parsed.error.message}`,
            type: "invalid_request_error",
            code: "invalid_request",
          },
        },
        400,
      );
    }

    const { model, messages, temperature, max_tokens, stream: shouldStream } = parsed.data;

    const mappedModel = mapModelName(model);

    if (!mappedModel) {
      return c.json(
        {
          error: {
            message: `Model '${model}' is not supported. Currently supported: claude-sonnet-4.5`,
            type: "invalid_request_error",
            code: "model_not_supported",
          },
        },
        400,
      );
    }

    const aiMessages = messages.map(mapMessage);
    const poe = createPoeAdapter({ apiKey: env.poeApiKey, webSearch: true });

    console.log("[CHAT]", {
      model: mappedModel,
      messageCount: messages.length,
      stream: shouldStream,
      webSearch: true,
    });

    const result = streamText({
      model: poe(mappedModel),
      messages: aiMessages,
      temperature,
      experimental_telemetry: { isEnabled: false },
      maxOutputTokens: max_tokens,
    });

    if (shouldStream) {
      return stream(c, async (streamWriter) => {
        const id = `chatcmpl-${crypto.randomUUID()}`;
        const created = Math.floor(Date.now() / 1000);

        for await (const chunk of result.textStream) {
          const data = {
            id,
            object: "chat.completion.chunk",
            created,
            model: mappedModel,
            choices: [
              {
                index: 0,
                delta: { content: chunk },
                finish_reason: null,
              },
            ],
          };

          await streamWriter.write(`data: ${JSON.stringify(data)}\n\n`);
        }

        const finalData = {
          id,
          object: "chat.completion.chunk",
          created,
          model: mappedModel,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        };

        await streamWriter.write(`data: ${JSON.stringify(finalData)}\n\n`);
        await streamWriter.write("data: [DONE]\n\n");
      });
    } else {
      const text = await result.text;
      const usage = await result.usage;

      return c.json({
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: mappedModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: text,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: (usage as any)?.promptTokens ?? 0,
          completion_tokens: (usage as any)?.completionTokens ?? 0,
          total_tokens: (usage as any)?.totalTokens ?? 0,
        },
      });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[CHAT ERROR]", errorMessage);

    return c.json(
      {
        error: {
          message: errorMessage,
          type: "server_error",
          code: "internal_error",
        },
      },
      500,
    );
  }
};

const mapModelName = (model: string): PoeModelId | null => {
  const normalized = model.toLowerCase().replace(/[_\s]+/g, "-");

  const knownModels: Record<string, PoeModelId> = {
    "claude-sonnet-4.5": "Claude-Sonnet-4.5",
    "gemini-3-flash-preview": "Gemini-3-Flash",
    "gemini-3-flash": "Gemini-3-Flash",
    "gemini-3-pro-preview": "Gemini-3-Pro",
    "gemini-3-pro": "Gemini-3-Pro",
    "claude-opus-4-5": "Claude-Opus-4.5",
    "claude-sonnet-4-5": "Claude-Sonnet-4.5",
  };

  return knownModels[normalized] ?? null;
};

const mapMessage = (msg: OpenAIMessage): ModelMessage => {
  if (msg.role === "system") {
    return { role: "system" as const, content: typeof msg.content === "string" ? msg.content : "" };
  }

  if (msg.role === "assistant") {
    return { role: "assistant" as const, content: typeof msg.content === "string" ? msg.content : "" };
  }

  if (typeof msg.content === "string") {
    return { role: "user" as const, content: msg.content };
  }

  if (Array.isArray(msg.content)) {
    const parts: Array<TextPart | ImagePart | FilePart> = msg.content.map((part: OpenAIContentPart) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }

      if (part.type === "image_url") {
        const imageUrl = typeof part.image_url === "string" ? part.image_url : part.image_url.url;

        if (imageUrl.startsWith("data:")) {
          const [mediaTypePart, base64] = imageUrl.split(",");
          const mediaType = mediaTypePart?.match(/data:([^;]+)/)?.[1];
          return {
            type: "image" as const,
            image: Buffer.from(base64, "base64"),
            mediaType,
          };
        }

        try {
          return { type: "image" as const, image: new URL(imageUrl) };
        } catch {
          return { type: "text" as const, text: `[Invalid image URL: ${imageUrl}]` };
        }
      }

      if (part.type === "input_audio") {
        return {
          type: "file" as const,
          data: Buffer.from(part.input_audio.data, "base64"),
          mediaType: `audio/${part.input_audio.format}`,
        };
      }

      return { type: "text" as const, text: JSON.stringify(part) };
    });

    return { role: "user" as const, content: parts };
  }

  return { role: "user" as const, content: String(msg.content || "") };
};

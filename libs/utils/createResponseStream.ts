import type { TextStreamPart, ToolSet } from "ai";
import { InputFile } from "grammy";

import { extractFile } from "../ai/createFileTool.ts";
import { markdownToTelegramHtml } from "./markdownToTelegramHtml.ts";
import { shorten } from "./shorten.ts";
import { telegramBot } from "./telegram.ts";

type ToolCallChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "tool-call" }>;
type ToolResultChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "tool-result" }>;
type ErrorChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "error" }>;

type MarkerResult = { marker: string };
type HandlerResult = string | MarkerResult | null;

const isMarkerResult = (result: HandlerResult): result is MarkerResult =>
  result !== null && typeof result === "object" && "marker" in result;

type StreamHandlers<TOOLS extends ToolSet> = {
  onToolCall?: (chunk: ToolCallChunk<TOOLS>) => HandlerResult;
  onToolResult?: (chunk: ToolResultChunk<TOOLS>) => HandlerResult;
  onError?: (chunk: ErrorChunk<TOOLS>) => HandlerResult;
};

type ResponseStreamOptions<TOOLS extends ToolSet> = {
  handlers: StreamHandlers<TOOLS>;
  chatId?: string;
};

/**
 * Creates a ReadableStream that transforms an AI stream with typed tool handlers.
 * Processes text deltas, tool calls, tool results, and errors from the AI stream.
 */
export const createResponseStream = <TOOLS extends ToolSet>(
  fullStream: AsyncIterable<TextStreamPart<TOOLS>>,
  options: ResponseStreamOptions<TOOLS>
): ReadableStream<string> => {
  const { handlers, chatId } = options;
  const chunks: string[] = [];

  const notifyTelegram = async (message: string) => {
    if (!chatId) return;
    await telegramBot.api
      .sendMessage(chatId, markdownToTelegramHtml(message), { parse_mode: "HTML" })
      .catch((e) => console.error("Telegram error:", e));
  };

  return new ReadableStream<string>({
    async start(controller) {
      const enqueue = (text: string) => {
        controller.enqueue(text);
        if (chatId) chunks.push(text);
      };
      try {
        for await (const chunk of fullStream) {
          switch (chunk.type) {
            case "text-delta":
              if (chunk.text) enqueue(chunk.text);
              break;

            case "tool-call": {
              const result = handlers.onToolCall?.(chunk);
              if (!result) break;
              const text = isMarkerResult(result) ? result.marker : result;
              enqueue(`\n\n${text}\n\n`);
              if (!isMarkerResult(result)) await notifyTelegram(result);
              break;
            }

            case "tool-result": {
              const result = handlers.onToolResult?.(chunk);
              if (!result) break;
              const text = isMarkerResult(result) ? result.marker : result;
              enqueue(`\n\n${text}\n\n`);
              if (!isMarkerResult(result)) await notifyTelegram(result);
              break;
            }

            case "error": {
              const result = handlers.onError?.(chunk) ?? `⚠️ Error: ${chunk.error}`;
              const text = isMarkerResult(result) ? result.marker : result;
              enqueue(`\n\n${text}\n\n`);
              if (!isMarkerResult(result)) await notifyTelegram(result);
              break;
            }
          }
        }

        if (chatId && chunks.length > 0) {
          const fullText = chunks.join("");
          const extracted = extractFile(fullText);
          const fileName = extracted?.name ?? "result.md";
          const content = extracted?.result ?? fullText;
          const caption = extracted?.description ?? shorten(content, 30);
          await telegramBot.api
            .sendDocument(chatId, new InputFile(Buffer.from(content, "utf-8"), fileName), {
              caption: markdownToTelegramHtml(caption),
              parse_mode: "HTML",
            })
            .catch((e) => console.error("Telegram error:", e));
        }

        controller.close();
      } catch (error) {
        handleStreamError(controller, error);
      }
    },
  });
};

const handleStreamError = (controller: ReadableStreamDefaultController<string>, error: unknown): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[STREAM ERROR]", errorMessage, error);
  controller.enqueue(`\n\n⚠️ Stream error: ${errorMessage}\n\n`);
  controller.close();
};

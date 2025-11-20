import type { TextStreamPart, ToolSet } from "ai";
import { InputFile } from "grammy";
import { shorten } from "./shorten.ts";
import { telegramBot } from "./telegram.ts";

type ToolCallChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "tool-call" }>;
type ToolResultChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "tool-result" }>;
type ErrorChunk<TOOLS extends ToolSet> = Extract<TextStreamPart<TOOLS>, { type: "error" }>;

type StreamHandlers<TOOLS extends ToolSet> = {
  onToolCall?: (chunk: ToolCallChunk<TOOLS>) => string | null;
  onToolResult?: (chunk: ToolResultChunk<TOOLS>) => string | null;
  onError?: (chunk: ErrorChunk<TOOLS>) => string | null;
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
  const textChunks: string[] = [];

  const notifyTelegram = async (message: string) => {
    if (!chatId) return;
    await telegramBot.api.sendMessage(chatId, message).catch((e) => console.error("Telegram error:", e));
  };

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of fullStream) {
          switch (chunk.type) {
            case "text-delta":
              if (chunk.text) {
                controller.enqueue(chunk.text);
                if (chatId) textChunks.push(chunk.text);
              }
              break;

            case "tool-call": {
              const message = handlers.onToolCall?.(chunk);
              if (message) {
                controller.enqueue(`\n\n${message}\n\n`);
                await notifyTelegram(message);
              }
              break;
            }

            case "tool-result": {
              const message = handlers.onToolResult?.(chunk);
              if (message) {
                controller.enqueue(`\n\n${message}\n\n`);
                await notifyTelegram(message);
              }
              break;
            }

            case "error": {
              const message = handlers.onError?.(chunk) ?? `\n\n⚠️ Error: ${chunk.error}\n\n`;
              controller.enqueue(message);
              await notifyTelegram(message);
              break;
            }
          }
        }

        if (chatId && textChunks.length > 0) {
          const fullText = textChunks.join("");
          await telegramBot.api
            .sendDocument(chatId, new InputFile(Buffer.from(fullText, "utf-8"), "result.md"), {
              caption: shorten(fullText, 30),
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

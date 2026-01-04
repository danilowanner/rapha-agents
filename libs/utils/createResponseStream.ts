import type { TextStreamPart, ToolSet } from "ai";

import { getErrorMessage } from "./getErrorMessage.ts";

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
  hooks?: {
    onComplete?: (chunks: string[]) => void;
  };
};

/**
 * Creates a ReadableStream that transforms an AI stream with typed tool handlers.
 * Processes text deltas, tool calls, tool results, and errors from the AI stream.
 */
export const createResponseStream = <TOOLS extends ToolSet>(
  fullStream: AsyncIterable<TextStreamPart<TOOLS>>,
  options: ResponseStreamOptions<TOOLS>
): ReadableStream<string> => {
  const { handlers, hooks } = options;
  const chunks: string[] = [];

  return new ReadableStream<string>({
    async start(controller) {
      const enqueue = (text: string) => {
        controller.enqueue(text);
        if (hooks?.onComplete) chunks.push(text);
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
              break;
            }

            case "tool-result": {
              const result = handlers.onToolResult?.(chunk);
              if (!result) break;
              const text = isMarkerResult(result) ? result.marker : result;
              enqueue(`\n\n${text}\n\n`);
              break;
            }

            case "error": {
              const result = handlers.onError?.(chunk) ?? `⚠️ Error: ${chunk.error}`;
              const text = isMarkerResult(result) ? result.marker : result;
              enqueue(`\n\n${text}\n\n`);
              break;
            }
          }
        }

        if (hooks?.onComplete && chunks.length > 0) {
          hooks.onComplete(chunks);
        }

        controller.close();
      } catch (error) {
        const message = handleStreamError(controller, error);
        controller.enqueue(message);
        controller.close();
      }
    },
  });
};

const handleStreamError = (controller: ReadableStreamDefaultController<string>, error: unknown): string => {
  const errorMessage = getErrorMessage(error);
  console.error("[STREAM ERROR]", errorMessage, error);
  return `\n\n⚠️ Stream error: ${errorMessage}\n\n`;
};

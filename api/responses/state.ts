import { EventEmitter } from "node:events";
import { extractFileByMarker } from "../../libs/ai/createFileTool.ts";
import { extractFile } from "../../libs/ai/functions/extractFile.ts";

const MAX_CACHED_RESPONSES = 20;

interface ResponseEntry {
  buffer: ResponseBuffer;
  createdAt: Date;
}

const responses = new Map<string, ResponseEntry>();

/**
 * Adds a new response stream and returns a unique ID.
 */
export const addResponse = (stream: ReadableStream<string>): string => {
  const id = crypto.randomUUID();
  responses.set(id, { buffer: new ResponseBuffer(stream), createdAt: new Date() });
  pruneOldResponses();
  return id;
};

/**
 * Creates a new ReadableStream for the response.
 */
export const getResponseStream = (id: string): ReadableStream<string> | null => {
  return responses.get(id)?.buffer.createStream() ?? null;
};

/**
 * Checks if a response with the given ID exists.
 */
export const hasResponse = (id: string): boolean => {
  return responses.has(id);
};

type FileResult = {
  name: string;
  description?: string;
  result: string;
};

/**
 * Returns the full buffered content when stream completes.
 */
export const getResponseResult = async (id: string): Promise<FileResult | null> => {
  return responses.get(id)?.buffer.getFileResult() ?? null;
};

/**
 * Returns the creation date of a response.
 */
export const getResponseCreatedAt = (id: string): Date | null => {
  return responses.get(id)?.createdAt ?? null;
};

/**
 * Removes a response by ID.
 */
export const deleteResponse = (id: string): void => {
  responses.delete(id);
};

const pruneOldResponses = (): void => {
  if (responses.size <= MAX_CACHED_RESPONSES) return;

  const entries = [...responses.entries()].sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());

  const toRemove = entries.slice(0, responses.size - MAX_CACHED_RESPONSES);
  toRemove.forEach(([id]) => responses.delete(id));
};

class ResponseBuffer extends EventEmitter {
  private chunks: string[] = [];
  private completed = Promise.withResolvers<void>();
  private isDone = false;
  private fileResultPromise: Promise<FileResult | null> | null = null;

  constructor(stream: ReadableStream<string>) {
    super();
    this.consume(stream);
  }

  private async consume(stream: ReadableStream<string>) {
    try {
      for await (const chunk of stream) {
        this.chunks.push(chunk);
        this.emit("chunk", chunk);
      }
      this.completed.resolve();
    } catch (error) {
      this.completed.reject(error);
    } finally {
      this.isDone = true;
      this.emit("done");
    }
  }

  createStream(): ReadableStream<string> {
    return new ReadableStream<string>({
      start: (controller) => {
        this.chunks.forEach((chunk) => controller.enqueue(chunk));

        if (this.isDone) {
          controller.close();
          return;
        }

        const onChunk = (chunk: string) => controller.enqueue(chunk);
        const onDone = () => {
          this.off("chunk", onChunk);
          controller.close();
        };

        this.on("chunk", onChunk);
        this.once("done", onDone);
      },
    });
  }

  async getResult(): Promise<string> {
    await this.completed.promise;
    return this.chunks.join("");
  }

  async getFileResult(): Promise<FileResult | null> {
    this.fileResultPromise ??= this.extractFileResult();
    return this.fileResultPromise;
  }

  private async extractFileResult(): Promise<FileResult | null> {
    await this.completed.promise;
    const content = this.chunks.join("");
    const extracted = extractFileByMarker(content);
    if (extracted) return extracted;
    return extractFile(content);
  }
}

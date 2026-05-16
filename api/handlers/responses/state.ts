import { EventEmitter } from "node:events";
import { extractFileByMarker } from "../../../libs/ai/createFileTool.ts";
import { extractFile } from "../../../libs/ai/functions/extractFile.ts";

const MAX_CACHED_RESPONSES = 20;

interface ResponseEntry {
  buffer: ResponseBuffer;
  clipboard?: string;
  createdAt: Date;
  userId: string;
}

type AddResponseOptions = {
  userId: string;
};

const responses = new Map<string, ResponseEntry>();

/**
 * Creates a unique response ID before the response stream exists.
 */
export const createResponseId = (): string => crypto.randomUUID();

/**
 * Adds a response stream for a pre-created ID.
 */
export const addResponse = (id: string, stream: ReadableStream<string>, options: AddResponseOptions): void => {
  responses.set(id, { buffer: new ResponseBuffer(stream), createdAt: new Date(), userId: options.userId });
  pruneOldResponses();
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

/**
 * Adds clipboard content to an existing response.
 */
export const addClipboard = (id: string, clipboard: string): boolean => {
  const response = responses.get(id);
  if (!response) return false;
  response.clipboard = clipboard;
  return true;
};

/**
 * Returns clipboard content for a response.
 */
export const getResponseClipboard = (id: string): string | null => {
  const response = responses.get(id);
  if (!response) return null;
  return response.clipboard ?? "";
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

export type RecentResponsesOptions = {
  limit?: number;
  userId?: string;
};

/**
 * Lists recent response views from the in-memory response cache.
 */
export const getRecentResponses = (options: RecentResponsesOptions = {}) => {
  const limit = options.limit ?? MAX_CACHED_RESPONSES;
  return [...responses.entries()]
    .filter(([, entry]) => !options.userId || entry.userId === options.userId)
    .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map(([id, entry]) => ({
      id,
      createdAt: entry.createdAt.toISOString(),
      url: `/responses/view/${id}`,
      userId: entry.userId,
    }));
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

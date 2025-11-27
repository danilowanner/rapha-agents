import { EventEmitter } from "node:events";

const responses = new Map<string, ResponseBuffer>();

/**
 * Adds a new response stream and returns a unique ID.
 */
export const addResponse = (stream: ReadableStream<string>): string => {
  const id = crypto.randomUUID();
  responses.set(id, new ResponseBuffer(stream));
  return id;
};

/**
 * Creates a new ReadableStream for the response.
 */
export const getResponseStream = (id: string): ReadableStream<string> | null => {
  return responses.get(id)?.createStream() ?? null;
};

/**
 * Checks if a response with the given ID exists.
 */
export const hasResponse = (id: string): boolean => {
  return responses.has(id);
};

/**
 * Returns the full buffered content when stream completes.
 */
export const getResponseResult = async (id: string): Promise<string | null> => {
  return responses.get(id)?.getResult() ?? null;
};

/**
 * Removes a response by ID.
 */
export const deleteResponse = (id: string): void => {
  responses.delete(id);
};

class ResponseBuffer extends EventEmitter {
  private chunks: string[] = [];
  private completed = Promise.withResolvers<void>();
  private isDone = false;

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
}

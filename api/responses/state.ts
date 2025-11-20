type Response = {
  viewStream: ReadableStream<string>;
  resultStream: ReadableStream<string>;
};

const responses = new Map<string, Response>();

/**
 * Adds a new response stream and returns a unique ID
 */
export const addResponse = (stream: ReadableStream<string>): string => {
  const id = crypto.randomUUID();
  const [viewStream, resultStream] = stream.tee();
  responses.set(id, { viewStream, resultStream });
  return id;
};

/**
 * Retrieves a response by ID
 */
export const getResponse = (id: string): Response | null => {
  return responses.get(id) || null;
};

/**
 * Removes a response stream by ID
 */
export const deleteResponse = (id: string): void => {
  responses.delete(id);
};

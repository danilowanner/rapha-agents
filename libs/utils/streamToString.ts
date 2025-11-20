/**
 * Reads all chunks from a ReadableStream and returns the complete string
 */
export const streamToString = async (stream: ReadableStream<string>): Promise<string> => {
  let result = "";
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
};

/**
 * Extracts a clean error message from an unknown error value.
 * Returns just the message string without stack traces.
 */
export const getErrorMessage = (e: unknown): string => {
  if (typeof e === "object" && e !== null && "message" in e) {
    const message = (e as { message: string }).message;
    return message.split("\n")[0];
  }
  return String(e).split("\n")[0];
};

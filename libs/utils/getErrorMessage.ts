const SHORT_FIRST_LINE_THRESHOLD = 20;
const MIN_COMBINED_MESSAGE_LENGTH = 80;

/**
 * Extracts a clean error message from an unknown error value.
 * Returns just the message string without stack traces.
 */
export const getErrorMessage = (e: unknown): string => {
  if (typeof e === "object" && e !== null && "message" in e) {
    const message = (e as { message: unknown }).message;
    return getCondensedErrorMessage(String(message));
  }
  return getCondensedErrorMessage(String(e));
};

const getCondensedErrorMessage = (value: string): string => {
  const segments = value
    .split("\n")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) return "";

  const [firstSegment, ...remainingSegments] = segments;
  if (firstSegment.length >= SHORT_FIRST_LINE_THRESHOLD)
    return firstSegment;

  return remainingSegments.reduce(
    (combined, segment) =>
      combined.length >= MIN_COMBINED_MESSAGE_LENGTH
        ? combined
        : `${combined} ${segment}`,
    firstSegment,
  );
};

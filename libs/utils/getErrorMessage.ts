import { ZodError } from "zod";

const SHORT_FIRST_LINE_THRESHOLD = 20;

/**
 * Extracts a clean error message from an unknown error value.
 * Returns just the message string without stack traces.
 */
export const getErrorMessage = (e: unknown): string => {
  if (e instanceof ZodError) return getCondensedErrorMessage(getZodErrorMessage(e));

  if (typeof e === "object" && e !== null && "message" in e) {
    const message = (e as { message: unknown }).message;
    return getCondensedErrorMessage(String(message));
  }
  return getCondensedErrorMessage(String(e));
};

const getZodErrorMessage = (error: ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

const getCondensedErrorMessage = (value: string): string => {
  const segments = value
    .split("\n")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const [firstSegment = ""] = segments;

  if (firstSegment.length >= SHORT_FIRST_LINE_THRESHOLD) return firstSegment;
  else return segments.join(" ");
};

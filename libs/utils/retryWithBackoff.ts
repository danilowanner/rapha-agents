import { createBackoff, type BackoffOptions } from "./createBackoff.ts";
import { getErrorMessage } from "./getErrorMessage.ts";

export type RetryOptions = {
  maxRetries?: number;
  backoff?: BackoffOptions;
  errorPrefix?: string;
};

/**
 * Retries an async operation with exponential backoff on failure.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, backoff: backoffOptions, errorPrefix } = options;
  const backoff = createBackoff(backoffOptions ?? { initial: 1000, max: 10000, factor: 2 });
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoff.current));
        backoff.increase();
      }
    }
  }

  const message = getErrorMessage(lastError);
  throw new Error(errorPrefix ? `${errorPrefix}: ${message}` : message);
}

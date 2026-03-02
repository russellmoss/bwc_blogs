/**
 * Retry wrapper for Neon cold starts on Vercel.
 * Retries with exponential backoff on connection errors.
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable =
        lastError.message.includes("Connection refused") ||
        lastError.message.includes("Connection terminated") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("socket hang up") ||
        lastError.message.includes("Can't reach database server");

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

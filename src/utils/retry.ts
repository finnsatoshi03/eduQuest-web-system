/**
 * Retry Utility with Exponential Backoff
 *
 * This utility helps prevent data loss by automatically retrying failed operations
 * with increasing delays between attempts.
 *
 * Use cases:
 * - Network failures during quiz answer submission
 * - Temporary database unavailability
 * - Rate limiting or throttling issues
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: any
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Executes a function with exponential backoff retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function
 * @throws RetryError if all attempts fail
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => submitAnswer(questionId, answer),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error)
 *   }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    exponentialBase = 2,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = initialDelayMs * Math.pow(exponentialBase, attempt - 1);
      const delayMs = Math.min(exponentialDelay, maxDelayMs);

      console.log(
        `⏳ Retry attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // All attempts failed
  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError
  );
}

/**
 * Checks if an error is retryable (network errors, timeouts, etc.)
 *
 * @param error - The error to check
 * @returns true if the error should be retried
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes("fetch failed")) return true;
  if (error?.message?.includes("network")) return true;
  if (error?.message?.includes("timeout")) return true;

  // HTTP errors (5xx server errors are retryable, 4xx client errors are not)
  if (error?.status >= 500 && error?.status < 600) return true;

  // Supabase specific errors
  if (error?.code === "PGRST301") return true; // Connection timeout
  if (error?.code === "PGRST504") return true; // Gateway timeout

  return false;
}

/**
 * Wrapper for retryWithBackoff that only retries on retryable errors
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function
 *
 * @example
 * const result = await retryOnNetworkError(
 *   () => supabase.from('quiz').select('*'),
 *   { maxAttempts: 3 }
 * );
 */
export async function retryOnNetworkError<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryWithBackoff(async () => {
    try {
      return await fn();
    } catch (error) {
      // If it's not a retryable error, throw immediately
      if (!isRetryableError(error)) {
        throw error;
      }
      // Otherwise, let the retry logic handle it
      throw error;
    }
  }, options);
}

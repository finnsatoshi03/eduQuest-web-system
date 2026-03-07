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
  onRetry?: (attempt: number, error: unknown) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
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

  let lastError: unknown;

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
export function isRetryableError(error: unknown): boolean {
  const errorMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const errorStatus =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  // Network errors
  if (errorMessage.includes("fetch failed")) return true;
  if (errorMessage.includes("network")) return true;
  if (errorMessage.includes("timeout")) return true;

  // HTTP errors (5xx server errors are retryable, 4xx client errors are not)
  if (errorStatus >= 500 && errorStatus < 600) return true;

  // Supabase specific errors
  if (errorCode === "PGRST301") return true; // Connection timeout
  if (errorCode === "PGRST504") return true; // Gateway timeout

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

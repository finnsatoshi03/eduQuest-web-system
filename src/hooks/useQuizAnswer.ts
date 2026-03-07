import { useMutation } from "@tanstack/react-query";
import { submitAnswer } from "@/services/api/apiRoom";
import { submitScheduledAnswer } from "@/services/api/apiScheduledQuiz";
import { retryWithBackoff, RetryError } from "@/utils/retry";

interface SubmitAnswerParams {
  questionId: string;
  studentId: string;
  answer: string;
  quizId: string;
  classCode: string;
  timeTaken?: number;
}

interface UseQuizAnswerOptions {
  quizType: "live" | "scheduled";
  onSuccess?: (isCorrect: boolean) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
}

/**
 * Custom hook for submitting quiz answers
 * Handles both live and scheduled quiz types with proper parameter passing
 * Includes automatic retry logic with exponential backoff to prevent data loss
 * Follows React Query pattern for mutations
 */
export function useQuizAnswer({
  quizType,
  onSuccess,
  onError,
  maxRetries = 3,
}: UseQuizAnswerOptions) {
  const mutation = useMutation({
    mutationFn: async (params: SubmitAnswerParams) => {
      const { questionId, studentId, answer, quizId, classCode, timeTaken = 0 } = params;

      // Wrap submission with retry logic
      try {
        return await retryWithBackoff(
          async () => {
            if (quizType === "live") {
              return await submitAnswer(
                questionId,
                studentId,
                answer,
                quizId,
                classCode,
                timeTaken
              );
            } else {
              return await submitScheduledAnswer(
                questionId,
                studentId,
                answer,
                quizId,
                classCode,
                timeTaken
              );
            }
          },
          {
            maxAttempts: maxRetries,
            initialDelayMs: 500,
            exponentialBase: 2,
            onRetry: (attempt, error) => {
              const retryErrorMessage =
                error instanceof Error ? error.message : String(error);
              console.warn(
                `⚠️ Answer submission failed (attempt ${attempt}/${maxRetries}):`,
                retryErrorMessage
              );
            },
          }
        );
      } catch (error) {
        // If it's a RetryError, extract the original error
        if (error instanceof RetryError) {
          console.error(
            `❌ Answer submission failed after ${error.attempts} attempts`
          );
          throw error.lastError;
        }
        throw error;
      }
    },
    onSuccess: (isCorrect) => {
      console.log("✅ Answer submitted successfully:", isCorrect);
      if (onSuccess) {
        onSuccess(isCorrect);
      }
    },
    onError: (error: Error) => {
      console.error("❌ Final error submitting answer:", error);
      if (onError) {
        onError(error);
      }
    },
  });

  return {
    submitAnswer: mutation.mutate,
    submitAnswerAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    data: mutation.data, // boolean - isCorrect
  };
}

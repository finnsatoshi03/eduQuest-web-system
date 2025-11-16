import { useMutation } from "@tanstack/react-query";
import { submitAnswer } from "@/services/api/apiRoom";
import { submitScheduledAnswer } from "@/services/api/apiScheduledQuiz";

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
}

/**
 * Custom hook for submitting quiz answers
 * Handles both live and scheduled quiz types with proper parameter passing
 * Follows React Query pattern for mutations
 */
export function useQuizAnswer({ quizType, onSuccess, onError }: UseQuizAnswerOptions) {
  const mutation = useMutation({
    mutationFn: async (params: SubmitAnswerParams) => {
      const { questionId, studentId, answer, quizId, classCode, timeTaken = 0 } = params;

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
    onSuccess: (isCorrect) => {
      if (onSuccess) {
        onSuccess(isCorrect);
      }
    },
    onError: (error: Error) => {
      console.error("Error submitting answer:", error);
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

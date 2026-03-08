import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQuizById,
  updateQuizTitle,
  getQuestions,
} from "@/services/api/apiQuiz";
import { Quiz, QuizQuestions } from "@/lib/types";

export function useQuizData(quizId: string) {
  const queryClient = useQueryClient();

  const quizQuery = useQuery<Quiz, Error>({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const quiz = await getQuizById(quizId);
      if (!quiz) {
        throw new Error("Quiz not found");
      }
      return quiz;
    },
    staleTime: 1000 * 60 * 5,
  });

  const questionsQuery = useQuery<QuizQuestions[], Error>({
    queryKey: ["questions", quizId],
    queryFn: async () => {
      const questions = await getQuestions(quizId);
      if (!questions) {
        throw new Error("Questions not found");
      }
      return questions;
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateTitleMutation = useMutation({
    mutationFn: (newTitle: string) => updateQuizTitle(quizId, newTitle),
    onMutate: async (newTitle) => {
      await queryClient.cancelQueries({ queryKey: ["quiz", quizId] });
      const previousQuiz = queryClient.getQueryData<Quiz>(["quiz", quizId]);
      queryClient.setQueryData<Quiz>(["quiz", quizId], (old) => ({
        ...old!,
        title: newTitle,
      }));
      return { previousQuiz };
    },
    onError: (context: { previousQuiz: Quiz | undefined }) => {
      queryClient.setQueryData(["quiz", quizId], context?.previousQuiz);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
    },
  });

  return {
    quiz: quizQuery.data,
    questions: questionsQuery.data,
    isLoading: quizQuery.isPending || questionsQuery.isPending,
    isError: quizQuery.isError || questionsQuery.isError,
    refetch: async () => {
      await Promise.all([quizQuery.refetch(), questionsQuery.refetch()]);
    },
    updateTitle: updateTitleMutation.mutate,
  };
}

import { useQuery } from "@tanstack/react-query";
import {
  getProfessorOverallStats,
  getQuizDetailedAnalytics,
  getPerformanceTrends,
  getQuestionDifficultyAnalysis,
} from "@/services/api/apiAnalytics";

/**
 * Custom hook for professor overall statistics
 * Uses React Query for efficient data fetching and caching
 */
export function useProfessorOverallStats(professorId: string | undefined) {
  return useQuery({
    queryKey: ["professorOverallStats", professorId],
    queryFn: () => getProfessorOverallStats(professorId!),
    enabled: !!professorId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Custom hook for detailed quiz analytics
 */
export function useQuizDetailedAnalytics(
  quizId: string | undefined,
  classCode: string | undefined,
) {
  return useQuery({
    queryKey: ["quizDetailedAnalytics", quizId, classCode],
    queryFn: () => getQuizDetailedAnalytics(quizId!, classCode!),
    enabled: !!quizId && !!classCode,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Custom hook for performance trends
 */
export function usePerformanceTrends(
  professorId: string | undefined,
  timeFilter: "week" | "month",
) {
  return useQuery({
    queryKey: ["performanceTrends", professorId, timeFilter],
    queryFn: () => getPerformanceTrends(professorId!, timeFilter),
    enabled: !!professorId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Custom hook for question difficulty analysis
 */
export function useQuestionDifficultyAnalysis(quizId: string | undefined) {
  return useQuery({
    queryKey: ["questionDifficultyAnalysis", quizId],
    queryFn: () => getQuestionDifficultyAnalysis(quizId!),
    enabled: !!quizId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

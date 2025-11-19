import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import supabase from "@/services/supabase";
import {
  getStudentQuizHistory,
  getStudentPerformanceStats,
  getStudentPerformanceBySubject,
  getFilteredQuizHistory,
  StudentQuizHistory,
  StudentPerformanceStats,
  SubjectPerformance,
} from "@/services/api/apiStudent";

/**
 * Custom hook for student dashboard data
 * Uses React Query for efficient data fetching and caching
 * Now with realtime subscriptions for instant updates
 */
export function useStudentDashboard(studentId: string | undefined) {
  const queryClient = useQueryClient();

  // Query for quiz history
  const historyQuery = useQuery({
    queryKey: ["studentQuizHistory", studentId],
    queryFn: () => getStudentQuizHistory(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // 5 minutes (but realtime will update sooner)
    refetchOnWindowFocus: false,
  });

  // Query for performance stats
  const statsQuery = useQuery({
    queryKey: ["studentPerformanceStats", studentId],
    queryFn: () => getStudentPerformanceStats(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Query for subject performance
  const subjectsQuery = useQuery({
    queryKey: ["studentSubjectPerformance", studentId],
    queryFn: () => getStudentPerformanceBySubject(studentId!),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Set up realtime subscription to quiz_history table
  useEffect(() => {
    if (!studentId) return;

    console.log("📡 Setting up realtime subscription for student:", studentId);

    const channel = supabase
      .channel(`quiz_history:student:${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quiz_history",
          filter: `quiz_student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("🎉 New quiz result received!", payload);

          // Invalidate and refetch all queries to get the latest data
          queryClient.invalidateQueries({
            queryKey: ["studentQuizHistory", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["studentPerformanceStats", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["studentSubjectPerformance", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["filteredQuizHistory", studentId],
          });

          // Show a notification or update UI
          console.log("✅ Student dashboard data refreshed automatically");
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz_history",
          filter: `quiz_student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("📝 Quiz result updated!", payload);

          // Invalidate queries to refetch updated data
          queryClient.invalidateQueries({
            queryKey: ["studentQuizHistory", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["studentPerformanceStats", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["studentSubjectPerformance", studentId],
          });
          queryClient.invalidateQueries({
            queryKey: ["filteredQuizHistory", studentId],
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Student dashboard realtime subscription active");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Realtime subscription error:", err);
        } else if (status === "TIMED_OUT") {
          console.error("⏱️ Realtime subscription timed out");
        } else {
          console.log("🔌 Subscription status:", status);
        }
      });

    // Cleanup subscription on unmount
    return () => {
      console.log("🔌 Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [studentId, queryClient]);

  return {
    history: historyQuery.data || [],
    stats: statsQuery.data || null,
    subjects: subjectsQuery.data || [],
    isLoading:
      historyQuery.isLoading ||
      statsQuery.isLoading ||
      subjectsQuery.isLoading,
    isError:
      historyQuery.isError || statsQuery.isError || subjectsQuery.isError,
    error: historyQuery.error || statsQuery.error || subjectsQuery.error,
    refetch: async () => {
      // Invalidate all related queries to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["studentQuizHistory", studentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["studentPerformanceStats", studentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["studentSubjectPerformance", studentId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["filteredQuizHistory", studentId],
        }),
      ]);

      // Refetch all queries
      return Promise.all([
        historyQuery.refetch(),
        statsQuery.refetch(),
        subjectsQuery.refetch(),
      ]);
    },
  };
}

/**
 * Custom hook for filtered quiz history
 * Now properly reacts to changes in the base history data
 */
export function useFilteredQuizHistory(
  studentId: string | undefined,
  timeFilter: "week" | "month" | "all",
  subjectFilter: string,
  allHistory: StudentQuizHistory[],
) {
  return useQuery({
    queryKey: [
      "filteredQuizHistory",
      studentId,
      timeFilter,
      subjectFilter,
      allHistory.length, // Include history length to trigger refetch when data changes
    ],
    queryFn: async () => {
      let filtered = [...allHistory];

      // Apply time filter
      if (timeFilter !== "all" && studentId) {
        filtered = await getFilteredQuizHistory(studentId, timeFilter);
      }

      // Apply subject filter
      if (subjectFilter !== "all") {
        filtered = filtered.filter((quiz) => quiz.subject === subjectFilter);
      }

      return filtered;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

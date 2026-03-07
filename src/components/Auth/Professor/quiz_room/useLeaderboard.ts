/* eslint-disable @typescript-eslint/no-explicit-any */
import { LeaderboardEntry } from "@/lib/types";
import supabase from "@/services/supabase";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function useLeaderboard(classId: string) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    [],
  );

  useEffect(() => {
    let subscription: any;
    let retryTimeout: NodeJS.Timeout;
    let quizStatusSubscription: any;

    // Check quiz status and determine data source
    const checkQuizStatus = async (): Promise<{
      isFinalized: boolean;
      status: string;
      sessionId: string | null;
      isScheduledQuiz: boolean;
    }> => {
      try {
        const { data, error } = await supabase
          .from("quiz")
          .select("status, quiz_id, current_session_id")
          .eq("class_code", classId)
          .single();

        if (error || !data) {
          return {
            isFinalized: false,
            status: "",
            sessionId: null,
            isScheduledQuiz: false,
          };
        }

        const isScheduledQuiz =
          data.status === "scheduled" ||
          data.status === "scheduled-in-game" ||
          data.status === "scheduled-completed";

        // Check if quiz is finalized
        // "in game" = actively running live quiz (NOT finalized)
        // "active" = completed live quiz (finalized)
        // "scheduled-completed" = completed scheduled quiz (finalized)
        const isFinalized =
          data.status === "scheduled-completed" || data.status === "active";

        return {
          isFinalized,
          status: data.status,
          sessionId: data.current_session_id,
          isScheduledQuiz,
        };
      } catch (error) {
        console.error("Error checking quiz status:", error);
        return {
          isFinalized: false,
          status: "",
          sessionId: null,
          isScheduledQuiz: false,
        };
      }
    };

    const fetchInitialData = async () => {
      try {
        const quizInfo = await checkQuizStatus();
        const { isFinalized, sessionId, isScheduledQuiz } = quizInfo;

        // For scheduled quizzes, we need to check both tables
        // because students can auto-finalize while quiz is still ongoing
        if (isScheduledQuiz) {
          // Fetch from both quiz_students (ongoing attempts) and quiz_history (finalized attempts)
          const [studentsData, historyData] = await Promise.all([
            // Get ongoing attempts from quiz_students
            sessionId
              ? supabase
                  .from("quiz_students")
                  .select("*")
                  .eq("class_code", classId)
                  .eq("session_id", sessionId)
                  .order("score", { ascending: false })
              : Promise.resolve({ data: [], error: null }),
            // Get finalized attempts from quiz_history
            sessionId
              ? supabase
                  .from("quiz_history")
                  .select("*")
                  .eq("class_code", classId)
                  .eq("session_id", sessionId)
                  .order("score", { ascending: false })
              : Promise.resolve({ data: [], error: null }),
          ]);

          if (studentsData.error) {
            console.error("Error fetching quiz_students:", studentsData.error);
          }
          if (historyData.error) {
            console.error("Error fetching quiz_history:", historyData.error);
          }

          // Combine data from both sources
          const ongoingStudents = (studentsData.data || []).map(
            (entry: any) => ({
              id: entry.id,
              quiz_student_id: entry.quiz_student_id,
              student_name: entry.student_name,
              student_email: entry.student_email,
              student_avatar: entry.student_avatar,
              score: entry.score || 0,
              right_answer: entry.right_answer || 0,
              wrong_answer: entry.wrong_answer || 0,
            }),
          );

          const finalizedStudents = (historyData.data || []).map(
            (entry: any) => ({
              id: entry.id,
              quiz_student_id: entry.quiz_student_id,
              student_name: entry.student_name,
              student_email: entry.student_email,
              student_avatar: entry.student_avatar,
              score: entry.score || 0,
              right_answer: entry.right_answer || 0,
              wrong_answer: entry.wrong_answer || 0,
            }),
          );

          // Deduplicate: prioritize finalized students over ongoing ones
          // (in case a student appears in both due to timing)
          const studentMap = new Map<string, LeaderboardEntry>();

          // First add ongoing students
          ongoingStudents.forEach((student) => {
            studentMap.set(student.quiz_student_id, student);
          });

          // Then add finalized students (will overwrite if duplicate)
          finalizedStudents.forEach((student) => {
            studentMap.set(student.quiz_student_id, student);
          });

          // Convert map to array and sort by score (placement is determined by array index)
          const combinedData = Array.from(studentMap.values()).sort(
            (a, b) => b.score - a.score,
          );

          console.log(
            `📊 Scheduled quiz leaderboard: ${ongoingStudents.length} ongoing, ${finalizedStudents.length} finalized, ${combinedData.length} total`,
          );
          setLeaderboardData(combinedData);
        } else if (isFinalized) {
          // For finalized live quizzes, fetch from quiz_history
          if (sessionId) {
            const { data, error } = await supabase
              .from("quiz_history")
              .select("*")
              .eq("class_code", classId)
              .eq("session_id", sessionId)
              .order("score", { ascending: false });

            if (error) throw error;
            // Map quiz_history to LeaderboardEntry format
            const mappedData = (data || []).map((entry: any) => ({
              id: entry.id,
              quiz_student_id: entry.quiz_student_id,
              student_name: entry.student_name,
              student_email: entry.student_email,
              student_avatar: entry.student_avatar,
              score: entry.score || 0,
              right_answer: entry.right_answer || 0,
              wrong_answer: entry.wrong_answer || 0,
            }));
            setLeaderboardData(mappedData);
          }
        } else {
          // For active live quizzes (status: "in game"), fetch from quiz_students
          // Filter by session_id to avoid showing stale data from previous sessions
          if (sessionId) {
            const { data, error } = await supabase
              .from("quiz_students")
              .select("*")
              .eq("class_code", classId)
              .eq("session_id", sessionId)
              .order("score", { ascending: false });

            if (error) throw error;
            setLeaderboardData(data || []);
          } else {
            // No session started yet - show empty leaderboard
            setLeaderboardData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching initial leaderboard data:", error);
        toast.error("Failed to fetch leaderboard");
      }
    };

    const setupRealtimeSubscription = async () => {
      const quizInfo = await checkQuizStatus();
      const { isFinalized, isScheduledQuiz } = quizInfo;

      if (isScheduledQuiz) {
        // For scheduled quizzes, subscribe to both quiz_students (ongoing) and quiz_history (finalized)
        // Use optimistic updates for better performance instead of refetching all data
        subscription = supabase
          .channel(`scheduled-quiz-leaderboard:${classId}`)
          .on(
            "postgres_changes",
            {
              event: "*", // Listen to INSERT, UPDATE, DELETE
              schema: "public",
              table: "quiz_students",
              filter: `class_code=eq.${classId}`,
            },
            (payload) => {
              console.log(
                "📊 Quiz students update received:",
                payload.eventType,
              );

              // Optimistic update - update state directly without refetching
              setLeaderboardData((currentData: LeaderboardEntry[]) => {
                let updatedData = [...currentData];

                if (payload.eventType === "DELETE") {
                  // Remove student from ongoing list (likely moved to quiz_history)
                  updatedData = updatedData.filter(
                    (item) => item.id !== (payload.old as any).id,
                  );
                } else if (payload.eventType === "INSERT") {
                  // Add new student
                  const newEntry = payload.new as any;
                  updatedData.push({
                    id: newEntry.id,
                    quiz_student_id: newEntry.quiz_student_id,
                    student_name: newEntry.student_name,
                    student_email: newEntry.student_email,
                    student_avatar: newEntry.student_avatar,
                    score: newEntry.score || 0,
                    right_answer: newEntry.right_answer || 0,
                    wrong_answer: newEntry.wrong_answer || 0,
                  });
                } else if (payload.eventType === "UPDATE") {
                  // Update existing student
                  const updatedEntry = payload.new as any;
                  const index = updatedData.findIndex(
                    (item) => item.id === updatedEntry.id,
                  );

                  if (index !== -1) {
                    updatedData[index] = {
                      ...updatedData[index],
                      score: updatedEntry.score || 0,
                      right_answer: updatedEntry.right_answer || 0,
                      wrong_answer: updatedEntry.wrong_answer || 0,
                    };
                  }
                }

                // Sort by score (placement is determined by array index)
                updatedData.sort((a, b) => b.score - a.score);

                return updatedData;
              });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "quiz_history",
              filter: `class_code=eq.${classId}`,
            },
            (payload) => {
              console.log("📊 Quiz history INSERT - student finalized");

              // Optimistic update - add to leaderboard or update if already exists
              setLeaderboardData((currentData: LeaderboardEntry[]) => {
                const newEntry = payload.new as any;
                const updatedData = [...currentData];

                // Check if student already exists (replace with finalized version)
                const existingIndex = updatedData.findIndex(
                  (item) => item.quiz_student_id === newEntry.quiz_student_id,
                );

                const finalizedEntry: LeaderboardEntry = {
                  id: newEntry.id,
                  quiz_student_id: newEntry.quiz_student_id,
                  student_name: newEntry.student_name,
                  student_email: newEntry.student_email,
                  student_avatar: newEntry.student_avatar,
                  score: newEntry.score || 0,
                  right_answer: newEntry.right_answer || 0,
                  wrong_answer: newEntry.wrong_answer || 0,
                };

                if (existingIndex !== -1) {
                  // Replace ongoing entry with finalized entry
                  updatedData[existingIndex] = finalizedEntry;
                } else {
                  // Add new finalized entry
                  updatedData.push(finalizedEntry);
                }

                // Sort by score (placement is determined by array index)
                updatedData.sort((a, b) => b.score - a.score);

                return updatedData;
              });
            },
          )
          .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
              console.log("✅ Scheduled quiz realtime subscription connected");
            } else if (status === "CHANNEL_ERROR") {
              console.error("❌ Realtime subscription error:", err);
              toast.error("Live updates disconnected. Retrying...");
              retryTimeout = setTimeout(() => {
                console.log("🔄 Retrying realtime subscription...");
                setupRealtimeSubscription();
              }, 3000);
            }
          });
      } else if (isFinalized) {
        // Subscribe to quiz_history for finalized live quizzes
        subscription = supabase
          .channel(`public:quiz_history:class_code=eq.${classId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "quiz_history",
              filter: `class_code=eq.${classId}`,
            },
            () => {
              console.log("📊 Quiz history update received - refreshing data");
              fetchInitialData(); // Refresh entire dataset
            },
          )
          .subscribe();
      } else {
        // Subscribe to quiz_students for active live quizzes
        // Use optimistic updates for real-time performance
        subscription = supabase
          .channel(`public:quiz_students:class_code=eq.${classId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "quiz_students",
              filter: `class_code=eq.${classId}`,
            },
            (payload) => {
              console.log(
                "📊 Live quiz leaderboard update:",
                payload.eventType,
              );

              // Optimistic update - update state directly without refetching
              setLeaderboardData((currentData: LeaderboardEntry[]) => {
                let updatedData = [...currentData];

                if (payload.eventType === "DELETE") {
                  // Remove student from leaderboard
                  updatedData = updatedData.filter(
                    (item) => item.id !== (payload.old as any).id,
                  );
                } else if (payload.eventType === "INSERT") {
                  // Add new student
                  const newEntry = payload.new as LeaderboardEntry;
                  updatedData.push(newEntry);
                } else if (payload.eventType === "UPDATE") {
                  // Update existing student
                  const updatedEntry = payload.new as LeaderboardEntry;
                  const index = updatedData.findIndex(
                    (item) => item.id === updatedEntry.id,
                  );

                  if (index !== -1) {
                    updatedData[index] = updatedEntry;
                  } else {
                    // Student not found, add them
                    updatedData.push(updatedEntry);
                  }
                }

                // Sort by score (placement is determined by array index)
                updatedData.sort((a, b) => b.score - a.score);

                return updatedData;
              });
            },
          )
          .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
              console.log("✅ Realtime subscription connected successfully");
            } else if (status === "CHANNEL_ERROR") {
              console.error("❌ Realtime subscription error:", err);
              toast.error("Live updates disconnected. Retrying...");
              retryTimeout = setTimeout(() => {
                console.log("🔄 Retrying realtime subscription...");
                setupRealtimeSubscription();
              }, 3000);
            } else if (status === "TIMED_OUT") {
              console.error("⏱️ Realtime subscription timed out");
              toast.error("Connection timed out. Refreshing...");
              fetchInitialData();
            }
          });
      }

      // Subscribe to quiz status changes to detect finalization
      quizStatusSubscription = supabase
        .channel(`quiz-status:${classId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "quiz",
            filter: `class_code=eq.${classId}`,
          },
          (payload) => {
            const newStatus = (payload.new as any).status;
            console.log("🔄 Quiz status changed:", newStatus);
            // Refresh data when status changes (especially for scheduled quizzes)
            fetchInitialData();
            // Re-subscribe if needed
            if (subscription) {
              supabase.removeChannel(subscription);
            }
            setupRealtimeSubscription();
          },
        )
        .subscribe();
    };

    if (classId) {
      fetchInitialData();
      setupRealtimeSubscription();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      if (quizStatusSubscription) {
        supabase.removeChannel(quizStatusSubscription);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [classId]);

  return leaderboardData;
}

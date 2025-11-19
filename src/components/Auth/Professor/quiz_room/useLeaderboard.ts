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

    // Check if quiz is finalized (scheduled-completed or active)
    const checkQuizStatus = async (): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from("quiz")
          .select("status, quiz_id")
          .eq("class_code", classId)
          .single();

        if (error || !data) return false;

        // Check if quiz is finalized
        return (
          data.status === "scheduled-completed" ||
          data.status === "active" ||
          data.status === "in game"
        );
      } catch (error) {
        console.error("Error checking quiz status:", error);
        return false;
      }
    };

    const fetchInitialData = async () => {
      try {
        const isFinalized = await checkQuizStatus();

        if (isFinalized) {
          // Fetch from quiz_history for finalized quizzes
          const { data: quizData } = await supabase
            .from("quiz")
            .select("quiz_id, current_session_id")
            .eq("class_code", classId)
            .single();

          if (quizData?.current_session_id) {
            const { data, error } = await supabase
              .from("quiz_history")
              .select("*")
              .eq("class_code", classId)
              .eq("session_id", quizData.current_session_id)
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
              placement: entry.placement || 0,
            }));
            setLeaderboardData(mappedData);
          }
        } else {
          // Fetch from quiz_students for active quizzes
          const { data, error } = await supabase
            .from("quiz_students")
            .select("*")
            .eq("class_code", classId)
            .order("score", { ascending: false });

          if (error) throw error;
          setLeaderboardData(data || []);
        }
      } catch (error) {
        console.error("Error fetching initial leaderboard data:", error);
        toast.error("Failed to fetch leaderboard");
      }
    };

    const setupRealtimeSubscription = async () => {
      const isFinalized = await checkQuizStatus();

      if (isFinalized) {
        // Subscribe to quiz_history for finalized quizzes
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
        // Subscribe to quiz_students for active quizzes
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
              console.log("📊 Leaderboard update received:", payload);
              setLeaderboardData((currentData: LeaderboardEntry[]) => {
                let updatedData = [...currentData];
                const index = updatedData.findIndex(
                  (item) => item.id === (payload.new as LeaderboardEntry).id,
                );

                if (index !== -1) {
                  updatedData[index] = payload.new as LeaderboardEntry;
                } else {
                  updatedData.push(payload.new as LeaderboardEntry);
                }

                updatedData.sort((a, b) => b.score - a.score);
                updatedData = updatedData.map((entry, index) => ({
                  ...entry,
                  placement: index + 1,
                }));

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
            if (
              newStatus === "scheduled-completed" ||
              newStatus === "active"
            ) {
              console.log("🔄 Quiz finalized - refreshing leaderboard from history");
              fetchInitialData();
              // Re-subscribe to quiz_history
              if (subscription) {
                supabase.removeChannel(subscription);
              }
              setupRealtimeSubscription();
            }
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

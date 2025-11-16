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

    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from("quiz_students")
          .select("*")
          .eq("class_code", classId)
          .order("score", { ascending: false });

        if (error) throw error;
        setLeaderboardData(data || []);
      } catch (error) {
        console.error("Error fetching initial leaderboard data:", error);
        toast.error("Failed to fetch leaderboard");
      }
    };

    const setupRealtimeSubscription = () => {
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
                // Update existing entry
                updatedData[index] = payload.new as LeaderboardEntry;
              } else {
                // Add new entry
                updatedData.push(payload.new as LeaderboardEntry);
              }

              // Sort and update placements
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

            // Retry connection after 3 seconds
            retryTimeout = setTimeout(() => {
              console.log("🔄 Retrying realtime subscription...");
              setupRealtimeSubscription();
            }, 3000);
          } else if (status === "TIMED_OUT") {
            console.error("⏱️ Realtime subscription timed out");
            toast.error("Connection timed out. Refreshing...");
            fetchInitialData(); // Fallback to polling
          } else {
            console.log("🔌 Subscription status:", status);
          }
        });
    };

    if (classId) {
      fetchInitialData();
      setupRealtimeSubscription();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [classId]);

  return leaderboardData;
}

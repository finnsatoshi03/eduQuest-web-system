/* eslint-disable @typescript-eslint/no-explicit-any */
import ClassAccuracy from "../quiz_room/class-accuracy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "../quiz_room/leaderboard";
import LiveQuestionChart from "../quiz_room/live-question-chart";
import LeaderboardChart from "../quiz_room/leaderboard-trend-chart";
import { useState, useEffect } from "react";
import { useLeaderboard } from "../quiz_room/useLeaderboard";
import { useParams } from "react-router-dom";
import { calculateClassAccuracy } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle } from "lucide-react";
import { exportQuizResultsToExcel } from "@/services/api/apiExport";
import { finalizeScheduledQuiz } from "@/services/api/apiScheduledQuiz";
import toast from "react-hot-toast";
import supabase from "@/services/supabase";
import { QUIZ_STATUS } from "@/lib/constants/quizStatus";

export default function Responses() {
  const { classId } = useParams();
  const leaderboardData = useLeaderboard(classId!);
  const classAccuracy = calculateClassAccuracy(leaderboardData);
  const [activeTab, setActiveTab] = useState("leaderboards");
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [quizStatus, setQuizStatus] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);

  // Check quiz status on mount and subscribe to status changes
  useEffect(() => {
    if (!classId) return;

    const checkQuizStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("quiz")
          .select("status, current_session_id")
          .eq("class_code", classId)
          .single();

        if (!error && data) {
          setQuizStatus(data.status);
          // CRITICAL: Scheduled quizzes are finalized when status is SCHEDULED_COMPLETED
          setIsFinalized(data.status === QUIZ_STATUS.SCHEDULED_COMPLETED);
        }
      } catch (error) {
        console.error("Error checking quiz status:", error);
      }
    };

    checkQuizStatus();

    // Subscribe to quiz status changes for realtime updates
    const channel = supabase
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
          console.log("📊 Quiz status update received:", payload);
          const newStatus = (payload.new as any).status;
          setQuizStatus(newStatus);
          setIsFinalized(newStatus === QUIZ_STATUS.SCHEDULED_COMPLETED);

          // If finalized, refresh leaderboard data
          if (newStatus === QUIZ_STATUS.SCHEDULED_COMPLETED) {
            toast.success("Quiz finalized! Results are now available.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  const handleFinalize = async () => {
    if (!classId) {
      toast.error("No class code found");
      return;
    }

    setIsFinalizing(true);
    const loadingToast = toast.loading("Finalizing quiz...");

    try {
      await finalizeScheduledQuiz(classId);
      setIsFinalized(true);
      setQuizStatus(QUIZ_STATUS.SCHEDULED_COMPLETED);
      toast.success(
        "Quiz finalized successfully! Results are now in student dashboards.",
        { id: loadingToast },
      );

      // The useLeaderboard hook will automatically detect finalization
      // and refresh data from quiz_history via realtime subscription
    } catch (error) {
      console.error("Error finalizing quiz:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to finalize quiz. Please try again.",
        { id: loadingToast },
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExport = async () => {
    if (!classId) {
      toast.error("No class code found");
      return;
    }

    // If quiz is not finalized yet, prompt to finalize first
    // Scheduled quizzes remain SCHEDULED until finalized (status becomes SCHEDULED_COMPLETED)
    if (
      !isFinalized &&
      (quizStatus === QUIZ_STATUS.SCHEDULED ||
        quizStatus === QUIZ_STATUS.IN_GAME)
    ) {
      toast.error("Please finalize the quiz before exporting results.", {
        duration: 4000,
      });
      return;
    }

    setIsExporting(true);
    const loadingToast = toast.loading("Exporting quiz results...");

    try {
      // Fetch quiz ID from class code
      const { data: quizData, error } = await supabase
        .from("quiz")
        .select("quiz_id")
        .eq("class_code", classId)
        .single();

      if (error || !quizData) {
        throw new Error("Quiz not found");
      }

      await exportQuizResultsToExcel(quizData.quiz_id, classId);
      toast.success("Quiz results exported successfully!", {
        id: loadingToast,
      });
    } catch (error) {
      console.error("Error exporting quiz results:", error);
      toast.error("Failed to export quiz results", { id: loadingToast });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-8 text-center ${
        activeTab === "live-chart"
          ? "h-[calc(100vh+20rem)] sm:h-full"
          : "h-full"
      }`}
    >
      <div className="absolute left-0 top-6 flex items-center gap-2">
        {/* Show finalize button when quiz is SCHEDULED and has students */}
        {/* Scheduled quizzes stay SCHEDULED until finalized (status becomes SCHEDULED_COMPLETED) */}
        {!isFinalized &&
          (quizStatus === QUIZ_STATUS.SCHEDULED ||
            quizStatus === QUIZ_STATUS.SCHEDULED_IN_GAME) && (
            <Button
              onClick={handleFinalize}
              disabled={
                isFinalizing || !leaderboardData || leaderboardData.length === 0
              }
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              {isFinalizing ? "Finalizing..." : "Finalize Quiz"}
            </Button>
          )}
        {isFinalized && (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Quiz Finalized
          </span>
        )}
        <Button
          onClick={handleExport}
          disabled={
            isExporting || !leaderboardData || leaderboardData.length === 0
          }
          className="flex items-center gap-2"
          title={
            !isFinalized &&
            (quizStatus === QUIZ_STATUS.SCHEDULED ||
              quizStatus === QUIZ_STATUS.IN_GAME)
              ? "Finalize quiz before exporting"
              : "Export results to Excel"
          }
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>
      <div className="flex w-full items-center justify-between">
        <ClassAccuracy accuracy={classAccuracy} />
      </div>

      <div className="w-full">
        <Tabs
          defaultValue="leaderboards"
          className="w-full"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList>
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            <TabsTrigger value="live-chart">Live Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="leaderboards" className="w-full">
            <Leaderboard leaderboardData={leaderboardData} />
          </TabsContent>
          <TabsContent value="live-chart">
            <div className="grid w-full gap-4 sm:grid-cols-2">
              <LeaderboardChart leaderboardData={leaderboardData} />
              <LiveQuestionChart leaderboardData={leaderboardData} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

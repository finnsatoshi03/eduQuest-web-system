/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import React, { useEffect, useState } from "react";
import { LeaderboardEntry, QuizQuestions } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProgressBar from "@/components/Shared/progressbar";
import Leaderboard from "./leaderboard";
import LeaderboardTrendChart from "./leaderboard-trend-chart";
import LiveQuestionChart from "./live-question-chart";
import ClassAccuracy from "./class-accuracy";
import { sendEndGame, sendExitLeaderboard } from "@/services/api/apiRoom";
import { X, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { exportQuizResultsToExcel } from "@/services/api/apiExport";
import toast from "react-hot-toast";
import supabase from "@/services/supabase";

interface GameSessionProps {
  currentQuestion: QuizQuestions;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  questions: QuizQuestions[];
  timeLeft: number;
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  leaderboardData: LeaderboardEntry[];
  classAccuracy: number;
  classId: string;
  setGameStart: React.Dispatch<React.SetStateAction<boolean>>;
}

const GameSession: React.FC<GameSessionProps> = ({
  currentQuestion,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  questions,
  timeLeft,
  setTimeLeft,
  leaderboardData,
  classAccuracy,
  classId,
  setGameStart,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("leaderboards");
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false); // Guard against double-finalization
  const [isFinalizingQuiz, setIsFinalizingQuiz] = useState(false); // Loading state during finalization

  useEffect(() => {
    if (timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prevTime) => Math.max(prevTime - 1, 0));
      }, 1000);
      return () => clearInterval(interval);
    }
    if (timeLeft === 0) {
      setTimeout(() => {
        handleNextQuestion();
        sendExitLeaderboard(classId);
      }, 10000);
    }
  }, [timeLeft, classId]);

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      // More questions remaining - advance to next
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      const nextQuestion = questions[nextIndex];
      setTimeLeft(nextQuestion.time);
    } else {
      // CRITICAL FIX: Last question finished - finalize IMMEDIATELY
      // This ensures quiz history is written BEFORE showing results modal
      await finalizeQuiz();
    }
  };

  /**
   * Finalizes the quiz by writing history, broadcasting events, and cleaning up.
   * This is the SINGLE SOURCE OF TRUTH for quiz finalization.
   * Called automatically when the last question ends.
   */
  const finalizeQuiz = async () => {
    // Guard against double-finalization
    if (isFinalized) {
      console.warn("⚠️ Quiz already finalized. Skipping duplicate finalization.");
      return;
    }

    console.log("🎯 Finalizing quiz...");
    setIsFinalized(true);
    setIsFinalizingQuiz(true);

    // Show loading toast
    const finalizingToast = toast.loading("Saving quiz results...");

    try {
      // STEP 1: Run atomic finalization (writes history, clears temp tables)
      const success = await sendEndGame(classId);

      if (!success) {
        console.error("❌ Quiz finalization failed!");
        toast.error("Failed to save quiz results. Please try again.", {
          id: finalizingToast,
        });
        setIsFinalized(false); // Allow retry
        setIsFinalizingQuiz(false);
        return;
      }

      console.log("✅ Quiz finalized successfully");
      toast.success("Quiz results saved successfully!", {
        id: finalizingToast,
      });

      // STEP 2: Show results modal to professor
      // IMPORTANT: Do NOT call setGameStart(false) here!
      // That would force navigation back to waiting lobby.
      // Professor should stay on this screen to review results.
      setIsGameEnded(true);
      setIsFinalizingQuiz(false);

      // At this point:
      // ✅ Quiz history is written
      // ✅ Students can see results in dashboard
      // ✅ Export is ready
      // ✅ Professor sees results modal
      // ✅ Professor STAYS on this screen (no forced navigation)
    } catch (error) {
      console.error("❌ Exception during finalization:", error);
      toast.error("Error finalizing quiz. Results may not be saved.", {
        id: finalizingToast,
      });
      setIsFinalized(false); // Allow retry
      setIsFinalizingQuiz(false);
    }
  };

  /**
   * Handles closing the results modal.
   * This is PURELY a UI action - NO backend operations.
   * Finalization already happened in finalizeQuiz().
   * This is the ONLY place where professor manually exits the quiz session.
   */
  const closeResultsModal = () => {
    console.log("📊 Professor manually closing results screen");

    // Now that professor is explicitly exiting, reset game state
    // This will cause parent component to unmount GameSession
    setGameStart(false);

    // Navigate to dashboard
    navigate("/professor/dashboard");
  };

  const handleExport = async () => {
    if (!classId) {
      toast.error("No class code found");
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
      {/* Loading Overlay During Finalization */}
      {isFinalizingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-8 text-center shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
            <h3 className="mb-2 text-xl font-bold">Finalizing Quiz</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Saving results and preparing dashboard...
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              This will only take a moment
            </p>
          </div>
        </div>
      )}

      {isGameEnded && (
        <div className="fixed left-6 top-24 z-10 flex gap-2 md:left-12 lg:left-16">
          <button
            className="rounded-md bg-slate-500 bg-opacity-10 p-1.5 hover:bg-opacity-20"
            onClick={closeResultsModal}
            title="Close and return to dashboard"
          >
            <X />
          </button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting || !leaderboardData || leaderboardData.length === 0
            }
            className="flex items-center gap-2"
            size="sm"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      )}
      <ClassAccuracy accuracy={classAccuracy} />
      {!isGameEnded && (
        <div className="w-full">
          <div className="flex w-full items-center justify-between">
            <h1 className="mb-4 text-2xl font-bold">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h1>
            <p className="text-xl font-bold">
              {currentQuestion?.points} point
              {currentQuestion?.points! > 1 && "s"}
            </p>
          </div>
          <div className="mb-4 w-full">
            <ProgressBar
              progress={(timeLeft / (currentQuestion?.time || 30)) * 100}
              height={24}
            />
          </div>
        </div>
      )}
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
              <LeaderboardTrendChart leaderboardData={leaderboardData} />
              <LiveQuestionChart
                currentQuestionIndex={currentQuestionIndex}
                questions={questions}
                leaderboardData={leaderboardData}
              />
            </div>
          </TabsContent>
        </Tabs>
        {!isGameEnded && (
          <div className="mt-4 text-lg font-bold">
            Time Left: {timeLeft} seconds
          </div>
        )}
      </div>
    </div>
  );
};

export default GameSession;

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useTheme } from "@/contexts/ThemeProvider";
import { useMediaQuery } from "react-responsive";
import { QuizQuestions, LeaderboardEntry } from "@/lib/types";
import { useQuizAnswer } from "@/hooks/useQuizAnswer";

// Components
import ProgressBar from "@/components/Shared/progressbar";
import GameForm from "../quiz_room/game-form";
import Summary from "../quiz_room/summary";
import LoadingSpinner from "../quiz_room/loader";
import QuestionHeader from "../quiz_room/question-header";
import QuestionContent from "../quiz_room/question-content";
import AnswerStatus from "../quiz_room/answer-status";
import FullScreenButton from "../quiz_room/full-screen";
import Leaderboard from "../quiz_room/leaderboard";

// Assets
import soundCorrect from "/sounds/correct-answer.mp3";
import soundWrong from "/sounds/wrong-answer.mp3";
import {
  getQuestionsForScheduledQuiz,
  updateQuizTaken,
  finalizeStudentAttempt,
  updateScheduledQuizLeaderboard,
} from "@/services/api/apiScheduledQuiz";
import { getQuizById } from "@/services/api/apiQuiz";
import { shuffleArray } from "@/lib/helpers";
import supabase from "@/services/supabase";
import toast from "react-hot-toast";

// Types
type EffectType = "correct" | "wrong" | "noAnswer" | null;

interface ScheduledQuizLobbyProps {
  quizId: string;
  classCode: string;
  onComplete: () => void;
}

const ScheduledQuizLobby: React.FC<ScheduledQuizLobbyProps> = ({
  quizId,
  classCode,
  onComplete,
}) => {
  // Routing and Auth
  const { user } = useAuth();

  // Quiz State
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [rightAns, setRightAns] = useState(0);
  const [wrongAns, setWrongAns] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestions[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [effect, setEffect] = useState<EffectType>(null);
  const [userAccuracy, setUserAccuracy] = useState(0);
  const [userRank, setUserRank] = useState(0);
  const [isNoTimeQuiz, setIsNoTimeQuiz] = useState(false);
  const [shuffleSettings, setShuffleSettings] = useState({
    shuffleQuestions: false,
    shuffleOptions: false,
  });
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    [],
  );
  const [answeredQuestions, setAnsweredQuestions] = useState<
    {
      question: string;
      userAnswer: string;
      correctAnswer: string;
    }[]
  >([]);
  const [isResultsPending, setIsResultsPending] = useState(true);

  // Answer State
  const [answerInput, setAnswerInput] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Display Name State
  const [displayName, setDisplayName] = useState<string | null>(
    localStorage.getItem("displayName"),
  );
  const [displayNameRequired, setDisplayNameRequired] = useState(!displayName);

  // Refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const correctSound = useRef(new Audio(soundCorrect));
  const wrongSound = useRef(new Audio(soundWrong));

  // Theme and Responsive
  const { theme } = useTheme();
  const isTabletOrMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const currentQuestion = questions[currentQuestionIndex];

  // Answer submission hook
  const { submitAnswerAsync } = useQuizAnswer({ quizType: "scheduled" });

  // Fetch quiz settings and questions
  useEffect(() => {
    const fetchQuizAndQuestions = async () => {
      setIsLoading(true);
      try {
        // First get the quiz settings
        const quiz = await getQuizById(quizId);
        setIsNoTimeQuiz(quiz?.no_time || false);
        setShuffleSettings({
          shuffleQuestions: quiz?.shuffle || false,
          shuffleOptions: quiz?.shuffle || false,
        });

        // Then get the questions
        const fetchedQuestions = await getQuestionsForScheduledQuiz(classCode);

        const processedQuestions = quiz?.shuffle
          ? shuffleArray(fetchedQuestions)
          : fetchedQuestions;

        setQuestions(processedQuestions);

        // Only set timeLeft if it's not a no_time quiz
        if (fetchedQuestions.length > 0 && !quiz?.no_time) {
          setTimeLeft(fetchedQuestions[0].time);
        }
      } catch (error) {
        console.error("Error fetching quiz data:", error);
      }
      setIsLoading(false);
    };

    fetchQuizAndQuestions();
  }, [classCode, quizId]);

  // Subscribe to quiz status changes to detect finalization
  useEffect(() => {
    if (!classCode) return;

    const channel = supabase
      .channel(`quiz-status-student:${classCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz",
          filter: `class_code=eq.${classCode}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          console.log("📊 Quiz status update received:", newStatus);

          // If quiz is finalized, update pending status
          if (newStatus === "scheduled-completed" || newStatus === "active") {
            setIsResultsPending(false);
            // Optionally show a notification
            console.log("✅ Quiz finalized! Results are now available.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classCode]);

  // Timer effect - only run if not a no_time quiz
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (timeLeft > 0 && !hasAnswered && !isNoTimeQuiz) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = Math.max(prevTime - 1, 0);
          if (newTime === 0) {
            handleNoAnswer();
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, hasAnswered, isNoTimeQuiz]);

  const handleNoAnswer = async () => {
    // Only handle no answer for timed quizzes
    if (!isNoTimeQuiz && !hasAnswered && currentQuestion && user) {
      setHasAnswered(true);
      setWrongAns((prev) => prev + 1);
      setEffect("noAnswer");
      wrongSound.current.play();

      setAnsweredQuestions([
        ...answeredQuestions,
        {
          question: currentQuestion.question,
          userAnswer: "No answer (timeout)",
          correctAnswer: currentQuestion.right_answer,
        },
      ]);

      const newAccuracy = (rightAns / (currentQuestionIndex + 1)) * 100;
      setUserAccuracy(newAccuracy);

      // Auto-submit unanswered question with proper error handling
      try {
        await submitAnswerAsync({
          questionId: currentQuestion.quiz_question_id,
          studentId: user.id,
          answer: "", // Empty answer for timeout
          quizId: quizId,
          classCode: classCode,
          timeTaken: currentQuestion.time || 0, // Max time for timeout
        });
        console.log(
          "✅ Scheduled quiz timeout answer auto-submitted successfully",
        );
      } catch (error) {
        console.error(
          "❌ Failed to auto-submit scheduled quiz timeout answer:",
          error,
        );
        // Continue with quiz flow even if submission fails
        // The error is logged for debugging but won't block progression
      }

      setTimeout(handleNextQuestion, 2000);
    }
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      // Only set timeLeft if it's not a no_time quiz
      if (!isNoTimeQuiz) {
        setTimeLeft(questions[currentQuestionIndex + 1].time);
      }
      setHasAnswered(false);
      setSelectedAnswer(null);
      setAnswerInput([]);
      setEffect(null);
    } else {
      const finalScore = score;
      const finalRightAns = rightAns;
      const finalWrongAns = wrongAns;
      await finishQuiz(finalScore, finalRightAns, finalWrongAns);
    }
  };

  const finishQuiz = async (
    finalScore: number,
    finalRightAns: number,
    finalWrongAns: number,
  ) => {
    if (classCode && user) {
      try {
        // CRITICAL: Use scheduled quiz-specific leaderboard update
        // This ensures session_id exists before updating quiz_students
        const finalLeaderboard = await updateScheduledQuizLeaderboard(
          classCode,
          user.id,
          user.name || displayName || "",
          user.avatar,
          user.email,
          finalScore,
          finalRightAns,
          finalWrongAns,
        );

        // Update quiz_taken status after successful leaderboard update
        await updateQuizTaken({ classCode, userId: user.id });

        setScore(finalScore);
        setRightAns(finalRightAns);
        setWrongAns(finalWrongAns);
        setLeaderboardData(finalLeaderboard || []);

        const userIndex =
          finalLeaderboard?.findIndex(
            (entry) => entry.quiz_student_id === user.id,
          ) ?? -1;
        setUserRank(userIndex + 1);

        // Check if quiz is finalized to determine if results are pending
        let resultsPending = true;
        try {
          const { data: quizStatusData } = await supabase
            .from("quiz")
            .select("status, current_session_id")
            .eq("class_code", classCode)
            .single();

          // Results are pending if quiz is not yet finalized
          resultsPending =
            quizStatusData?.status !== "scheduled-completed" &&
            quizStatusData?.status !== "active";

          setIsResultsPending(resultsPending);

          // CRITICAL: Finalize student's attempt to ensure it appears in history
          // This copies data from quiz_students → quiz_history
          // Only finalize if quiz_students insert was successful
          console.log("🔄 Finalizing student attempt for scheduled quiz...");
          await finalizeStudentAttempt(classCode, user.id);
          console.log(
            "✅ Student attempt finalized - data will appear in dashboard",
          );

          // CRITICAL: After finalization, fetch leaderboard from quiz_history
          // because quiz_students record is deleted after finalization
          // Combine both quiz_students (ongoing) and quiz_history (finalized) for complete view
          const sessionId = quizStatusData?.current_session_id;

          if (sessionId) {
            const [ongoingStudents, finalizedStudents] = await Promise.all([
              // Get ongoing attempts from quiz_students
              supabase
                .from("quiz_students")
                .select("*")
                .eq("class_code", classCode)
                .eq("session_id", sessionId)
                .order("score", { ascending: false }),
              // Get finalized attempts from quiz_history
              supabase
                .from("quiz_history")
                .select("*")
                .eq("class_code", classCode)
                .eq("session_id", sessionId)
                .order("score", { ascending: false }),
            ]);

            // Combine and deduplicate (prioritize finalized over ongoing)
            const studentMap = new Map<string, LeaderboardEntry>();

            // Add ongoing students first
            (ongoingStudents.data || []).forEach(
              (entry: {
                id: string;
                quiz_student_id: string;
                student_name: string;
                student_email: string;
                student_avatar: string;
                score: number;
                right_answer: number;
                wrong_answer: number;
              }) => {
                studentMap.set(entry.quiz_student_id, {
                  id: entry.id,
                  quiz_student_id: entry.quiz_student_id,
                  student_name: entry.student_name,
                  student_email: entry.student_email,
                  student_avatar: entry.student_avatar,
                  score: entry.score || 0,
                  right_answer: entry.right_answer || 0,
                  wrong_answer: entry.wrong_answer || 0,
                });
              },
            );

            // Add finalized students (will overwrite if duplicate)
            (finalizedStudents.data || []).forEach(
              (entry: {
                id: string;
                quiz_student_id: string;
                student_name: string;
                student_email: string;
                student_avatar: string;
                score: number;
                right_answer: number;
                wrong_answer: number;
              }) => {
                studentMap.set(entry.quiz_student_id, {
                  id: entry.id,
                  quiz_student_id: entry.quiz_student_id,
                  student_name: entry.student_name,
                  student_email: entry.student_email,
                  student_avatar: entry.student_avatar,
                  score: entry.score || 0,
                  right_answer: entry.right_answer || 0,
                  wrong_answer: entry.wrong_answer || 0,
                });
              },
            );

            // Sort by score
            const combinedLeaderboard = Array.from(studentMap.values()).sort(
              (a, b) => b.score - a.score,
            );

            setLeaderboardData(combinedLeaderboard);

            // Update user rank
            const userIndex = combinedLeaderboard.findIndex(
              (entry) => entry.quiz_student_id === user.id,
            );
            setUserRank(userIndex >= 0 ? userIndex + 1 : 0);
          }
        } catch (finalizeError) {
          console.error(
            "❌ Failed to finalize student attempt:",
            finalizeError,
          );
          // Check if it's a duplicate key error (already finalized)
          if (
            finalizeError instanceof Error &&
            finalizeError.message.includes("23505")
          ) {
            console.log("✅ Student already finalized - skipping");
            // Still try to fetch from quiz_history
            try {
              const { data: quizSessionData } = await supabase
                .from("quiz")
                .select("current_session_id")
                .eq("class_code", classCode)
                .single();

              if (quizSessionData?.current_session_id) {
                const { data: historyData } = await supabase
                  .from("quiz_history")
                  .select("*")
                  .eq("class_code", classCode)
                  .eq("session_id", quizSessionData.current_session_id)
                  .order("score", { ascending: false });

                if (historyData) {
                  const mappedData = historyData.map(
                    (entry: {
                      id: string;
                      quiz_student_id: string;
                      student_name: string;
                      student_email: string;
                      student_avatar: string;
                      score: number;
                      right_answer: number;
                      wrong_answer: number;
                    }) => ({
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

                  setLeaderboardData(mappedData);
                  const userIndex = mappedData.findIndex(
                    (entry) => entry.quiz_student_id === user.id,
                  );
                  setUserRank(userIndex >= 0 ? userIndex + 1 : 0);
                }
              }
            } catch (fetchError) {
              console.error("Failed to fetch from quiz_history:", fetchError);
            }
          } else {
            // Log error but don't block UI - finalization can be retried
            console.warn(
              "⚠️ Finalization failed but student record exists in quiz_students",
            );
          }
        }
      } catch (error) {
        console.error("❌ Failed to update leaderboard:", error);
        // Show error to user but don't crash the UI
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save quiz results. Please contact your instructor.",
        );
        // Still show summary with local data
        setLeaderboardData([]);
        setUserRank(0);
        setIsResultsPending(true);
      }

      setShowLeaderboard(true);

      setTimeout(() => {
        setShowLeaderboard(false);
        setShowSummary(true);
      }, 8000);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion || !user || hasAnswered) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);

    // Calculate time taken (total time - remaining time)
    const timeTaken = (currentQuestion.time || 0) - timeLeft;

    const isCorrect = await submitAnswerAsync({
      questionId: currentQuestion.quiz_question_id,
      studentId: user.id,
      answer,
      quizId: quizId,
      classCode: classCode,
      timeTaken: timeTaken > 0 ? timeTaken : 0,
    });

    const newScore = score + (isCorrect ? currentQuestion.points || 0 : 0);
    const newRightAns = rightAns + (isCorrect ? 1 : 0);
    const newWrongAns = wrongAns + (isCorrect ? 0 : 1);

    setScore(newScore);
    setRightAns(newRightAns);
    setWrongAns(newWrongAns);

    if (isCorrect) {
      setEffect("correct");
      correctSound.current.play();
    } else {
      setEffect("wrong");
      wrongSound.current.play();
    }

    setAnsweredQuestions([
      ...answeredQuestions,
      {
        question: currentQuestion.question,
        userAnswer: answer,
        correctAnswer: currentQuestion.right_answer,
      },
    ]);

    const newAccuracy = (newRightAns / (currentQuestionIndex + 1)) * 100;
    setUserAccuracy(newAccuracy);

    setTimeout(() => {
      if (currentQuestionIndex === questions.length - 1) {
        finishQuiz(newScore, newRightAns, newWrongAns);
      } else {
        handleNextQuestion();
      }
    }, 2000);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading quiz..." />;
  }

  if (displayNameRequired) {
    return (
      <GameForm
        classId={classCode!}
        user={user ? { ...user, role: user.role || "" } : null}
        setDisplayNameRequired={setDisplayNameRequired}
        setDisplayName={setDisplayName}
        setJoined={() => false}
      />
    );
  }

  if (showLeaderboard && user) {
    return (
      <>
        <FullScreenButton />
        <Leaderboard
          leaderboardData={leaderboardData}
          currentUserId={user.id}
        />
      </>
    );
  }

  if (showSummary) {
    return (
      <>
        <FullScreenButton />
        <Summary
          score={score}
          rightAns={rightAns}
          wrongAns={wrongAns}
          totalQuestions={questions.length}
          totalParticipants={leaderboardData.length}
          accuracy={userAccuracy}
          rank={userRank}
          questions={answeredQuestions}
          onFinish={onComplete}
          isScheduledQuiz={true}
          isResultsPending={isResultsPending}
        />
      </>
    );
  }

  return (
    <>
      <FullScreenButton />
      <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center text-center">
        <QuestionHeader
          questionNumber={currentQuestionIndex + 1}
          points={currentQuestion.points!}
        />

        {!isNoTimeQuiz && (
          <div className="mb-4 w-full">
            <ProgressBar
              progress={(timeLeft / currentQuestion.time) * 100}
              height={24}
            />
          </div>
        )}

        <QuestionContent
          question={currentQuestion.question}
          questionType={currentQuestion.question_type}
          distractor={currentQuestion.distractor}
          rightAnswer={currentQuestion.right_answer}
          isTabletOrMobile={isTabletOrMobile}
          theme={theme}
          hasAnswered={hasAnswered}
          selectedAnswer={selectedAnswer}
          effect={effect}
          handleAnswer={handleAnswer}
          answerInput={answerInput}
          setAnswerInput={setAnswerInput}
          inputRefs={inputRefs}
          shuffleOptions={shuffleSettings.shuffleOptions}
        />

        <AnswerStatus
          hasAnswered={hasAnswered}
          effect={effect}
          timeLeft={isNoTimeQuiz ? null : timeLeft}
        />
      </div>
    </>
  );
};

export default ScheduledQuizLobby;

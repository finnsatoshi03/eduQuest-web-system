import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useTheme } from "@/contexts/ThemeProvider";
import { useMediaQuery } from "react-responsive";
import { QuizQuestions, LeaderboardEntry } from "@/lib/types";
import { updateLeaderBoard } from "@/services/api/apiRoom";
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
} from "@/services/api/apiScheduledQuiz";
import { getQuizById } from "@/services/api/apiQuiz";
import { shuffleArray } from "@/lib/helpers";

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
        console.log("✅ Scheduled quiz timeout answer auto-submitted successfully");
      } catch (error) {
        console.error("❌ Failed to auto-submit scheduled quiz timeout answer:", error);
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
      await updateQuizTaken({ classCode, userId: user.id });

      const finalLeaderboard = await updateLeaderBoard(
        classCode,
        user.id,
        user.name || displayName || "",
        user.avatar,
        user.email,
        finalScore,
        finalRightAns,
        finalWrongAns,
      );

      setScore(finalScore);
      setRightAns(finalRightAns);
      setWrongAns(finalWrongAns);
      setLeaderboardData(finalLeaderboard || []);

      const userIndex =
        finalLeaderboard?.findIndex(
          (entry) => entry.quiz_student_id === user.id,
        ) ?? -1;
      setUserRank(userIndex + 1);

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

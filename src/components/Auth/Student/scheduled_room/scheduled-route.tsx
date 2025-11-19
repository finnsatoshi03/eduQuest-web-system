import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ScheduledQuizLobby from "./room";
import { useGame } from "@/contexts/GameProvider";
import { ArrowLeft, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  checkQuizStatus,
  getQuizStudent,
  insertQuizStudent,
} from "@/services/api/apiScheduledQuiz";
import GameForm from "../quiz_room/game-form";
import { formatUTCToLocalDisplay } from "@/lib/helpers";
import toast from "react-hot-toast";

interface QuizData {
  title: string;
  openTime: string;
  closeTime: string;
  classCode: string;
}

interface QuizStatus {
  isLoading: boolean;
  hasTaken: boolean;
  canRetake: boolean;
  error: string | null;
}

// Separate component for quiz status message
const QuizStatusMessage: React.FC<{ status: string }> = ({ status }) => (
  <div className="flex flex-col gap-4">
    <p className="text-red-600">{status}</p>
    <div className="flex flex-col space-y-3">
      <Button
        onClick={() => (window.location.href = "/")}
        variant="outline"
        className="w-full"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Return to Dashboard
      </Button>
    </div>
  </div>
);

// Separate component for scheduled quiz info display
const ScheduledQuizInfo: React.FC<{
  quizData: QuizData;
  quizStatus: QuizStatus;
  onStartQuiz: () => void;
  isStarting?: boolean;
}> = ({ quizData, quizStatus, onStartQuiz, isStarting = false }) => {
  const [timeUntilOpen, setTimeUntilOpen] = React.useState<number>(0);
  const [countdown, setCountdown] = React.useState<string>("");

  const now = new Date();
  const openDate = new Date(quizData.openTime);
  const closeDate = new Date(quizData.closeTime);
  const isQuizOpen = now >= openDate && now <= closeDate;

  // Countdown timer effect
  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const openTime = new Date(quizData.openTime);
      const diff = openTime.getTime() - now.getTime();

      if (diff > 0) {
        setTimeUntilOpen(diff);

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setCountdown(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}m ${seconds}s`);
        } else {
          setCountdown(`${seconds}s`);
        }
      } else {
        setTimeUntilOpen(0);
        setCountdown("");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [quizData.openTime]);

  if (quizStatus.isLoading) {
    return <div className="text-center">Checking quiz status...</div>;
  }

  if (quizStatus.error) {
    return <QuizStatusMessage status={quizStatus.error} />;
  }

  if (quizStatus.hasTaken && !quizStatus.canRetake) {
    return (
      <QuizStatusMessage status="You have already taken this quiz and retakes are not allowed." />
    );
  }

  // Determine quiz status badge
  const getStatusBadge = () => {
    if (isQuizOpen) {
      return (
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Active
        </span>
      );
    } else if (now < openDate) {
      return (
        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Scheduled
        </span>
      );
    } else {
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Ended
        </span>
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 text-center">
      <Calendar className="h-8 w-8 text-indigo-500" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold text-indigo-500">{quizData.title}</h1>
        {getStatusBadge()}
      </div>
      <div className="space-y-2">
        <p className="text-gray-600">
          Opens: {formatUTCToLocalDisplay(quizData.openTime)}
        </p>
        <p className="text-gray-600">
          Closes: {formatUTCToLocalDisplay(quizData.closeTime)}
        </p>
      </div>
      {isQuizOpen ? (
        <div className="flex flex-col gap-2">
          {quizStatus.hasTaken && quizStatus.canRetake && (
            <p className="text-yellow-600">
              You have already taken this quiz, but retakes are allowed.
            </p>
          )}
          <Button onClick={onStartQuiz} className="mt-4" disabled={isStarting}>
            {isStarting
              ? "Starting..."
              : quizStatus.hasTaken
                ? "Retake Quiz"
                : "Start Quiz"}
          </Button>
        </div>
      ) : now < openDate ? (
        <div className="flex flex-col gap-4">
          {countdown && (
            <div className="rounded-lg bg-indigo-50 p-6 dark:bg-indigo-900/20">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Quiz opens in:
              </p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {countdown}
              </p>
            </div>
          )}
          <QuizStatusMessage
            status={`This quiz will be available starting ${formatUTCToLocalDisplay(quizData.openTime)}.`}
          />
        </div>
      ) : (
        <QuizStatusMessage
          status={`This quiz has ended. It closed at ${formatUTCToLocalDisplay(quizData.closeTime)}.`}
        />
      )}
    </div>
  );
};

const ScheduledQuizRoute: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [displayNameRequired, setDisplayNameRequired] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [quizStatus, setQuizStatus] = useState<QuizStatus>({
    isLoading: true,
    hasTaken: false,
    canRetake: false,
    error: null,
  });

  const location = useLocation();
  const navigate = useNavigate();
  const { classId } = useParams();
  const { setGameStarted } = useGame();
  const { user } = useAuth();

  const { quiz_id, title, openTime, closeTime } = location.state || {};

  useEffect(() => {
    const checkNameRequirement = async () => {
      if (!classId || !user) {
        setQuizStatus((prev) => ({
          ...prev,
          isLoading: false,
          error: "Missing required information",
        }));
        setIsInitializing(false);
        return;
      }

      try {
        // First check if user already exists in quiz_students
        const existingStudent = await getQuizStudent(classId, user.id);

        if (!existingStudent && !user.name) {
          setDisplayNameRequired(true);
          setQuizStatus((prev) => ({
            ...prev,
            isLoading: false,
          }));
        } else {
          const status = await checkQuizStatus(classId, user, displayName);
          setQuizStatus({
            isLoading: false,
            hasTaken: status.hasTaken,
            canRetake: status.canRetake,
            error: null,
          });
        }
      } catch (error) {
        setQuizStatus({
          isLoading: false,
          hasTaken: false,
          canRetake: false,
          error: error instanceof Error ? error.message : "An error occurred",
        });
      }

      setIsInitializing(false);
    };

    checkNameRequirement();
  }, [classId, user]);

  if (!title || !openTime || !closeTime || !classId) {
    navigate("/student/dashboard");
    return null;
  }

  const quizData = {
    title,
    openTime,
    closeTime,
    classCode: classId,
  };

  const handleFormSuccess = async (name: string) => {
    if (!user || !classId) return;

    try {
      const status = await checkQuizStatus(classId, user, name);
      setDisplayNameRequired(false);
      setDisplayName(name);
      setQuizStatus({
        isLoading: false,
        hasTaken: status.hasTaken,
        canRetake: status.canRetake,
        error: null,
      });
    } catch (error) {
      setQuizStatus((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "An error occurred",
      }));
    }
  };

  if (isInitializing) {
    return <div className="text-center">Loading...</div>;
  }

  if (displayNameRequired) {
    return (
      <GameForm
        classId={classId}
        user={user ? { ...user, role: user.role || "" } : null}
        setJoined={() => {}}
        setDisplayNameRequired={setDisplayNameRequired}
        setDisplayName={handleFormSuccess}
      />
    );
  }

  const handleStartQuiz = async () => {
    if (!user || !classId || isStartingQuiz) return;

    setIsStartingQuiz(true);
    try {
      // Check if student already exists in quiz_students
      const existingStudent = await getQuizStudent(classId, user.id);

      // If student doesn't exist, insert them (this will ensure session exists and validate time window)
      if (!existingStudent) {
        await insertQuizStudent(user, classId, displayName || user.name);
        console.log("Student successfully enrolled in scheduled quiz");
      }

      // Start the quiz
      setShowQuiz(true);
      setGameStarted(true);
    } catch (error) {
      console.error("Error starting quiz:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to start quiz. Please try again.";
      toast.error(errorMessage);
      setIsStartingQuiz(false);
    }
  };

  const handleComplete = () => {
    navigate("/student/dashboard");
    setGameStarted(false);
  };

  if (showQuiz) {
    return (
      <ScheduledQuizLobby
        quizId={quiz_id}
        classCode={classId}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <div className="flex h-[calc(100%-5rem)] items-center justify-center">
      <ScheduledQuizInfo
        quizData={quizData}
        quizStatus={quizStatus}
        onStartQuiz={handleStartQuiz}
        isStarting={isStartingQuiz}
      />
    </div>
  );
};

export default ScheduledQuizRoute;

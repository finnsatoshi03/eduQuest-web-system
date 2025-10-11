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
} from "@/services/api/apiScheduledQuiz";
import GameForm from "../quiz_room/game-form";

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
}> = ({ quizData, quizStatus, onStartQuiz }) => {
  const now = new Date();
  const openDate = new Date(quizData.openTime);
  const closeDate = new Date(quizData.closeTime);
  const isQuizOpen = now >= openDate && now <= closeDate;

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

  return (
    <div className="flex flex-col items-center justify-center space-y-6 text-center">
      <Calendar className="h-8 w-8 text-indigo-500" />
      <h1 className="text-3xl font-bold text-indigo-500">{quizData.title}</h1>
      <div className="space-y-2">
        <p className="text-gray-600">
          Opens: {new Date(quizData.openTime).toLocaleString()}
        </p>
        <p className="text-gray-600">
          Closes: {new Date(quizData.closeTime).toLocaleString()}
        </p>
      </div>
      {isQuizOpen ? (
        <div className="flex flex-col gap-2">
          {quizStatus.hasTaken && quizStatus.canRetake && (
            <p className="text-yellow-600">
              You have already taken this quiz, but retakes are allowed.
            </p>
          )}
          <Button onClick={onStartQuiz} className="mt-4">
            {quizStatus.hasTaken ? "Retake Quiz" : "Start Quiz"}
          </Button>
        </div>
      ) : now < openDate ? (
        <QuizStatusMessage status="Quiz has not opened yet" />
      ) : (
        <QuizStatusMessage status="Quiz has closed" />
      )}
    </div>
  );
};

const ScheduledQuizRoute: React.FC = () => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [displayNameRequired, setDisplayNameRequired] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
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

  const handleStartQuiz = () => {
    setShowQuiz(true);
    setGameStarted(true);
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
      />
    </div>
  );
};

export default ScheduledQuizRoute;

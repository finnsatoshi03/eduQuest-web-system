import React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Loader from "@/components/Shared/Loader";
import {
  Calendar,
  Clock,
  Copy,
  EllipsisVertical,
  FileQuestion,
  Loader2,
  Play,
  Plus,
  Trash,
  XCircle,
  AlertCircle,
  UsersRound,
  Pen,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/helpers";
import { useAuth } from "@/contexts/AuthProvider";
import { useGetQuizzes } from "../useGetQuizzes";
import {
  createQuiz,
  deleteQuiz,
  updateQuizStatus,
} from "@/services/api/apiQuiz";
import { Quiz, User } from "@/lib/types";
import toast from "react-hot-toast";
import { useProfessorOverallStats } from "@/hooks/useProfessorAnalytics";
import OverallStatsCards from "./Dashboard/OverallStatsCards";
import { QUIZ_STATUS, QuizStatus } from "@/lib/constants/quizStatus";

interface QuizCardProps {
  quiz: Quiz;
  user: User;
  onEdit: (quizId: string) => void;
  onDelete: (quizId: string) => void;
  nav: ReturnType<typeof useNavigate>;
}

const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  user,
  onEdit,
  onDelete,
  nav,
}) => {
  const { mutate: mutateQuizStatus, isPending: isLoading } = useMutation({
    mutationFn: ({
      quizId,
      status,
    }: {
      quizId: string;
      status: QuizStatus;
    }) => updateQuizStatus(quizId, status),
    onError: (error) => {
      toast.error(`Failed to update quiz status: ${error.message}`);
    },
  });

  const handleCopyCode = () => {
    if (quiz.class_code) {
      navigator.clipboard
        .writeText(quiz.class_code)
        .then(() => toast.success("Quiz code copied to clipboard!"))
        .catch(() =>
          toast.error("Failed to copy quiz code. Please try again."),
        );
    } else {
      toast.error("No quiz code available.");
    }
  };

  const handleStartGame = () => {
    nav(`professor/class/${quiz.class_code}/gamelobby`);
    mutateQuizStatus({ quizId: quiz.quiz_id, status: QUIZ_STATUS.IN_LOBBY });
  };

  const handleResponses = () =>
    nav(`professor/class/${quiz.class_code}/responses`);

  const handleGoLobby = () => {
    nav(`professor/class/${quiz.class_code}/gamelobby`);
  };

  const getQuizTimeStatus = () => {
    if (!quiz.open_time || quiz.status !== QUIZ_STATUS.SCHEDULED) return null;

    const startTime = new Date(quiz.open_time);
    const endTime = quiz.close_time ? new Date(quiz.close_time) : null;
    const currentTime = new Date();

    if (endTime && currentTime > endTime) {
      return "closed";
    }

    if (currentTime > startTime) {
      return "ready";
    }

    return "upcoming";
  };

  const getRemainingTime = () => {
    if (!quiz.close_time || quiz.status !== QUIZ_STATUS.SCHEDULED) return null;

    const endTime = new Date(quiz.close_time);
    const currentTime = new Date();
    const timeRemaining = endTime.getTime() - currentTime.getTime();

    if (timeRemaining <= 0) return "Closed";

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor(
      (timeRemaining % (1000 * 60 * 60)) / (1000 * 60),
    );

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  };

  const formatScheduledTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeStatus = getQuizTimeStatus();
  const remainingTime = getRemainingTime();

  return (
    <div className="my-2 flex gap-4 rounded border p-3">
      <img
        src={quiz.cover_image || "/quiz-royale-logo.png"}
        alt={quiz.title}
        className={`hidden h-28 object-cover md:block ${!quiz.cover_image && "rounded bg-zinc-100 p-2 dark:bg-zinc-800"}`}
      />
      <div className="flex flex-grow flex-col justify-between">
        <div className="space-y-1">
          <p
            className={`w-fit rounded-full px-2 text-[0.6rem] font-semibold uppercase ${
              quiz.status === QUIZ_STATUS.DRAFT
                ? "bg-red-300 text-red-700"
                : quiz.status === QUIZ_STATUS.SCHEDULED && timeStatus === "closed"
                  ? "bg-gray-300 text-gray-700"
                  : quiz.status === QUIZ_STATUS.SCHEDULED
                    ? "bg-yellow-300 text-yellow-700"
                    : quiz.status === QUIZ_STATUS.IN_GAME
                      ? "bg-blue-300 text-blue-700"
                      : "bg-green-300 text-green-700"
            }`}
          >
            {timeStatus === "closed" ? "Closed" : quiz.status}
          </p>
          <h3 className="text-lg font-bold">{quiz.title}</h3>
          <div className="flex items-center gap-1 text-xs opacity-60 md:text-sm">
            <FileQuestion className="size-4 md:size-5" />
            <p>
              {quiz.quiz_questions?.length ?? 0} Question
              {quiz.quiz_questions?.length !== 1 ? "s" : ""}
              {quiz.subject && (
                <span className="italic"> • {quiz.subject}</span>
              )}
            </p>
          </div>
          {quiz.status === QUIZ_STATUS.SCHEDULED && quiz.open_time && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="size-4" />
                <span
                  className={
                    timeStatus === "closed"
                      ? "text-gray-600"
                      : "text-yellow-600"
                  }
                >
                  {timeStatus === "closed"
                    ? "Was available from: "
                    : "Starts: "}
                  {formatScheduledTime(quiz.open_time)}
                </span>
              </div>
              {quiz.close_time && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="size-4" />
                  <span
                    className={
                      timeStatus === "closed"
                        ? "text-gray-600"
                        : "text-yellow-600"
                    }
                  >
                    Ends: {formatScheduledTime(quiz.close_time)}
                  </span>
                </div>
              )}
              {timeStatus === "ready" && remainingTime && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <AlertCircle className="size-4" />
                  {remainingTime}
                </div>
              )}
              {timeStatus === "closed" && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <XCircle className="size-4" />
                  Quiz period has ended
                </span>
              )}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs opacity-50 sm:mt-3">
          <span className="font-default font-semibold">{user?.name}</span> •{" "}
          {formatTimeAgo(new Date(quiz.created_at))}
        </p>
      </div>
      <div className="flex flex-col items-end justify-between gap-1">
        <Popover>
          <PopoverTrigger>
            <EllipsisVertical size={18} />
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="h-fit w-fit p-0">
            <Button
              variant="link"
              className="gap-1"
              onClick={() => onDelete(quiz.quiz_id)}
            >
              <Trash size={16} />
              Delete
            </Button>
          </PopoverContent>
        </Popover>
        <div className="flex flex-col items-end gap-1">
          {quiz.status === QUIZ_STATUS.ACTIVE && (
            <>
              <Button
                variant="outline"
                className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                onClick={() => onEdit(quiz.quiz_id)}
              >
                <Pen size={14} />
                Edit Quiz
              </Button>
              <Button
                className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                onClick={handleStartGame}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play size={14} />
                    Start Game
                  </>
                )}
              </Button>
            </>
          )}
          {quiz.status === QUIZ_STATUS.SCHEDULED && (
            <>
              {timeStatus === "upcoming" ? (
                <Button
                  variant="outline"
                  className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                  onClick={() => onEdit(quiz.quiz_id)}
                >
                  <Pen size={14} />
                  Edit Quiz
                </Button>
              ) : (
                <Button
                  className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                  onClick={handleResponses}
                >
                  <UsersRound size={14} />
                  Check Responses
                </Button>
              )}
            </>
          )}
          {quiz.status === QUIZ_STATUS.IN_LOBBY && (
            <Button
              className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
              onClick={handleGoLobby}
            >
              <Play size={14} />
              Go to Lobby
            </Button>
          )}
          {quiz.status === QUIZ_STATUS.IN_GAME && (
            <Button
              className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
              onClick={handleGoLobby}
            >
              <Play size={14} />
              Rejoin Game
            </Button>
          )}
          {quiz.status === QUIZ_STATUS.DRAFT ? (
            <Button className="w-fit" onClick={() => onEdit(quiz.quiz_id)}>
              Continue editing
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="h-fit gap-1 text-xs md:h-full md:text-sm"
              onClick={handleCopyCode}
              disabled={timeStatus === "closed"}
            >
              <Copy size={14} />
              Copy Quiz Code
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ProfessorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { quizzes = [], isPending, isError } = useGetQuizzes();
  const {
    data: overallStats,
    isLoading: isLoadingStats,
  } = useProfessorOverallStats(user?.id);

  const safeQuizzes: Quiz[] = Array.isArray(quizzes) ? quizzes : [quizzes];

  // Filter quizzes by status
  const activeQuizzes = safeQuizzes.filter((quiz) => quiz.status === QUIZ_STATUS.ACTIVE);
  const scheduledQuizzes = safeQuizzes.filter(
    (quiz) => quiz.status === QUIZ_STATUS.SCHEDULED,
  );
  const draftQuizzes = safeQuizzes.filter((quiz) => quiz.status === QUIZ_STATUS.DRAFT);
  const inLobbyQuizzes = safeQuizzes.filter(
    (quiz) => quiz.status === QUIZ_STATUS.IN_LOBBY || quiz.status === QUIZ_STATUS.IN_GAME,
  );

  const { mutate: createNewQuiz, isPending: isCreatingQuiz } = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("User is not authenticated");
      return createQuiz(user.id);
    },
    onSuccess: (data) => {
      if (data) navigate(`/professor/quiz/${data.quiz_id}/generate-quiz`);
    },
    onError: (error) => {
      toast.error(`Failed to create quiz: ${error.message}`);
    },
  });

  const { mutate: mutateDeleteQuiz } = useMutation({
    mutationFn: (quizId: string) => deleteQuiz(user!.id, quizId),
    onSuccess: () => {
      toast.success("Quiz deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["quizzes", user!.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isPending) return <Loader />;
  if (isError) return <p>Error loading quizzes.</p>;

  return (
    <div className="p-4">
      {/* Analytics Overview Section */}
      {!isLoadingStats && overallStats && (
        <div className="mb-6">
          <h2 className="mb-4 text-2xl font-bold">Dashboard Overview</h2>
          <OverallStatsCards stats={overallStats} />
        </div>
      )}

      {/* Quiz Management Tabs */}
      <Tabs defaultValue="active-quizzes">
        <div className="flex justify-between">
          <TabsList>
            <TabsTrigger value="active-quizzes">
              Active ({activeQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="scheduled-quizzes">
              Scheduled ({scheduledQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="lobbied-quizzes">
              Started ({inLobbyQuizzes.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              Drafts ({draftQuizzes.length})
            </TabsTrigger>
          </TabsList>
          <Button
            onClick={() => createNewQuiz()}
            className="gap-1 px-3 md:hidden"
            disabled={isCreatingQuiz}
          >
            {isCreatingQuiz ? (
              "Creating..."
            ) : (
              <>
                <Plus size={16} /> Create Quiz
              </>
            )}
          </Button>
        </div>
        <TabsContent value="active-quizzes">
          {activeQuizzes.length > 0 ? (
            activeQuizzes.map((quiz: Quiz) => (
              <QuizCard
                key={quiz.quiz_id}
                quiz={quiz}
                user={user!}
                onEdit={() =>
                  navigate(`/professor/quiz/${quiz.quiz_id}/customize`)
                }
                onDelete={mutateDeleteQuiz}
                nav={navigate}
              />
            ))
          ) : (
            <p>No active quizzes available.</p>
          )}
        </TabsContent>
        <TabsContent value="lobbied-quizzes">
          {inLobbyQuizzes.length > 0 ? (
            inLobbyQuizzes.map((quiz: Quiz) => (
              <QuizCard
                key={quiz.quiz_id}
                quiz={quiz}
                user={user!}
                onEdit={() =>
                  navigate(`/professor/quiz/${quiz.quiz_id}/customize`)
                }
                onDelete={mutateDeleteQuiz}
                nav={navigate}
              />
            ))
          ) : (
            <p>No started quizzes available.</p>
          )}
        </TabsContent>
        <TabsContent value="scheduled-quizzes">
          {scheduledQuizzes.length > 0 ? (
            scheduledQuizzes.map((quiz: Quiz) => (
              <QuizCard
                key={quiz.quiz_id}
                quiz={quiz}
                user={user!}
                onEdit={() =>
                  navigate(`/professor/quiz/${quiz.quiz_id}/customize`)
                }
                onDelete={mutateDeleteQuiz}
                nav={navigate}
              />
            ))
          ) : (
            <p>No scheduled quizzes available.</p>
          )}
        </TabsContent>
        <TabsContent value="draft">
          {draftQuizzes.length > 0 ? (
            draftQuizzes.map((quiz: Quiz) => (
              <QuizCard
                key={quiz.quiz_id}
                quiz={quiz}
                user={user!}
                onEdit={() =>
                  navigate(`/professor/quiz/${quiz.quiz_id}/customize`)
                }
                onDelete={mutateDeleteQuiz}
                nav={navigate}
              />
            ))
          ) : (
            <p>No draft quizzes available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

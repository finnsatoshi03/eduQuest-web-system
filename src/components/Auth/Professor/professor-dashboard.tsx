import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Files,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/helpers";
import { useAuth } from "@/contexts/AuthProvider";
import { useGetQuizzes } from "../useGetQuizzes";
import {
  createQuiz,
  deleteQuiz,
  updateQuizStatus,
  cloneQuiz,
} from "@/services/api/apiQuiz";
import { startScheduledQuiz } from "@/services/api/apiScheduledQuiz";
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
  onClone: (quizId: string) => void;
  nav: ReturnType<typeof useNavigate>;
}

const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  user,
  onEdit,
  onDelete,
  onClone,
  nav,
}) => {
  const queryClient = useQueryClient();

  const { mutate: mutateQuizStatus, isPending: isLoading } = useMutation({
    mutationFn: ({ quizId, status }: { quizId: string; status: QuizStatus }) =>
      updateQuizStatus(quizId, status),
    onSuccess: () => {
      // Invalidate queries to refresh dashboard with updated status
      queryClient.invalidateQueries({ queryKey: ["quizzes", user.id] });
    },
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

  const handleStartScheduledQuiz = async () => {
    if (!quiz.class_code || !user?.id) return;

    try {
      await startScheduledQuiz(quiz.class_code, user.id);
      toast.success("Scheduled quiz started successfully!");

      // Invalidate queries to refresh dashboard with updated status
      queryClient.invalidateQueries({ queryKey: ["quizzes", user.id] });

      // Navigate to responses page where professor can monitor student progress
      nav(`professor/class/${quiz.class_code}/responses`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start scheduled quiz",
      );
    }
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
            className={`w-fit rounded-full px-2 text-[0.6rem] font-semibold uppercase ${quiz.status === QUIZ_STATUS.DRAFT
                ? "bg-red-300 text-red-700"
                : (quiz.status === QUIZ_STATUS.SCHEDULED ||
                  quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
                  quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED) &&
                  timeStatus === "closed"
                  ? "bg-gray-300 text-gray-700"
                  : quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED
                    ? "bg-green-300 text-green-700"
                    : quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME
                      ? "bg-blue-300 text-blue-700"
                      : quiz.status === QUIZ_STATUS.SCHEDULED
                        ? "bg-yellow-300 text-yellow-700"
                        : quiz.status === QUIZ_STATUS.IN_GAME
                          ? "bg-blue-300 text-blue-700"
                          : "bg-green-300 text-green-700"
              }`}
          >
            {timeStatus === "closed"
              ? "Closed"
              : quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED
                ? "Scheduled (Completed)"
                : quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME
                  ? "In Progress"
                  : quiz.status}
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
          {(quiz.status === QUIZ_STATUS.SCHEDULED ||
            quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
            quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED) &&
            quiz.open_time && (
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
          <PopoverContent
            side="left"
            align="start"
            className="flex h-fit w-fit flex-col items-start p-0"
          >
            {quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED && (
              <Button
                variant="link"
                className="gap-1"
                onClick={() => onClone(quiz.quiz_id)}
              >
                <Files size={16} />
                Clone Quiz
              </Button>
            )}
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
          {(quiz.status === QUIZ_STATUS.SCHEDULED ||
            quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
            quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED) && (
              <>
                {quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED ? (
                  // Completed scheduled quiz - only show responses button
                  <Button
                    className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                    onClick={handleResponses}
                  >
                    <UsersRound size={14} />
                    View Results
                  </Button>
                ) : quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME ? (
                  // Scheduled quiz in progress - only show check responses
                  <Button
                    className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                    onClick={handleResponses}
                  >
                    <UsersRound size={14} />
                    Monitor Responses
                  </Button>
                ) : timeStatus === "upcoming" ? (
                  // Scheduled but not yet ready
                  <Button
                    variant="outline"
                    className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                    onClick={() => onEdit(quiz.quiz_id)}
                  >
                    <Pen size={14} />
                    Edit Quiz
                  </Button>
                ) : timeStatus === "ready" ? (
                  // Scheduled and ready to start
                  <>
                    <Button
                      className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                      onClick={handleStartScheduledQuiz}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play size={14} />
                          Start Quiz
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-fit w-fit gap-1 text-xs md:h-full md:text-sm"
                      onClick={handleResponses}
                    >
                      <UsersRound size={14} />
                      Check Responses
                    </Button>
                  </>
                ) : (
                  // Scheduled and in progress (timeStatus === "active")
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
  const { data: overallStats, isLoading: isLoadingStats } =
    useProfessorOverallStats(user?.id);

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [quizToClone, setQuizToClone] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const safeQuizzes: Quiz[] = Array.isArray(quizzes) ? quizzes : [quizzes];
  const allQuizzes = [...safeQuizzes].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Filter quizzes by status
  const activeQuizzes = allQuizzes.filter(
    (quiz) => quiz.status === QUIZ_STATUS.ACTIVE,
  );
  // CRITICAL: Include SCHEDULED, SCHEDULED_IN_GAME, and SCHEDULED_COMPLETED in scheduled tab
  // This keeps all scheduled quizzes (pending, in-progress, and completed) in the scheduled category
  const scheduledQuizzes = allQuizzes.filter(
    (quiz) =>
      quiz.status === QUIZ_STATUS.SCHEDULED ||
      quiz.status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
      quiz.status === QUIZ_STATUS.SCHEDULED_COMPLETED,
  );
  const draftQuizzes = allQuizzes.filter(
    (quiz) => quiz.status === QUIZ_STATUS.DRAFT,
  );
  const inLobbyQuizzes = allQuizzes.filter(
    (quiz) =>
      quiz.status === QUIZ_STATUS.IN_LOBBY ||
      quiz.status === QUIZ_STATUS.IN_GAME,
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

  const { mutate: mutateCloneQuiz, isPending: isCloningQuiz } = useMutation({
    mutationFn: (quizId: string) => {
      if (!user) throw new Error("User is not authenticated");
      return cloneQuiz(quizId, user.id);
    },
    onSuccess: (data) => {
      if (data) {
        toast.success(`Quiz cloned successfully as "${data.title}"!`);
        queryClient.invalidateQueries({ queryKey: ["quizzes", user!.id] });
        // Optionally redirect to edit the cloned quiz
        navigate(`/professor/quiz/${data.quiz_id}/customize`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to clone quiz: ${error.message}`);
    },
  });

  const handleCloneQuiz = (quizId: string, quizTitle: string) => {
    setQuizToClone({ id: quizId, title: quizTitle });
    setCloneDialogOpen(true);
  };

  const confirmCloneQuiz = () => {
    if (quizToClone) {
      mutateCloneQuiz(quizToClone.id);
      setCloneDialogOpen(false);
      setQuizToClone(null);
    }
  };

  const renderQuizList = (quizList: Quiz[], emptyMessage: string) => {
    if (quizList.length === 0) {
      return <p>{emptyMessage}</p>;
    }

    return quizList.map((quiz: Quiz) => (
      <QuizCard
        key={quiz.quiz_id}
        quiz={quiz}
        user={user!}
        onEdit={() => navigate(`/professor/quiz/${quiz.quiz_id}/customize`)}
        onDelete={mutateDeleteQuiz}
        onClone={() => handleCloneQuiz(quiz.quiz_id, quiz.title)}
        nav={navigate}
      />
    ));
  };

  if (isPending) return <Loader />;
  if (isError) return <p>Error loading quizzes.</p>;

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col overflow-hidden p-4">
      {/* Analytics Overview Section */}
      {!isLoadingStats && overallStats && (
        <div className="mb-6">
          <h2 className="mb-4 text-2xl font-bold">Dashboard Overview</h2>
          <OverallStatsCards stats={overallStats} />
        </div>
      )}

      {/* Quiz Management Tabs */}
      <Tabs defaultValue="all-quizzes" className="flex min-h-0 flex-1 flex-col">
        <div className="flex justify-between">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all-quizzes">
              All ({allQuizzes.length})
            </TabsTrigger>
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
        <TabsContent
          value="all-quizzes"
          className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2"
        >
          {renderQuizList(allQuizzes, "No quizzes available.")}
        </TabsContent>
        <TabsContent
          value="active-quizzes"
          className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2"
        >
          {renderQuizList(activeQuizzes, "No active quizzes available.")}
        </TabsContent>
        <TabsContent
          value="lobbied-quizzes"
          className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2"
        >
          {renderQuizList(inLobbyQuizzes, "No started quizzes available.")}
        </TabsContent>
        <TabsContent
          value="scheduled-quizzes"
          className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2"
        >
          {renderQuizList(scheduledQuizzes, "No scheduled quizzes available.")}
        </TabsContent>
        <TabsContent
          value="draft"
          className="mt-2 min-h-0 flex-1 overflow-y-auto pr-2"
        >
          {renderQuizList(draftQuizzes, "No draft quizzes available.")}
        </TabsContent>
      </Tabs>

      <AlertDialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="!text-black dark:!text-white">
              Clone Quiz for New Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to clone <strong>"{quizToClone?.title}"</strong> for a
              new session?
              <br />
              <br />
              This will create a copy of the quiz with all questions and
              settings. The cloned quiz will be in draft mode so you can edit it
              before scheduling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="!text-black dark:!text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloneQuiz}
              disabled={isCloningQuiz}
            >
              {isCloningQuiz ? "Cloning..." : "Clone Quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

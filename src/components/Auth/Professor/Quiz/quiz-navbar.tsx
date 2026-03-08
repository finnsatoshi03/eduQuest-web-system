import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Save, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
import QuizSettingsForm from "./quiz-settings-form";
import { useQuizData } from "./useQuizData";
import QuizPreviewDialog from "./question-preview-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateQuizAndQuestions, deleteQuiz } from "@/services/api/apiQuiz";
import toast from "react-hot-toast";
import Loader from "@/components/Shared/Loader";
import FeedbackState from "@/components/Shared/feedback-state";

export default function QuizNavbar() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const titleRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const queryClient = useQueryClient();

  const isGenerateQuizPage = location.pathname.endsWith("/generate-quiz");

  const {
    quiz,
    isLoading: isPending,
    isError,
    refetch,
    updateTitle,
    questions,
  } = useQuizData(quizId!);

  const saveMutation = useMutation({
    mutationFn: () => updateQuizAndQuestions(quizId!, quiz!, questions!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      toast.success("Quiz saved successfully");
      setSettingsOpen(false);
      navigate(`/professor/dashboard`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuiz(quiz!.owner_id, quizId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      toast.success("Quiz deleted successfully");
      navigate(`/professor/dashboard`);
    },
    onError: (error) => {
      toast.error("Failed to delete quiz: " + error.message);
    },
  });

  useEffect(() => {
    if (quiz) {
      setEditedTitle(quiz.title || "Untitled Quiz");
    }
  }, [quiz]);

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleBackNavigation = (e: PopStateEvent) => {
      if (isGenerateQuizPage) {
        e.preventDefault();
        setIsAlertOpen(true);
      }
    };

    if (isGenerateQuizPage) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", handleBackNavigation);

      return () => {
        window.removeEventListener("popstate", handleBackNavigation);
      };
    }
  }, [isGenerateQuizPage]);

  const handleTitleClick = () => setIsEditing(true);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (editedTitle !== quiz?.title) {
      updateTitle(editedTitle);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTitleBlur();
    }
  };

  const handleSave = () => {
    const errors: string[] = [];

    if (!quiz || !quiz.title) {
      errors.push("Title is required");
    }

    if (!quiz || !quiz.description) {
      errors.push("Description is required");
    }

    if (!quiz || !quiz.subject) {
      errors.push("Subject must be selected");
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      setSettingsOpen(true);
      return;
    }

    if (questions && questions.length > 0) {
      saveMutation.mutate();
    } else {
      toast.error("Quiz must have at least one question");
    }
  };

  const handleBackClick = () => {
    if (isGenerateQuizPage) {
      setIsAlertOpen(true);
    } else {
      navigate(-1);
    }
  };

  const handleBackNavigation = () => {
    setIsAlertOpen(false);
    if (isGenerateQuizPage && quiz && quizId) {
      deleteMutation.mutate();
    } else {
      navigate(-1);
    }
  };

  const handleCancelBackNavigation = () => {
    setIsAlertOpen(false);
    if (isGenerateQuizPage) {
      window.history.pushState(null, "", window.location.href);
    }
  };

  if (isPending) return <Loader />;
  if (isError) {
    return (
      <div className="px-6 py-4">
        <FeedbackState
          variant="error"
          title="Couldn't load quiz details"
          description="Retry loading this quiz, or go back to your dashboard."
          actions={[
            {
              label: "Retry",
              onClick: () => {
                void refetch();
              },
              variant: "default",
            },
            {
              label: "Back to dashboard",
              onClick: () => navigate("/professor/dashboard"),
              variant: "outline",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="-mx-6 flex w-screen flex-wrap items-center justify-between px-6 py-4 shadow-xl md:-mx-12 lg:-mx-16">
      <div className="flex items-center gap-4">
        <button onClick={handleBackClick}>
          <ChevronLeft className="rounded border p-1" />
        </button>
        {isEditing ? (
          <Input
            ref={titleRef}
            type="text"
            value={editedTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="rounded border px-2 py-1 dark:bg-zinc-800"
          />
        ) : (
          <h1
            onClick={handleTitleClick}
            className="cursor-pointer rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            {quiz?.title || "Untitled Quiz"}
          </h1>
        )}
      </div>
      <div className="mt-2 flex gap-2 sm:mt-0">
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button className="flex gap-1 text-xs" variant="outline">
              <Settings size={14} />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="dark:text-white">
            {quiz && (
              <QuizSettingsForm
                quiz={quiz}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
              />
            )}
          </DialogContent>
        </Dialog>
        <Button
          className="flex gap-1 text-xs"
          variant="secondary"
          onClick={() => setPreviewOpen(true)}
          disabled={!questions || questions.length === 0}
        >
          <Play size={14} />
          Preview
        </Button>
        <Button
          className="flex gap-1 text-xs"
          variant="default"
          onClick={handleSave}
          disabled={
            !questions || questions.length === 0 || saveMutation.isPending
          }
        >
          <Save size={14} />
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      <QuizPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />
      {isGenerateQuizPage && (
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent className="dark:text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Are you sure you want to go back?
              </AlertDialogTitle>
              <AlertDialogDescription>
                If you go back, your current quiz progress will be discarded and
                the quiz will be deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelBackNavigation}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleBackNavigation}>
                {deleteMutation.isPending
                  ? "Deleting..."
                  : "Delete and Go Back"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

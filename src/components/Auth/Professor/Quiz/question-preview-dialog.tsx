import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RectangleEllipsis,
  Scale,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuizData } from "./useQuizData";
import { formatQuestionType, questionTypeIcon } from "@/lib/helpers";
import { useTheme } from "@/contexts/ThemeProvider";
import { useMediaQuery } from "react-responsive";
import Loader from "@/components/Shared/Loader";
import { GAME_COLORS } from "@/lib/constants";
import DifficultyBadge from "@/components/Shared/difficulty-badge";

interface QuizPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuizQuestions {
  question: string;
  right_answer: string;
  distractor: string[];
  question_type: string;
  points: number;
  time: number;
  difficulty?: string;
}

const iconMapping = {
  Scale: Scale,
  Check: Check,
  RectangleEllipsis: RectangleEllipsis,
  HelpCircle: HelpCircle,
};

const QuizPreviewDialog = ({ open, onOpenChange }: QuizPreviewDialogProps) => {
  const { quizId } = useParams();
  const { quiz, questions, isLoading, isError } = useQuizData(quizId!);
  const [showAnswers, setShowAnswers] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const { theme } = useTheme();
  const isTabletorMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const isQuestionIncomplete = (question: QuizQuestions) => {
    return (
      !question.question ||
      !question.right_answer ||
      !question.distractor ||
      question.distractor.length === 0
    );
  };

  const completeQuestions = useMemo(() => {
    return questions
      ? questions.filter(
          (question) =>
            !isQuestionIncomplete({
              ...question,
              distractor: question.distractor || [],
              points: question.points ?? 0,
            }),
        )
      : [];
  }, [questions]);

  const currentQuestion = completeQuestions[currentQuestionIndex];

  const handlePrevQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((prev) =>
      prev < completeQuestions.length - 1 ? prev + 1 : prev,
    );
  };

  const renderMultipleChoice = () => {
    if (!currentQuestion) return null;

    return (
      <div
        className="mt-4 grid gap-2 rounded-lg"
        style={{
          gridTemplateColumns: isTabletorMobile
            ? `repeat(1, 1fr)`
            : `repeat(${currentQuestion.distractor?.length || 0}, 1fr)`,
        }}
      >
        {currentQuestion.distractor?.map((answer, index) => {
          const bgColor =
            theme === "dark"
              ? GAME_COLORS.dark[index % GAME_COLORS.dark.length]
              : GAME_COLORS.light[index % GAME_COLORS.light.length];
          const isCorrect = answer === currentQuestion.right_answer;

          return (
            <div
              key={index}
              className={`rounded-lg p-1 ${
                !showAnswers
                  ? "transition-transform duration-200 ease-in-out hover:translate-y-1"
                  : ""
              }`}
              style={{
                backgroundColor: isCorrect && showAnswers ? "#22c55e" : bgColor,
                color: "#fff",
                opacity: showAnswers && !isCorrect ? 0.5 : 1,
                filter: showAnswers && !isCorrect ? "grayscale(100%)" : "none",
              }}
            >
              <div className="mt-2 flex h-full items-center justify-center rounded-lg border-none p-2 text-lg">
                {answer}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTrueFalse = () => {
    if (!currentQuestion) return null;

    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["True", "False"].map((option) => (
          <div
            key={option}
            className={`rounded-lg p-4 ${
              showAnswers && currentQuestion.right_answer === option
                ? "bg-green-500"
                : showAnswers
                  ? "bg-purple-800 bg-opacity-20 opacity-50 grayscale"
                  : "bg-purple-800 bg-opacity-20"
            } ${
              !showAnswers
                ? "transition-transform duration-200 ease-in-out hover:translate-y-1"
                : ""
            } `}
          >
            {option}
          </div>
        ))}
      </div>
    );
  };

  const renderFillInTheBlank = () => {
    if (!currentQuestion) return null;

    const answerChars = Array.from(currentQuestion.right_answer ?? "");
    const wordCharGroups = (() => {
      const groups: number[][] = [];
      let currentGroup: number[] = [];

      answerChars.forEach((char, index) => {
        if (/\s/.test(char)) {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
            currentGroup = [];
          }
          return;
        }
        currentGroup.push(index);
      });

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      return groups;
    })();

    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-zinc-200 p-4 dark:bg-zinc-800">
        <h1 className="mb-4 text-center font-bold opacity-70">
          Type your answer in the boxes (spaces are already included)
        </h1>
        <div
          className="flex max-w-full flex-wrap justify-center gap-x-3 gap-y-2"
          style={{
            maxWidth: isTabletorMobile ? "18rem" : "32rem",
          }}
        >
          {wordCharGroups.map((group, groupIndex) => (
            <div
              key={`word-${groupIndex}`}
              className="flex shrink-0 items-center gap-1"
            >
              {group.map((charIndex) => (
                <div
                  key={charIndex}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-center text-base text-white sm:h-12 sm:w-12 ${
                    showAnswers ? "bg-green-500" : "bg-zinc-700"
                  }`}
                >
                  {showAnswers ? answerChars[charIndex] : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) return <Loader />;
  if (isError) return <div>Error loading quiz data</div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] min-w-[90vw] flex-col justify-between dark:text-white">
        <DialogHeader>
          <DialogTitle>{quiz?.title} - Preview (Student's View)</DialogTitle>
        </DialogHeader>
        <>
          {completeQuestions.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Question {currentQuestionIndex + 1} of{" "}
                  {completeQuestions.length}
                </span>
                <div className="flex items-center gap-2">
                  <p className="flex items-center gap-1 rounded bg-blue-300 bg-opacity-40 px-3 py-0.5 text-xs">
                    {React.createElement(
                      iconMapping[
                        questionTypeIcon(currentQuestion.question_type)
                      ],
                      { size: 12 },
                    )}{" "}
                    {formatQuestionType(currentQuestion.question_type)}
                  </p>
                  <DifficultyBadge difficulty={currentQuestion.difficulty} />
                </div>
                <p className="rounded border px-3 py-0.5 text-xs">
                  {currentQuestion.points} point
                  {currentQuestion.points !== 1 && "s"}
                </p>
              </div>
              <div className="grid flex-grow gap-4">
                <div className="flex items-center justify-center rounded-lg bg-zinc-200 p-4 text-xl font-semibold dark:bg-zinc-900">
                  {currentQuestion.question}
                </div>

                {currentQuestion.question_type.toLowerCase() === "mcq" &&
                  renderMultipleChoice()}
                {currentQuestion.question_type.toLowerCase() === "boolean" &&
                  renderTrueFalse()}
                {currentQuestion.question_type.toLowerCase() === "short" &&
                  renderFillInTheBlank()}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-answers"
                    checked={showAnswers}
                    onCheckedChange={setShowAnswers}
                  />
                  <Label htmlFor="show-answers">Show Answers</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handlePrevQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleNextQuestion}
                    disabled={
                      currentQuestionIndex === completeQuestions.length - 1
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div>
              No complete questions available. Please finish creating at least
              one question.
            </div>
          )}
        </>
      </DialogContent>
    </Dialog>
  );
};

export default QuizPreviewDialog;

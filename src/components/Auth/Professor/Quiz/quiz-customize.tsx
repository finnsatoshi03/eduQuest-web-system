import React, { useEffect, useState } from "react";
import {
  deleteQuestion,
  duplicateQuestion,
  updateBulkPointsAndTime,
  updateQuestionOrderAndDifficulty,
  updateQuestionOrder,
  updateSingleQuestion,
} from "@/services/api/apiQuiz";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuizQuestions } from "@/lib/types";
import { QuestionDifficulty } from "@/lib/types";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Scale,
  Check,
  RectangleEllipsis,
  HelpCircle,
  GripVertical,
  Trash,
  Pen,
  X,
  Copy,
  Plus,
  AlertTriangle,
  Info,
} from "lucide-react";
import { formatQuestionType, questionTypeIcon } from "@/lib/helpers";
import { useQuizData } from "./useQuizData";
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
import QuizTypeModal from "./quiz-type-modal";
import Loader from "@/components/Shared/Loader";
import DifficultyBadge from "@/components/Shared/difficulty-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SmartOrganizeMode = "sequential" | "grouped";

const DIFFICULTY_SEQUENCE: QuestionDifficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_WEIGHT: Record<QuestionDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};
const DEFAULT_TIME_OPTIONS = [10, 15, 20, 30, 60];

const iconMapping = {
  Scale: Scale,
  Check: Check,
  RectangleEllipsis: RectangleEllipsis,
  HelpCircle: HelpCircle,
};

function normalizeDifficulty(
  difficulty: string | undefined,
  index: number,
): QuestionDifficulty {
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty;
  }

  return DIFFICULTY_SEQUENCE[index % DIFFICULTY_SEQUENCE.length];
}

function applySequentialDifficulty(
  questions: QuizQuestions[],
): Array<QuizQuestions & { difficulty: QuestionDifficulty }> {
  return questions.map((question, index) => ({
    ...question,
    difficulty: DIFFICULTY_SEQUENCE[index % DIFFICULTY_SEQUENCE.length],
  }));
}

function getDynamicNumericOptions(
  defaultOptions: number[],
  currentValue?: number | null,
): number[] {
  const mergedOptions = new Set(defaultOptions);
  if (
    typeof currentValue === "number" &&
    Number.isFinite(currentValue) &&
    currentValue > 0
  ) {
    mergedOptions.add(Math.round(currentValue));
  }
  return Array.from(mergedOptions).sort((a, b) => a - b);
}

export default function CustomizeQuiz() {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const [questions, setQuestions] = useState<QuizQuestions[]>([]);
  const [bulkPoints, setBulkPoints] = useState<string>("1");
  const [bulkTime, setBulkTime] = useState<string>("30");
  const [customPoints, setCustomPoints] = useState<boolean>(false);
  const [customTime, setCustomTime] = useState<boolean>(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [questionTypeModalOpen, setQuestionTypeModalOpen] = useState(false);
  const [smartOrganizeMode, setSmartOrganizeMode] =
    useState<SmartOrganizeMode>("sequential");
  const [lastOrganizeSnapshot, setLastOrganizeSnapshot] = useState<
    QuizQuestions[] | null
  >(null);

  const queryClient = useQueryClient();

  const {
    questions: quizQuestionsData,
    isLoading: isPending,
    isError,
  } = useQuizData(quizId!);

  useEffect(() => {
    if (quizQuestionsData && Array.isArray(quizQuestionsData)) {
      const normalizedQuestions = quizQuestionsData
        .sort((a, b) => a.order - b.order)
        .map((question, index) => ({
          ...question,
          difficulty: normalizeDifficulty(question.difficulty, index),
        }));
      setQuestions(normalizedQuestions);
    } else {
      setQuestions([]);
    }
  }, [quizQuestionsData]);

  const { mutate: updateBulk, isPending: isUpdatingBulk } = useMutation({
    mutationFn: () => updateBulkPointsAndTime(quizId!, bulkPoints, bulkTime),
    onSuccess: () => {
      toast.success("Bulk update successful");
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
      queryClient.resetQueries({ queryKey: ["questions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { mutate: updateSingle } = useMutation({
    mutationFn: (params: {
      questionId: string;
      points?: string;
      time?: string;
    }) =>
      updateSingleQuestion(
        quizId!,
        params.questionId,
        params.points,
        params.time,
      ),
    onSuccess: () => {
      toast.success("Question updated successfully");
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { mutate: reorderQuestions } = useMutation({
    mutationFn: (newOrder: { id: string; order: number }[]) =>
      updateQuestionOrder(quizId!, newOrder),
    onSuccess: () => {
      toast.success("Question order updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update question order");
      console.error(error);
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] });
    },
  });

  const { mutate: updateQuestionOrganization, isPending: isOrganizing } =
    useMutation({
      mutationFn: (
        updates: {
          id: string;
          order: number;
          difficulty: QuestionDifficulty;
        }[],
      ) => updateQuestionOrderAndDifficulty(quizId!, updates),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
        toast.success("Questions organized by difficulty");
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to organize by difficulty");
        queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      },
    });

  const deleteMutation = useMutation({
    mutationFn: (questionId: string) => deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      toast.success("Question deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete question: ${error.message}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (questionId: string) => duplicateQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] });
      toast.success("Question duplicated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to duplicate question: ${error.message}`);
    },
  });

  const handleCreate = () => {
    setQuestionTypeModalOpen(true);
  };

  const handleDuplicate = (questionId: string) => {
    duplicateMutation.mutate(questionId);
  };

  const handleDelete = (questionId: string) => {
    setQuestionToDelete(questionId);
  };

  const confirmDelete = () => {
    if (questionToDelete) {
      deleteMutation.mutate(questionToDelete);
      setQuestionToDelete(null);
    }
  };

  const handleCustomInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (/^\d*$/.test(value)) {
      setter(value);
    }
  };

  const renderCustomInput = (
    placeholder: string,
    value: string,
    onChange: (value: string) => void,
    onReset: () => void,
  ) => (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button variant="outline" onClick={onReset}>
        Reset
      </Button>
    </div>
  );

  const isQuestionIncomplete = (question: QuizQuestions) => {
    return (
      !question.question ||
      !question.right_answer ||
      !question.distractor ||
      question.distractor.length === 0
    );
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    if (type === "group") {
      const reorderedQuestions = Array.from(questions);
      const [reorderedItem] = reorderedQuestions.splice(source.index, 1);
      reorderedQuestions.splice(destination.index, 0, reorderedItem);

      const updatedQuestions = reorderedQuestions.map((item, index) => ({
        ...item,
        order: index + 1,
      }));

      setQuestions(updatedQuestions);

      reorderQuestions(
        updatedQuestions.map((item) => ({
          id: item.quiz_question_id,
          order: item.order,
        })),
      );
    }
  };

  const handleSmartOrganize = (mode: SmartOrganizeMode) => {
    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
    const sequentialDifficulty = applySequentialDifficulty(sortedQuestions);

    const organizedQuestions =
      mode === "grouped"
        ? [...sequentialDifficulty]
          .sort((a, b) => {
            const weightA = DIFFICULTY_WEIGHT[a.difficulty];
            const weightB = DIFFICULTY_WEIGHT[b.difficulty];
            if (weightA !== weightB) {
              return weightA - weightB;
            }
            return a.order - b.order;
          })
          .map((question, index) => ({ ...question, order: index + 1 }))
        : sequentialDifficulty.map((question, index) => ({
          ...question,
          order: index + 1,
        }));

    setLastOrganizeSnapshot(questions);
    setQuestions(organizedQuestions);
    updateQuestionOrganization(
      organizedQuestions.map((question) => ({
        id: question.quiz_question_id,
        order: question.order,
        difficulty: question.difficulty,
      })),
    );
  };

  const handleUndoOrganize = () => {
    if (!lastOrganizeSnapshot) {
      return;
    }

    const restoredQuestions = [...lastOrganizeSnapshot].sort(
      (a, b) => a.order - b.order,
    );
    setQuestions(restoredQuestions);
    updateQuestionOrganization(
      restoredQuestions.map((question, index) => ({
        id: question.quiz_question_id,
        order: question.order || index + 1,
        difficulty: normalizeDifficulty(question.difficulty, index),
      })),
    );
    setLastOrganizeSnapshot(null);
  };

  if (isPending) return <Loader />;
  if (isError) return <div>Error loading questions</div>;

  const totalPoints = Array.isArray(questions)
    ? questions.reduce((total, q) => total + (q.points ?? 0), 0)
    : 0;

  return (
    <>
      <div className="mx-auto grid h-full max-w-7xl grid-cols-1 gap-4 pt-8 md:grid-cols-[300px_1fr]">
        <div className="h-fit rounded-lg bg-zinc-50 p-5 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-bold">Bulk Update Questions</h2>
          <div className="space-y-4">
            {!customPoints ? (
              <Select
                onValueChange={(value) => {
                  if (value === "custom") {
                    setCustomPoints(true);
                    setBulkPoints("");
                  } else {
                    setBulkPoints(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Points" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Points per Question</SelectLabel>
                    {[1, 2, 3, 5, 10].map((value) => (
                      <SelectItem key={value} value={value.toString()}>
                        {value} point{value !== 1 && "s"}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              renderCustomInput(
                "Enter custom points",
                bulkPoints,
                (value) => handleCustomInput(value, setBulkPoints),
                () => setCustomPoints(false),
              )
            )}

            {!customTime ? (
              <Select
                onValueChange={(value) => {
                  if (value === "custom") {
                    setCustomTime(true);
                    setBulkTime("");
                  } else {
                    setBulkTime(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Time per Question</SelectLabel>
                    {[10, 15, 20, 30, 60].map((value) => (
                      <SelectItem key={value} value={value.toString()}>
                        {value} second{value !== 1 && "s"}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              renderCustomInput(
                "Enter custom time (seconds)",
                bulkTime,
                (value) => handleCustomInput(value, setBulkTime),
                () => setCustomTime(false),
              )
            )}

            <Button
              onClick={() => updateBulk()}
              className="w-full"
              disabled={isUpdatingBulk || (!bulkPoints && !bulkTime)}
            >
              {isUpdatingBulk ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply Bulk Update"
              )}
            </Button>

            <div className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Difficulty Organizer</p>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        <Info size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Automatically organize questions by difficulty.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={smartOrganizeMode}
                onValueChange={(value: SmartOrganizeMode) =>
                  setSmartOrganizeMode(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Organization mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="sequential">
                      Default Sequential Order
                    </SelectItem>
                    <SelectItem value="grouped">
                      Group by Difficulty
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => handleSmartOrganize(smartOrganizeMode)}
                  disabled={questions.length === 0 || isOrganizing}
                >
                  {isOrganizing ? "Applying..." : "Apply"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUndoOrganize}
                  disabled={!lastOrganizeSnapshot || isOrganizing}
                >
                  Undo
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {questions.length} Question{questions.length !== 1 && "s"}{" "}
              <span className="font-normal opacity-60">
                ({totalPoints} points)
              </span>
            </h2>
            <Button
              className="gap-1"
              size="sm"
              onClick={handleCreate}
              disabled={questions.length === 0}
            >
              <Plus size={18} />
              Add Question
            </Button>
          </div>
          <div className="h-[72vh] overflow-y-auto pr-2">
            {Array.isArray(questions) && questions.length > 0 ? (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="questions" type="group">
                  {(provided) => (
                    <ul
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {questions.map((q, index) => {
                        const isIncomplete = isQuestionIncomplete(q);
                        const timeOptions = getDynamicNumericOptions(
                          DEFAULT_TIME_OPTIONS,
                          q.time,
                        );
                        return (
                          <Draggable
                            key={q.quiz_question_id}
                            draggableId={q.quiz_question_id}
                            index={index}
                            isDragDisabled={isQuestionIncomplete(q)}
                          >
                            {(provided, snapshot) => (
                              <li
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`relative rounded-lg bg-white p-4 shadow dark:bg-zinc-900 ${snapshot.isDragging ? "opacity-50" : ""
                                  } ${isIncomplete
                                    ? "bg-red-100 dark:bg-red-900/20"
                                    : ""
                                  }`}
                              >
                                <div>
                                  <div className="mb-2 flex flex-wrap justify-between text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div {...provided.dragHandleProps}>
                                        <GripVertical className="size-6 cursor-move rounded-md border border-zinc-200 p-1 dark:border-zinc-800" />
                                      </div>
                                      <div className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                                        {React.createElement(
                                          iconMapping[
                                          questionTypeIcon(q.question_type)
                                          ],
                                          { size: 12 },
                                        )}
                                        <p>{index + 1}.</p>{" "}
                                        <p>
                                          {formatQuestionType(q.question_type)}
                                        </p>
                                      </div>
                                      <Select
                                        onValueChange={(value) =>
                                          updateSingle({
                                            questionId: q.quiz_question_id,
                                            points: value,
                                          })
                                        }
                                        defaultValue={q.points?.toString()}
                                      >
                                        <SelectTrigger
                                          className="h-fit w-fit px-2 py-1 text-xs"
                                          disabled={isQuestionIncomplete(q)}
                                        >
                                          <SelectValue placeholder="Points" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectGroup>
                                            <SelectLabel>Points</SelectLabel>
                                            {[1, 2, 3, 5, 10].map((value) => (
                                              <SelectItem
                                                key={value}
                                                value={value.toString()}
                                              >
                                                {value} point
                                                {value !== 1 && "s"}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        onValueChange={(value) =>
                                          updateSingle({
                                            questionId: q.quiz_question_id,
                                            time: value,
                                          })
                                        }
                                        defaultValue={q.time?.toString()}
                                      >
                                        <SelectTrigger
                                          className="h-fit w-fit px-2 py-1 text-xs"
                                          disabled={isQuestionIncomplete(q)}
                                        >
                                          <SelectValue placeholder="Time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectGroup>
                                            <SelectLabel>Time</SelectLabel>
                                            {timeOptions.map(
                                              (value) => (
                                                <SelectItem
                                                  key={value}
                                                  value={value.toString()}
                                                >
                                                  {value} second
                                                  {value !== 1 && "s"}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectGroup>
                                        </SelectContent>
                                      </Select>
                                      <DifficultyBadge difficulty={q.difficulty} />
                                    </div>
                                    <div className="mt-3 flex gap-2 md:mt-0">
                                      <Button
                                        className="h-fit w-fit border border-zinc-200 p-0 dark:border-zinc-800"
                                        variant="outline"
                                        onClick={() =>
                                          handleDuplicate(q.quiz_question_id)
                                        }
                                        disabled={isQuestionIncomplete(q)}
                                      >
                                        <Copy className="size-6 rounded-md py-1" />
                                      </Button>
                                      <button
                                        className={`flex h-fit w-fit items-center gap-1 rounded-md border px-2 py-1 ${isIncomplete
                                          ? "border-yellow-500 bg-yellow-100 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-200"
                                          : "border-zinc-200 dark:border-zinc-800"
                                          }`}
                                        onClick={() =>
                                          navigate(
                                            `/professor/quiz/${quizId}/question/${q.quiz_question_id}/edit`,
                                          )
                                        }
                                      >
                                        <Pen size={12} />
                                        Edit
                                      </button>
                                      <Trash
                                        className={`size-6 cursor-pointer rounded-md p-1 text-white ${isIncomplete
                                          ? "bg-red-500"
                                          : "bg-red-600"
                                          }`}
                                        onClick={() =>
                                          handleDelete(q.quiz_question_id)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <h1>{q.question}</h1>
                                  {isIncomplete && (
                                    <div className="mt-2 flex items-center gap-2 rounded-md bg-yellow-100 p-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                                      <AlertTriangle className="size-8" />
                                      <span>
                                        This question is incomplete. Please edit
                                        to add missing information. Incomplete
                                        questions will not appear on the
                                        students' question list.
                                      </span>
                                    </div>
                                  )}
                                  {q.right_answer && (
                                    <>
                                      <p className="mt-2 text-xs opacity-60">
                                        Answer{" "}
                                        {q.question_type === "mcq" && "choices"}
                                      </p>
                                      <div className="mt-2 grid grid-cols-2 gap-2">
                                        {(q.distractor ?? [q.right_answer]).map(
                                          (a, index) => (
                                            <div
                                              key={index}
                                              className={`flex items-center rounded-lg p-2 text-xs shadow ${a.toLowerCase() ===
                                                q.right_answer.toLowerCase()
                                                ? "bg-green-500 text-white"
                                                : "bg-zinc-200 dark:bg-zinc-800"
                                                }`}
                                            >
                                              {a.toLowerCase() ===
                                                q.right_answer.toLowerCase() ? (
                                                <Check
                                                  className="mr-2"
                                                  size={16}
                                                />
                                              ) : (
                                                <X
                                                  className="mr-2 text-red-600"
                                                  size={16}
                                                />
                                              )}
                                              <p>
                                                {a.charAt(0).toUpperCase() +
                                                  a.slice(1)}
                                              </p>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </li>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-center text-gray-500">
                  No questions available. Please generate some questions to get
                  started.
                </p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(`/professor/quiz/${quizId}/generate-quiz`)
                  }
                >
                  Generate Questions
                </Button>
              </div>
            )}
          </div>
          <Button
            onClick={handleCreate}
            className="mt-4 self-center justify-self-center"
            size="sm"
            disabled={questions.length === 0}
          >
            Add More Questions
          </Button>
        </div>
      </div>
      {questions.length > 0 && (
        <QuizTypeModal
          hasQuestions={!!quizQuestionsData && quizQuestionsData.length > 0}
          open={questionTypeModalOpen}
          openChange={setQuestionTypeModalOpen}
        />
      )}
      <AlertDialog
        open={!!questionToDelete}
        onOpenChange={() => setQuestionToDelete(null)}
      >
        <AlertDialogContent className="dark:text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this question?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This question will be permanently
              deleted from the quiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

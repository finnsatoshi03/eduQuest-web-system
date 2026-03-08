import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Minus, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { QuizGenerationStage, useQuiz } from "@/contexts/QuizProvider";
import { MultiStepLoader } from "@/components/Shared/MultiStepLoader";

const MAX_QUESTIONS_OPTIONS = [5, 10, 15, 20];
const GENERATION_PROGRESS_STEPS: Array<{
  stage: QuizGenerationStage;
  text: string;
}> = [
  { stage: "updating_quiz_settings", text: "Saving quiz settings..." },
  { stage: "uploading_pdf", text: "Uploading PDF..." },
  { stage: "extracting_pdf_text", text: "Extracting text from PDF..." },
  { stage: "chunking_content", text: "Chunking document content..." },
  { stage: "generating_questions", text: "Generating questions with AI..." },
  { stage: "formatting_response", text: "Formatting generated questions..." },
  {
    stage: "replacing_existing_questions",
    text: "Removing previous quiz questions...",
  },
  { stage: "saving_generated_questions", text: "Saving generated questions..." },
  { stage: "completed", text: "Done. Redirecting to quiz editor..." },
];

export default function MaxQuestionsSelector() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeStage, setActiveStage] =
    useState<QuizGenerationStage>("updating_quiz_settings");
  const { quizId } = useParams();
  const { updateQuiz } = useQuiz();
  const navigate = useNavigate();
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  const activeStageIndex = useMemo(() => {
    const index = GENERATION_PROGRESS_STEPS.findIndex(
      (step) => step.stage === activeStage,
    );
    return index === -1 ? 0 : index;
  }, [activeStage]);

  const handleOptionClick = (value: number) => {
    setSelectedOption(value);
    setShowCustomInput(false);
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomValue(value);
    if (value && !isNaN(Number(value))) {
      setSelectedOption(parseInt(value, 10));
    }
  };

  const handleCustomOptionClick = () => {
    setShowCustomInput(true);
    setSelectedOption(null);
  };

  const handleCancelGeneration = () => {
    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
    }
  };

  const handleSubmit = async () => {
    if (selectedOption && quizId) {
      setGenerationError(null);
      setActiveStage("updating_quiz_settings");
      setIsLoading(true);
      generationAbortControllerRef.current = new AbortController();
      try {
        const updatedQuizId = await updateQuiz(
          quizId,
          selectedOption,
          {
            signal: generationAbortControllerRef.current.signal,
            onProgress: (stage) => setActiveStage(stage),
          },
        );

        if (updatedQuizId) {
          toast.success("Quiz updated successfully!");
          navigate(`/professor/quiz/${quizId}/customize`);
        } else {
          toast.error("Failed to update quiz");
          navigate(`/professor/quiz/${quizId}/generate-quiz`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          toast("Quiz generation cancelled.");
        } else if (error instanceof Error) {
          setGenerationError(error.message);
          toast.error(`Error updating quiz: ${error.message}`);
        } else {
          setGenerationError("Error updating quiz");
          toast.error("Error updating quiz");
        }
      } finally {
        generationAbortControllerRef.current = null;
        setIsLoading(false);
      }
    } else {
      console.error("No option selected or quiz ID not found");
    }
  };

  return (
    <div className="flex h-[calc(100%-5rem)] w-full flex-col justify-center">
      <MultiStepLoader
        loadingStates={GENERATION_PROGRESS_STEPS}
        loading={isLoading}
        loop={false}
        activeStep={activeStageIndex}
        onCancel={handleCancelGeneration}
        cancelLabel="Cancel generation"
      />
      <h2 className="text-xl font-bold md:text-3xl">
        Set Your Students' Next Challenge!
      </h2>
      <p>
        How tough do you want to make this quiz? Choose how many questions your
        students need to conquer! Once the quiz is generated, you can still
        tweak it—add, remove, or even edit questions to fine-tune the challenge!
      </p>

      <div className="mb-4 mt-8">
        <h2 className="my-2 font-bold">Select number of questions</h2>
        <div className="grid grid-cols-2 gap-4">
          {MAX_QUESTIONS_OPTIONS.map((option) => (
            <Button
              key={option}
              onClick={() => handleOptionClick(option)}
              variant={"outline"}
              className={`rounded-lg border-2 p-4 py-6 shadow-lg transition-transform hover:scale-105 ${selectedOption === option ? "bg-gradient-to-r from-indigo-500 to-indigo-500 text-white" : "text-black dark:text-white"}`}
              disabled={isLoading}
            >
              <span>{option} Questions</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="">
        <Button
          onClick={handleCustomOptionClick}
          className={`w-full px-6 py-4 font-semibold ${
            showCustomInput
              ? "bg-white text-indigo-600"
              : "bg-indigo-700 hover:bg-indigo-800"
          }`}
          disabled={isLoading}
        >
          Custom Challenge
        </Button>
      </div>

      {showCustomInput && (
        <div className="mt-6 flex items-center justify-center">
          <button
            className="rounded-lg bg-zinc-900 p-1 text-white dark:bg-zinc-50 dark:text-black"
            onClick={() =>
              setCustomValue(Math.max(1, parseInt(customValue) - 1).toString())
            }
            disabled={isLoading}
          >
            <Minus size={14} />
          </button>
          <Input
            type="number"
            value={customValue}
            onChange={handleCustomInputChange}
            placeholder="Enter number of questions"
            className="mx-2 w-fit text-center font-semibold"
            disabled={isLoading}
          />
          <button
            className="rounded-lg bg-zinc-900 p-1 text-white dark:bg-zinc-50 dark:text-black"
            onClick={() =>
              setCustomValue((parseInt(customValue) + 1).toString())
            }
            disabled={isLoading}
          >
            <Plus size={14} />
          </button>
        </div>
      )}

      {generationError && !isLoading && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{generationError}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={handleSubmit}
            disabled={!selectedOption}
          >
            Retry generation
          </Button>
        </div>
      )}

      <div className="mt-8 self-end">
        <Button
          onClick={handleSubmit}
          className="px-6 py-3 font-bold"
          variant={"secondary"}
          disabled={!selectedOption || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Quiz...
            </>
          ) : (
            <>Generate the Challenge!</>
          )}
        </Button>
      </div>
    </div>
  );
}

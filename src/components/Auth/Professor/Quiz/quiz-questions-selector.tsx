import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Minus, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuiz } from "@/contexts/QuizProvider";
import { MultiStepLoader } from "@/components/Shared/MultiStepLoader";
import { getLoadingStates } from "@/lib/helpers";

const MAX_QUESTIONS_OPTIONS = [5, 10, 15, 20];

export default function MaxQuestionsSelector() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { quizId } = useParams();
  const { quizData, updateQuiz } = useQuiz();
  const navigate = useNavigate();

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

  const handleSubmit = async () => {
    if (selectedOption && quizId) {
      setIsLoading(true);
      try {
        quizData.maxQuestions = selectedOption;

        const updatedQuizId = await updateQuiz(quizId, selectedOption);

        if (updatedQuizId) {
          toast.success("Quiz updated successfully!");
          navigate(`/professor/quiz/${quizId}/customize`);
        } else {
          toast.error("Failed to update quiz");
          navigate(`/professor/quiz/${quizId}/generate-quiz`);
        }
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`Error updating quiz: ${error.message}`);
        } else {
          toast.error("Error updating quiz");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      console.error("No option selected or quiz ID not found");
    }
  };

  return (
    <div className="flex h-[calc(100%-5rem)] w-full flex-col justify-center">
      <MultiStepLoader
        loadingStates={getLoadingStates(quizData?.questionType || "")}
        loading={isLoading}
        duration={2000}
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

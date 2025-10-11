import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeProvider";
import { Check, Plus, Trash } from "lucide-react";
import { getDarkerShade } from "@/lib/helpers";
import { useQuestionEdit } from "@/contexts/QuestionProvider";
import { useFetchQuestionData } from "./useFetchQuestionData";
import toast from "react-hot-toast";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "react-responsive";

export default function QuizEditQuestion() {
  const { theme } = useTheme();
  useFetchQuestionData();
  const {
    question,
    questionType,
    distractors,
    rightAnswer,
    updateQuestion,
    updateDistractors,
    updateRightAnswer,
  } = useQuestionEdit();

  const colors = ["#FF5733", "#17c237", "#3357FF", "#FF33A1", "#FF8C33"];
  const lightColors = ["#FF8C66", "#37a753", "#668CFF", "#FF66C2", "#FFB366"];
  const isTabletorMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const showPlusButton = distractors.length < 5;

  const addDistractor = () => {
    updateDistractors([...distractors, ""]);
  };

  const deleteDistractor = (index: number) => {
    if (distractors.length > 2) {
      const newDistractors = [...distractors];
      newDistractors.splice(index, 1);
      updateDistractors(newDistractors);

      if (rightAnswer === distractors[index]) {
        updateRightAnswer("");
      }
    } else {
      toast.error("At least two distractors must remain.");
    }
  };

  const updateDistractor = (index: number, value: string) => {
    const updatedDistractors = [...distractors];
    updatedDistractors[index] = value;
    updateDistractors(updatedDistractors);
  };

  const handleRightAnswer = (distractor: string) => {
    if (!distractor.trim()) {
      toast.error("Cannot mark an empty input as the correct answer!");
    } else {
      updateRightAnswer(distractor);
    }
  };

  const displayDistractors =
    distractors.length >= 2
      ? distractors
      : [...distractors, ...Array(2 - distractors.length).fill("")];

  return (
    <div className="flex w-full items-center justify-center pt-8 md:h-[calc(100%-8rem)]">
      <div className="w-[70vw] rounded-xl bg-slate-300 p-4 dark:bg-zinc-900">
        <Textarea
          value={question}
          onChange={(e) => updateQuestion(e.target.value)}
          placeholder="Type your question here"
          className="rounded-lg py-16 text-center text-xl font-semibold shadow-lg"
          style={{ resize: "none" }}
        />

        {questionType.toLowerCase() === "multiple choice" && (
          <div
            className="mt-4 grid gap-2 rounded-lg"
            style={{
              gridTemplateColumns: isTabletorMobile
                ? `repeat(1, 1fr)`
                : showPlusButton
                  ? `repeat(${displayDistractors.length}, 1fr) auto`
                  : `repeat(${displayDistractors.length}, 1fr)`,
            }}
          >
            {displayDistractors.map((distractor, index) => {
              const bgColor =
                theme === "dark"
                  ? lightColors[index % lightColors.length]
                  : colors[index % colors.length];

              const darkerBgColor = getDarkerShade(bgColor, 15);
              const isSelected = rightAnswer === distractor;

              const buttonBgColor =
                isSelected && distractor.trim() !== ""
                  ? "bg-green-500"
                  : "bg-zinc-800 bg-opacity-20";

              return (
                <div
                  key={index}
                  className="rounded-lg p-1"
                  style={{
                    backgroundColor: bgColor,
                    color: "#fff",
                  }}
                >
                  <div className="flex w-full items-center justify-between">
                    <button
                      className="rounded-md bg-zinc-50 bg-opacity-20 p-1.5"
                      onClick={() => deleteDistractor(index)}
                      disabled={distractors.length <= 2}
                    >
                      <Trash className="fill-white" size={14} />
                    </button>
                    <button
                      className={`rounded-full border p-1 ${buttonBgColor}`}
                      onClick={() => handleRightAnswer(distractor)}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                  <Input
                    value={distractor}
                    onChange={(e) => updateDistractor(index, e.target.value)}
                    placeholder="Type your answer here"
                    className="mt-2 h-12 border-none text-center text-lg focus-visible:ring-0 dark:placeholder:text-white dark:placeholder:text-opacity-50 md:h-32"
                    onFocus={(e) =>
                      (e.target.style.backgroundColor = darkerBgColor)
                    }
                    onBlur={(e) => (e.target.style.backgroundColor = bgColor)}
                  />
                </div>
              );
            })}
            {showPlusButton && (
              <div className="flex items-center justify-center">
                <button
                  className="rounded-md bg-zinc-900 bg-opacity-20 p-1.5 text-white dark:bg-white dark:text-black"
                  onClick={addDistractor}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        )}
        {(questionType.toLowerCase() === "true/false" ||
          questionType.toLowerCase() === "true or false") && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              className={`rounded-lg p-4 ${
                rightAnswer === "True"
                  ? "border border-zinc-800 bg-green-500 dark:border-white"
                  : "bg-purple-800 bg-opacity-20"
              }`}
              onClick={() => updateRightAnswer("True")}
            >
              True
            </button>
            <button
              className={`rounded-lg p-4 ${
                rightAnswer === "False"
                  ? "border border-zinc-800 bg-green-500 dark:border-white"
                  : "bg-purple-800 bg-opacity-20"
              }`}
              onClick={() => updateRightAnswer("False")}
            >
              False
            </button>
          </div>
        )}
        {questionType.toLowerCase() === "fill in the blank" && (
          <>
            <div className="relative my-4 flex items-center justify-center rounded-lg bg-slate-400 p-4 dark:bg-zinc-950">
              <h2 className="absolute left-4 top-2 text-sm font-semibold">
                Correct Answer
              </h2>
              <Input
                value={rightAnswer}
                onChange={(e) => updateRightAnswer(e.target.value)}
                placeholder="Type the correct answer here"
                className="mt-4 h-12 w-4/6 text-center text-lg focus-visible:ring-0 dark:placeholder:text-white dark:placeholder:text-opacity-50"
              />
            </div>

            <div className="relative flex flex-col items-center justify-center rounded-lg bg-slate-400 p-4 dark:bg-zinc-950">
              <h2 className="absolute left-4 top-2 text-sm font-semibold opacity-50">
                Student View
              </h2>
              <h1 className="mt-4 text-center font-bold opacity-70">
                Type your answer in the boxes
              </h1>

              <div
                className="mt-2 grid gap-1"
                style={{
                  gridTemplateColumns: rightAnswer
                    ? `repeat(${Math.min(rightAnswer.length, isTabletorMobile ? 5 : 10)}, 1fr)`
                    : "repeat(4, 1fr)",
                }}
              >
                {rightAnswer
                  ? rightAnswer.split("").map((char, index) => (
                      <div
                        key={index}
                        className="flex size-12 items-center justify-center rounded-lg bg-slate-700 text-center text-white dark:bg-zinc-700"
                      >
                        {char}
                      </div>
                    ))
                  : Array(4)
                      .fill("")
                      .map((_, index) => (
                        <div
                          key={index}
                          className="size-12 rounded-lg bg-slate-500 text-white dark:bg-zinc-700"
                        />
                      ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_COLORS } from "@/lib/constants";

// MultipleChoice Component
const MultipleChoice: React.FC<{
  distractor: string[];
  isTabletOrMobile: boolean;
  theme: string;
  hasAnswered: boolean;
  selectedAnswer: string | null;
  effect: "correct" | "wrong" | "noAnswer" | null;
  handleAnswer: (answer: string) => void;
}> = ({
  distractor,
  isTabletOrMobile,
  theme,
  hasAnswered,
  selectedAnswer,
  effect,
  handleAnswer,
}) => {
  return (
    <div
      className="mt-4 grid gap-2 rounded-lg"
      style={{
        gridTemplateColumns: isTabletOrMobile
          ? "repeat(1, 1fr)"
          : `repeat(${distractor.length}, 1fr)`,
      }}
    >
      {distractor.map((answer, index) => {
        const bgColor =
          theme === "dark"
            ? GAME_COLORS.dark[index % GAME_COLORS.dark.length]
            : GAME_COLORS.light[index % GAME_COLORS.light.length];
        const isSelected = selectedAnswer === answer;

        const buttonClasses = [
          "relative rounded-lg p-1 transition-transform duration-200 ease-in-out hover:translate-y-1 h-fit lg:h-56",
          isSelected &&
            effect === "correct" &&
            "animate-pulse-green !bg-green-600",
          isSelected && effect === "wrong" && "animate-shake !bg-red-600",
          !isSelected && hasAnswered && "!bg-slate-500 !text-zinc-900",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Button
            key={index}
            className={buttonClasses}
            style={{
              backgroundColor: hasAnswered ? undefined : bgColor,
              color: "#fff",
            }}
            onClick={() => handleAnswer(answer)}
            disabled={hasAnswered && !isSelected}
          >
            <div className="mt-2 flex h-fit items-center justify-center rounded-lg border-none p-2 text-lg">
              {answer.charAt(0).toUpperCase() + answer.slice(1)}
            </div>
          </Button>
        );
      })}
    </div>
  );
};

// TrueFalse Component
const TrueFalse: React.FC<{
  hasAnswered: boolean;
  selectedAnswer: string | null;
  effect: "correct" | "wrong" | "noAnswer" | null;
  handleAnswer: (answer: string) => void;
}> = ({ hasAnswered, selectedAnswer, effect, handleAnswer }) => {
  const options = ["True", "False"];

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selectedAnswer === option;

        const buttonClasses = [
          "rounded-lg p-4 text-left transition-transform duration-200 ease-in-out hover:translate-y-1 h-fit md:h-56",
          !isSelected && "bg-purple-800 bg-opacity-20",
          isSelected &&
            effect === "correct" &&
            "animate-pulse-green !bg-green-600 bg-opacity-100",
          isSelected &&
            effect === "wrong" &&
            "animate-shake !bg-red-600 bg-opacity-100 !text-white",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Button
            key={option}
            className={buttonClasses}
            onClick={() => handleAnswer(option)}
            disabled={hasAnswered && !isSelected}
          >
            {option}
          </Button>
        );
      })}
    </div>
  );
};

// FillInTheBlank Component
const FillInTheBlank: React.FC<{
  rightAnswer: string;
  hasAnswered: boolean;
  effect: "correct" | "wrong" | "noAnswer" | null;
  answerInput: string[];
  setAnswerInput: React.Dispatch<React.SetStateAction<string[]>>;
  handleAnswer: (answer: string) => void;
  inputRefs: React.RefObject<(HTMLInputElement | null)[]>;
  isTabletOrMobile: boolean;
}> = ({
  rightAnswer,
  hasAnswered,
  effect,
  answerInput,
  setAnswerInput,
  handleAnswer,
  inputRefs,
  isTabletOrMobile,
}) => {
  const answerChars = Array.from(rightAnswer);
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

  const editableIndexes = answerChars
    .map((char, index) => (/\s/.test(char) ? -1 : index))
    .filter((index) => index !== -1);

  const getNextEditableIndex = (currentIndex: number): number | null => {
    const currentPosition = editableIndexes.indexOf(currentIndex);
    if (currentPosition === -1 || currentPosition >= editableIndexes.length - 1) {
      return null;
    }
    return editableIndexes[currentPosition + 1];
  };

  const getPreviousEditableIndex = (currentIndex: number): number | null => {
    const currentPosition = editableIndexes.indexOf(currentIndex);
    if (currentPosition <= 0) {
      return null;
    }
    return editableIndexes[currentPosition - 1];
  };

  const composeAnswer = (input: string[]) =>
    answerChars
      .map((char, index) => {
        if (/\s/.test(char)) {
          return char;
        }
        return input[index] || "";
      })
      .join("");

  const handleInputChange = (index: number, value: string) => {
    const newInput = [...answerInput];
    newInput[index] = value;
    setAnswerInput(newInput);

    // Auto-focus next input if available
    if (value !== "") {
      const nextIndex = getNextEditableIndex(index);
      if (nextIndex !== null) {
        inputRefs.current?.[nextIndex]?.focus();
      }
    }

    // Submit answer if all editable boxes are filled
    const allFilled = editableIndexes.every((editableIndex) =>
      Boolean(newInput[editableIndex]),
    );
    if (allFilled && !hasAnswered) {
      handleAnswer(composeAnswer(newInput));
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace") {
      return;
    }

    if (answerInput[index]) {
      return;
    }

    const previousIndex = getPreviousEditableIndex(index);
    if (previousIndex !== null) {
      inputRefs.current?.[previousIndex]?.focus();
    }
  };

  const getInputClasses = () =>
    [
      "flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700 text-center text-base text-white sm:h-12 sm:w-12",
      effect === "correct" && "animate-pulse-green",
      effect === "wrong" && "!bg-red-600",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-zinc-200 p-4 dark:bg-zinc-800">
      <h1 className="mb-4 text-center font-bold opacity-70">
        Type your answer in the boxes (spaces are already included)
      </h1>
      <div
        className={`flex max-w-full flex-wrap justify-center gap-x-3 gap-y-2 ${
          effect === "wrong" ? "animate-shake" : ""
        }`}
        style={{
          maxWidth: isTabletOrMobile ? "18rem" : "32rem",
        }}
      >
        {wordCharGroups.map((group, groupIndex) => (
          <div
            key={`word-${groupIndex}`}
            className="flex shrink-0 items-center gap-1"
          >
            {group.map((charIndex) => (
              <Input
                key={charIndex}
                ref={(el) => {
                  if (inputRefs.current) {
                    inputRefs.current[charIndex] = el;
                  }
                }}
                className={getInputClasses()}
                maxLength={1}
                value={answerInput[charIndex] || ""}
                onChange={(e) => handleInputChange(charIndex, e.target.value)}
                onKeyDown={(event) => handleKeyDown(charIndex, event)}
                disabled={hasAnswered}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export { MultipleChoice, TrueFalse, FillInTheBlank };

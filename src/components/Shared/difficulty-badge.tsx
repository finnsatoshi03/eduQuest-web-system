import { cn } from "@/lib/utils";
import { QuestionDifficulty } from "@/lib/types";

interface DifficultyBadgeProps {
  difficulty?: string | null;
  className?: string;
}

function normalizeDifficulty(
  difficulty?: string | null,
): QuestionDifficulty | undefined {
  if (!difficulty) {
    return undefined;
  }

  const normalized = difficulty.trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }

  return undefined;
}

const difficultyStyles: Record<QuestionDifficulty, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function DifficultyBadge({
  difficulty,
  className,
}: DifficultyBadgeProps) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  if (!normalizedDifficulty) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        difficultyStyles[normalizedDifficulty],
        className,
      )}
    >
      {normalizedDifficulty}
    </span>
  );
}

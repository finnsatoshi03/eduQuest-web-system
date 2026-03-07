import DifficultyBadge from "@/components/Shared/difficulty-badge";

const QuestionHeader: React.FC<{
  questionNumber: number;
  points: number;
  difficulty?: string;
}> = ({
  questionNumber,
  points,
  difficulty,
}) => (
  <div className="flex w-full items-center justify-between">
    <div className="mb-4 flex items-center gap-2">
      <h1 className="text-2xl font-bold">Question {questionNumber}</h1>
      <DifficultyBadge difficulty={difficulty} />
    </div>
    <p className="text-xl font-bold">
      {points} point{points > 1 && "s"}
    </p>
  </div>
);

export default QuestionHeader;

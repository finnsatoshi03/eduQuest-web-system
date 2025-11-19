import { StudentQuizHistory } from "@/services/api/apiStudent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckCircle, XCircle, Target, Calendar } from "lucide-react";

interface QuizDetailModalProps {
  quiz: StudentQuizHistory | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuizDetailModal({
  quiz,
  isOpen,
  onClose,
}: QuizDetailModalProps) {
  if (!quiz) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const accuracyColor =
    quiz.accuracy >= 80
      ? "text-green-600"
      : quiz.accuracy >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl !text-black dark:!text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl">{quiz.quiz_title}</DialogTitle>
          <DialogDescription>
            <Badge variant="secondary" className="mt-2">
              {quiz.subject}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Score Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-4 text-center">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-yellow-600" />
              <p className="text-2xl font-bold">{quiz.score}</p>
              <p className="text-xs">Score / {quiz.total_points}</p>
            </div>

            <div className="rounded-lg border p-4 text-center">
              <Target className={`mx-auto mb-2 h-6 w-6 ${accuracyColor}`} />
              <p className={`text-2xl font-bold ${accuracyColor}`}>
                {quiz.accuracy}%
              </p>
              <p className="text-xs">Accuracy</p>
            </div>

            <div className="rounded-lg border p-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-6 w-6 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                {quiz.right_answer}
              </p>
              <p className="text-xs">Correct</p>
            </div>

            <div className="rounded-lg border p-4 text-center">
              <XCircle className="mx-auto mb-2 h-6 w-6 text-red-600" />
              <p className="text-2xl font-bold text-red-600">
                {quiz.wrong_answer}
              </p>
              <p className="text-xs">Incorrect</p>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Quiz Information</h3>

            <div className="flex items-center justify-between text-sm">
              <span className="">Date Taken:</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">
                  {formatDate(quiz.created_at)}
                </span>
              </div>
            </div>

            {quiz.placement > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="">Your Rank:</span>
                <Badge
                  variant={
                    quiz.placement === 1
                      ? "default"
                      : quiz.placement <= 3
                        ? "secondary"
                        : "outline"
                  }
                >
                  #{quiz.placement}
                </Badge>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="">Quiz Status:</span>
              <Badge variant={quiz.quiz_taken ? "default" : "outline"}>
                {quiz.quiz_taken ? "Completed" : "In Progress"}
              </Badge>
            </div>

            {quiz.retake && (
              <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-700">
                This quiz can be retaken to improve your score
              </div>
            )}
          </div>

          {/* Performance Analysis */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Performance Analysis</h3>
            <p className="text-sm">
              {quiz.accuracy >= 90 && (
                <>
                  Outstanding performance! You've demonstrated excellent
                  understanding of the material.
                </>
              )}
              {quiz.accuracy >= 70 && quiz.accuracy < 90 && (
                <>
                  Great job! You have a good grasp of the material. Review the
                  questions you missed to further improve.
                </>
              )}
              {quiz.accuracy >= 50 && quiz.accuracy < 70 && (
                <>
                  Decent effort! Consider reviewing the topics covered in this
                  quiz to strengthen your understanding.
                </>
              )}
              {quiz.accuracy < 50 && (
                <>
                  This quiz was challenging. We recommend reviewing the material
                  and practicing more before attempting similar quizzes.
                </>
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

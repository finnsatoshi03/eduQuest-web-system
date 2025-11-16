import { StudentQuizHistory } from "@/services/api/apiStudent";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface QuizHistoryTableProps {
  history: StudentQuizHistory[];
  onQuizClick: (quiz: StudentQuizHistory) => void;
}

export default function QuizHistoryTable({
  history,
  onQuizClick,
}: QuizHistoryTableProps) {
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return "bg-green-500";
    if (accuracy >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Quiz History</h3>
          <p className="text-sm text-muted-foreground">
            You haven't taken any quizzes yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground italic">
            Note: Recently completed quizzes may take 1-2 minutes to appear.
            <br />
            Use the "Refresh Data" button to check for updates.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiz History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz Title</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-center">Accuracy</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((quiz) => (
                <TableRow
                  key={quiz.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onQuizClick(quiz)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{quiz.quiz_title}</span>
                      {quiz.retake && (
                        <Badge variant="outline" className="mt-1 w-fit text-xs">
                          Retakable
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{quiz.subject}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {quiz.score} / {quiz.total_points}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${getAccuracyColor(quiz.accuracy)}`}
                      />
                      <span>{quiz.accuracy}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {quiz.placement > 0 ? (
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
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(quiz.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

import { SubjectPerformance } from "@/services/api/apiStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface SubjectBreakdownProps {
  subjects: SubjectPerformance[];
}

export default function SubjectBreakdown({ subjects }: SubjectBreakdownProps) {
  const getPerformanceColor = (accuracy: number) => {
    if (accuracy >= 80) return "bg-green-500";
    if (accuracy >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getPerformanceLabel = (accuracy: number) => {
    if (accuracy >= 80) return "Excellent";
    if (accuracy >= 60) return "Good";
    return "Needs Improvement";
  };

  if (subjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
            <BookOpen className="mb-2 h-12 w-12" />
            <p className="text-sm">No subject data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance by Subject</CardTitle>
        <p className="text-muted-foreground text-sm">
          Your performance across different subjects
        </p>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto">
        <div className="space-y-4">
          {subjects.map((subject) => (
            <div
              key={subject.subject}
              className="rounded-lg border p-4 transition-all hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-primary h-5 w-5" />
                  <h3 className="font-semibold">{subject.subject}</h3>
                </div>
                <Badge variant="secondary">{subject.quiz_count} quizzes</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Average Score:</span>
                  <span className="font-semibold">
                    {subject.average_score.toFixed(1)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getPerformanceColor(subject.average_accuracy)}`}
                    />
                    <span className="font-semibold">
                      {subject.average_accuracy.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({getPerformanceLabel(subject.average_accuracy)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Points:</span>
                  <span className="font-semibold">
                    {subject.total_points_earned} /{" "}
                    {subject.total_points_possible}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full ${getPerformanceColor(subject.average_accuracy)}`}
                      style={{
                        width: `${subject.average_accuracy}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

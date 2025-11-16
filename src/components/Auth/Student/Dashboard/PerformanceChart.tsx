import { StudentQuizHistory } from "@/services/api/apiStudent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PerformanceChartProps {
  history: StudentQuizHistory[];
}

export default function PerformanceChart({ history }: PerformanceChartProps) {
  // Prepare data for chart (reverse to show chronological order)
  const chartData = [...history]
    .reverse()
    .slice(0, 10) // Show last 10 quizzes
    .map((quiz, index) => ({
      name: `Quiz ${index + 1}`,
      score: quiz.score,
      accuracy: quiz.accuracy,
      quizTitle: quiz.quiz_title.length > 20
        ? quiz.quiz_title.substring(0, 20) + "..."
        : quiz.quiz_title,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data available to display chart
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trend</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your score and accuracy over the last {chartData.length} quizzes
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              label={{
                value: "Score",
                angle: -90,
                position: "insideLeft",
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{
                value: "Accuracy (%)",
                angle: 90,
                position: "insideRight",
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <p className="text-sm font-semibold">
                        {payload[0].payload.quizTitle}
                      </p>
                      <p className="text-xs text-blue-600">
                        Score: {payload[0].value}
                      </p>
                      <p className="text-xs text-green-600">
                        Accuracy: {payload[1].value}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Score"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="accuracy"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Accuracy (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

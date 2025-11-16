import { PerformanceTrendData } from "@/services/api/apiAnalytics";
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

interface PerformanceTrendsChartProps {
  trends: PerformanceTrendData[];
  timeFilter: "week" | "month";
}

export default function PerformanceTrendsChart({
  trends,
  timeFilter,
}: PerformanceTrendsChartProps) {
  const chartData = trends.map((trend) => ({
    date: new Date(trend.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: trend.average_score,
    accuracy: trend.average_accuracy,
    students: trend.total_students,
    quizzes: trend.quiz_count,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No quiz data available for the selected time period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <p className="text-sm text-muted-foreground">
          Average scores and accuracy over the last {timeFilter === "week" ? "7 days" : "30 days"}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
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
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <p className="text-sm font-semibold mb-1">
                        {payload[0].payload.date}
                      </p>
                      <p className="text-xs text-blue-600">
                        Avg Score: {payload[0].value}
                      </p>
                      <p className="text-xs text-green-600">
                        Accuracy: {payload[1].value}%
                      </p>
                      <p className="text-xs text-gray-600">
                        Quizzes: {payload[0].payload.quizzes}
                      </p>
                      <p className="text-xs text-gray-600">
                        Students: {payload[0].payload.students}
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
              name="Avg Score"
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

import { StudentPerformanceStats } from "@/services/api/apiStudent";
import { Trophy, TrendingUp, Target, Award } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatisticsCardsProps {
  stats: StudentPerformanceStats;
}

export default function StatisticsCards({ stats }: StatisticsCardsProps) {
  const cards = [
    {
      title: "Total Quizzes",
      value: stats.total_quizzes,
      description: "Quizzes completed",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Average Score",
      value: stats.average_score.toFixed(1),
      description: `${stats.average_accuracy.toFixed(1)}% accuracy`,
      icon: Trophy,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Best Performance",
      value: stats.best_score,
      description: "Highest score achieved",
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Performance Trend",
      value:
        stats.recent_performance === "improving"
          ? "Improving"
          : stats.recent_performance === "declining"
            ? "Declining"
            : "Stable",
      description: "Based on recent quizzes",
      icon: TrendingUp,
      color:
        stats.recent_performance === "improving"
          ? "text-green-600"
          : stats.recent_performance === "declining"
            ? "text-red-600"
            : "text-gray-600",
      bgColor:
        stats.recent_performance === "improving"
          ? "bg-green-50"
          : stats.recent_performance === "declining"
            ? "bg-red-50"
            : "bg-gray-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`rounded-lg p-2 ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              {card.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

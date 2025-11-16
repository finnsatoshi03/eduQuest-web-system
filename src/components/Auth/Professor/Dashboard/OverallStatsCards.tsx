import { ProfessorOverallStats } from "@/services/api/apiAnalytics";
import { BookOpen, Users, TrendingUp, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OverallStatsCardsProps {
  stats: ProfessorOverallStats;
}

export default function OverallStatsCards({ stats }: OverallStatsCardsProps) {
  const cards = [
    {
      title: "Total Quizzes",
      value: stats.total_quizzes,
      description: `${stats.quizzes_this_week} created this week`,
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Students",
      value: stats.total_students,
      description: `${stats.total_quiz_attempts} total attempts`,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Average Score",
      value: stats.average_class_score.toFixed(1),
      description: "Across all quizzes",
      icon: Target,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "This Month",
      value: stats.quizzes_this_month,
      description: "Quizzes created",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
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

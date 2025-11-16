import React, { useState } from "react";
import { Loader2, Filter, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { joinRoom } from "@/services/api/apiRoom";
import { StudentQuizHistory } from "@/services/api/apiStudent";
import { useStudentDashboard, useFilteredQuizHistory } from "@/hooks/useStudentDashboard";
import StatisticsCards from "./Dashboard/StatisticsCards";
import QuizHistoryTable from "./Dashboard/QuizHistoryTable";
import PerformanceChart from "./Dashboard/PerformanceChart";
import SubjectBreakdown from "./Dashboard/SubjectBreakdown";
import QuizDetailModal from "./Dashboard/QuizDetailModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AnimalIconInput: React.FC = () => {
  const [classCode, setClassCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (classCode.length < 36) {
      setError("Please enter a valid class code (36 characters)");
      return;
    }
    setIsJoining(true);
    setError(null);

    try {
      const studentId = user?.id ?? "";
      if (!user) {
        setError("User is not authenticated");
        setIsJoining(false);
        return;
      }

      const response = await joinRoom(classCode, studentId, user);
      console.log(response);

      if (response.status === "scheduled") {
        navigate(`/student/join/${classCode}/scheduled`, {
          state: {
            quiz_id: response.quiz_id,
            title: response.title,
            openTime: response.open_time,
            closeTime: response.close_time,
          },
        });
      } else if (response.success) {
        navigate(`/student/join/${classCode}/gamelobby`);
      } else {
        setError(response.error || "Failed to join the room");
      }
    } catch (err) {
      setError(
        `Error joining room: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-8">
      <div className="text-indigo-500">
        {isJoining ? (
          <Loader2 size={80} className="mb-4 animate-spin" />
        ) : error ? (
          <img
            src="/cat-error.gif"
            className="mb-4 w-24"
            style={{ transform: "scale(-1, 1)" }}
            alt="Error cat"
          />
        ) : (
          <img
            src="/cat-join.gif"
            className="-mb-2 w-24 animate-bounce"
            style={{ transform: "scale(-1, 1)" }}
            alt="Join cat"
          />
        )}
      </div>
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-indigo-500">Join Quiz</h2>
        {error && <p className="my-2 text-sm text-red-500">{error}</p>}
      </div>
      <form onSubmit={handleJoin} className="relative flex space-x-2">
        <Input
          type="text"
          value={classCode}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setClassCode(e.target.value)
          }
          placeholder="Enter class code"
          className="w-64"
        />
        <Button type="submit" disabled={isJoining}>
          {isJoining ? "Joining..." : "Join"}
        </Button>
      </form>
    </div>
  );
};

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedQuiz, setSelectedQuiz] = useState<StudentQuizHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "all">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use custom hook for dashboard data
  const { history, stats, subjects, isLoading, refetch } = useStudentDashboard(user?.id);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Use custom hook for filtered history
  const filteredHistoryQuery = useFilteredQuizHistory(
    user?.id,
    timeFilter,
    subjectFilter,
    history,
  );

  const filteredHistory = filteredHistoryQuery.data || history;

  const handleQuizClick = (quiz: StudentQuizHistory) => {
    setSelectedQuiz(quiz);
    setIsModalOpen(true);
  };

  const uniqueSubjects = Array.from(new Set(history.map((q) => q.subject)));

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-muted-foreground">
            Track your quiz performance and history
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Quiz History</TabsTrigger>
          <TabsTrigger value="join">Join Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {stats && <StatisticsCards stats={stats} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <PerformanceChart history={history} />
            <SubjectBreakdown subjects={subjects} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Subject filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {uniqueSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <QuizHistoryTable
            history={filteredHistory}
            onQuizClick={handleQuizClick}
          />
        </TabsContent>

        <TabsContent value="join">
          <div className="flex items-center justify-center py-12">
            <AnimalIconInput />
          </div>
        </TabsContent>
      </Tabs>

      <QuizDetailModal
        quiz={selectedQuiz}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default StudentDashboard;

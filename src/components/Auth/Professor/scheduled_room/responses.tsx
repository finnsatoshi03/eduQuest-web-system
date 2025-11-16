import ClassAccuracy from "../quiz_room/class-accuracy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "../quiz_room/leaderboard";
import LiveQuestionChart from "../quiz_room/live-question-chart";
import LeaderboardChart from "../quiz_room/leaderboard-trend-chart";
import { useState } from "react";
import { useLeaderboard } from "../quiz_room/useLeaderboard";
import { useParams } from "react-router-dom";
import { calculateClassAccuracy } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportQuizResultsToExcel } from "@/services/api/apiExport";
import toast from "react-hot-toast";
import supabase from "@/services/supabase";

export default function Responses() {
  const { classId } = useParams();
  const leaderboardData = useLeaderboard(classId!);
  const classAccuracy = calculateClassAccuracy(leaderboardData);
  const [activeTab, setActiveTab] = useState("leaderboards");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!classId) {
      toast.error("No class code found");
      return;
    }

    setIsExporting(true);
    const loadingToast = toast.loading("Exporting quiz results...");

    try {
      // Fetch quiz ID from class code
      const { data: quizData, error } = await supabase
        .from("quiz")
        .select("quiz_id")
        .eq("class_code", classId)
        .single();

      if (error || !quizData) {
        throw new Error("Quiz not found");
      }

      await exportQuizResultsToExcel(quizData.quiz_id, classId);
      toast.success("Quiz results exported successfully!", {
        id: loadingToast,
      });
    } catch (error) {
      console.error("Error exporting quiz results:", error);
      toast.error("Failed to export quiz results", { id: loadingToast });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-8 text-center ${
        activeTab === "live-chart"
          ? "h-[calc(100vh+20rem)] sm:h-full"
          : "h-full"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <ClassAccuracy accuracy={classAccuracy} />
        <Button
          onClick={handleExport}
          disabled={isExporting || !leaderboardData || leaderboardData.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="w-full">
        <Tabs
          defaultValue="leaderboards"
          className="w-full"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList>
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            <TabsTrigger value="live-chart">Live Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="leaderboards" className="w-full">
            <Leaderboard leaderboardData={leaderboardData} />
          </TabsContent>
          <TabsContent value="live-chart">
            <div className="grid w-full gap-4 sm:grid-cols-2">
              <LeaderboardChart leaderboardData={leaderboardData} />
              <LiveQuestionChart leaderboardData={leaderboardData} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

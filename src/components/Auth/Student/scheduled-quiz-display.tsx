import React from "react";
import { Clock, Calendar, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatUTCToLocalDisplay } from "@/lib/helpers";

interface ScheduledQuizInfo {
  openTime: string;
  closeTime: string;
  quizTitle?: string;
}

const TimeDisplay: React.FC<{
  label: string;
  time: string;
  icon: React.ReactNode;
}> = ({ label, time, icon }) => (
  <div className="flex items-center space-x-3 text-gray-700">
    <div className="text-indigo-500">{icon}</div>
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-base font-semibold">{formatUTCToLocalDisplay(time)}</p>
    </div>
  </div>
);

const ScheduledQuizDisplay: React.FC<ScheduledQuizInfo> = ({
  openTime,
  closeTime,
  quizTitle = "Upcoming Quiz",
}) => {
  const navigate = useNavigate();

  const now = new Date();
  const openDate = new Date(openTime);
  const timeUntilOpen = openDate.getTime() - now.getTime();
  const hoursUntilOpen = Math.floor(timeUntilOpen / (1000 * 60 * 60));
  const minutesUntilOpen = Math.floor(
    (timeUntilOpen % (1000 * 60 * 60)) / (1000 * 60),
  );

  const isOpeningSoon = timeUntilOpen > 0 && timeUntilOpen < 1000 * 60 * 60;

  return (
    <Card className="mx-auto w-full max-w-md shadow-lg">
      <CardContent className="space-y-6 dark:bg-zinc-800">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-indigo-100 p-3">
              <Calendar className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl text-indigo-500">
            {quizTitle}
          </CardTitle>
          <p className="text-center text-sm text-gray-500">
            This quiz is scheduled for a specific time
          </p>
        </CardHeader>
        {isOpeningSoon && (
          <p>
            Opening soon! Starting in {hoursUntilOpen}h {minutesUntilOpen}m
          </p>
        )}

        <div className="space-y-4 rounded-lg bg-gray-50 p-4">
          <TimeDisplay
            label="Opens At"
            time={openTime}
            icon={<Clock className="h-5 w-5" />}
          />
          <TimeDisplay
            label="Closes At"
            time={closeTime}
            icon={<Clock className="h-5 w-5" />}
          />
        </div>

        <div className="flex flex-col space-y-3">
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduledQuizDisplay;

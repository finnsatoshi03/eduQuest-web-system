import React, { useState } from "react";
import { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleX, Copy, Loader2 } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { kickStudent } from "@/services/api/apiRoom";
import toast from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthProvider";

interface WaitingLobbyProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  classId: string;
  onStartGame: (classId: string, studentId: string) => Promise<void>;
  isGameStarting?: boolean;
}

const WaitingLobby: React.FC<WaitingLobbyProps> = ({
  students,
  setStudents,
  classId,
  onStartGame,
  isGameStarting,
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const shareableLink = `${window.location.origin}/student/join/${classId}/gamelobby`;

  const { mutate: mutateKickStudent, isPending: isKickingStudent } =
    useMutation({
      mutationFn: ({
        classId,
        studentId,
      }: {
        classId: string;
        studentId: string;
      }) => kickStudent(classId, studentId),
      onSuccess: (_, variables) => {
        toast.success("Student kicked successfully");
        setStudents(
          students.filter(
            (student) => student.quiz_student_id !== variables.studentId,
          ),
        );
      },
      onError: () => {
        toast.error("Failed to kick student");
      },
    });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center text-center">
      <h1 className="mb-5 text-7xl font-bold uppercase text-indigo-800 md:text-9xl">
        Game Lobby
      </h1>
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold">Share Link</h2>
        <div className="flex items-center space-x-2">
          <Input value={shareableLink} readOnly className="w-64" />
          <Button onClick={handleCopyLink}>
            {copied ? "Copied!" : <Copy size={20} />}
          </Button>
        </div>
      </div>
      <div className="flex w-full max-w-md flex-wrap justify-center gap-6 border-t border-gray-300 pt-4">
        {students.length > 0 ? (
          students.map((student, index) => {
            const ghostNumber = (index % 4) + 1;
            return (
              <TooltipProvider delayDuration={100} key={index}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="flex w-24 cursor-pointer flex-col items-center justify-between border-gray-200 pb-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          mutateKickStudent({
                            classId,
                            studentId: student.quiz_student_id,
                          })
                        }
                        disabled={isKickingStudent}
                      >
                        {isKickingStudent ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <CircleX className="size-4" />
                        )}
                      </Button>
                      <img
                        src={`/ghost-${ghostNumber}.png`}
                        alt={`${student.student_name}'s avatar`}
                        className="w-12 object-cover text-xs"
                      />
                      <p className="text-sm font-semibold">
                        {student.student_name}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="text-left">
                    <p className="text-sm font-bold">{student.student_name}</p>
                    <p>{student.student_email}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            );
          })
        ) : (
          <div>Waiting for students to join..</div>
        )}
      </div>
      <Button
        className="mt-8 rounded-md shadow-[0px_4px_0px_#3b1b55] transition-all duration-300 hover:translate-y-1 hover:shadow-none dark:shadow-[0px_4px_0px_#aaa4b1] dark:hover:shadow-none"
        onClick={() => onStartGame(classId, user!.id)}
        disabled={!(students.length > 0) || isKickingStudent || isGameStarting}
      >
        {isGameStarting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Starting..
          </>
        ) : (
          "Start Game"
        )}
      </Button>
    </div>
  );
};

export default WaitingLobby;

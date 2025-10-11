import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { joinRoom } from "@/services/api/apiRoom";

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
        // Navigate to the scheduled quiz route instead of showing it inline
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

  // Original join view
  return (
    <div className="flex h-[calc(100%-10rem)] flex-col items-center justify-center">
      <div className="text-indigo-500">
        {isJoining ? (
          <Loader2 size={120} className="mb-8 animate-spin" />
        ) : error ? (
          <img
            src="/cat-error.gif"
            className="mb-4 w-32"
            style={{ transform: "scale(-1, 1)" }}
            alt="Error cat"
          />
        ) : (
          <img
            src="/cat-join.gif"
            className="-mb-4 w-32 animate-bounce"
            style={{ transform: "scale(-1, 1)" }}
            alt="Join cat"
          />
        )}
      </div>
      <div className="text-center">
        <h1 className="mb-6 text-3xl font-bold text-indigo-500">Join Quiz</h1>
        {error && <p className="my-2 text-red-500">{error}</p>}
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
  return (
    <div className="flex h-[calc(100%-5rem)] items-center justify-center">
      <AnimalIconInput />
    </div>
  );
};

export default StudentDashboard;

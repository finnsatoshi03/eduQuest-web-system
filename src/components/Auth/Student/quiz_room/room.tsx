import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthProvider";
import {
  leaveRoom,
  gameEventHandler,
  getQuizQuestionsStud,
  updateLeaderBoard,
  submitAnswer,
  joinRoom,
  getExitLeaderboard,
} from "@/services/api/apiRoom";
import { QuizQuestions as Question, QuizQuestions } from "@/lib/types";
import supabase from "@/services/supabase";

import soundOnLobby from "/sounds/lobby-sound.mp3";
import soundCorrect from "/sounds/correct-answer.mp3";
import soundWrong from "/sounds/wrong-answer.mp3";
import soundNoAnswer from "/sounds/wrong-answer.mp3";

import { useTheme } from "@/contexts/ThemeProvider";
import { useMediaQuery } from "react-responsive";
import ProgressBar from "@/components/Shared/progressbar";
import GameForm from "./game-form";
import KickedDialog from "./kicked-dialog";
import Lobby from "./lobby";
import Leaderboard from "./leaderboard";
import LoadingSpinner from "./loader";

const SGameLobby: React.FC = () => {
  const { user } = useAuth();
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [gameStart, setGameStart] = useState(false);
  const [joined, setJoined] = useState(false);
  const [score, setScore] = useState(0);
  const [rightAns, setRightAns] = useState(0);
  const [wrongAns, setWrongAns] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerInput, setAnswerInput] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(
    localStorage.getItem("displayName"),
  );
  const [displayNameRequired, setDisplayNameRequired] = useState(!displayName);
  const [kickedDialogOpen, setKickedDialogOpen] = useState(false);
  const [effect, setEffect] = useState<"correct" | "wrong" | "noAnswer" | null>(
    null,
  );

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lobbyMusic = useRef(new Audio(soundOnLobby));
  const correctSound = useRef(new Audio(soundCorrect));
  const wrongSound = useRef(new Audio(soundWrong));
  const noAnswerSound = useRef(new Audio(soundNoAnswer));

  const { theme } = useTheme();
  const isTabletorMobile = useMediaQuery({ query: "(max-width: 1024px)" });

  const colors = ["#D2691E", "#FF7F50", "#FFD700", "#32CD32", "#4682B4"];
  const lightColors = ["#CD853F", "#FF6347", "#FFA500", "#9ACD32", "#5F9EA0"];

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    const autoJoin = async () => {
      if (classId && user && !joined) {
        const studentId = user.id ?? "";
        const name = displayName || user.name || "";
        if (!name) {
          setDisplayNameRequired(true);
        } else {
          const success = await joinRoom(classId, studentId, user, name);
          if (success) {
            setJoined(true);
            setDisplayNameRequired(false);
            if (displayName) localStorage.setItem("displayName", displayName);
          } else {
            console.error("Failed to auto-join the room");
          }
        }
      }
    };

    autoJoin();
  }, [classId, user, joined, displayName]);

  useEffect(() => {
    const checkGameStatus = async () => {
      if (classId && joined) {
        await gameEventHandler(classId, setGameStart);
      }
    };

    if (joined) {
      checkGameStatus();
    }
  }, [classId, joined]);

  const getQuestion = async () => {
    if (classId) {
      const fetchedQuestions = (await getQuizQuestionsStud(classId)).map(
        (question: QuizQuestions) => ({
          ...question,
          quiz_id: question.quiz_id || "",
        }),
      );
      setQuestions(fetchedQuestions);
      setTimeLeft(fetchedQuestions[0]?.time || 30);
    }
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1 && classId) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
    } else if (classId) {
      setShowLeaderboard(true);
      setGameStart(false);
    }
  };

  useEffect(() => {
    getQuestion();
  }, [gameStart, classId]);

  useEffect(() => {
    if (!showLeaderboard && gameStart) {
      const nextQuestion = questions[currentQuestionIndex];
      setTimeLeft(nextQuestion.time);
    }
  }, [showLeaderboard, gameStart]);

  useEffect(() => {
    if (gameStart && timeLeft >= 0) {
      const interval = setInterval(() => {
        setTimeLeft((prevTime) => Math.max(prevTime - 1, 0));
      }, 1000);

      if (timeLeft === 0) {
        clearInterval(interval);
        handleTimeUp();
      }

      return () => clearInterval(interval);
    }
  }, [timeLeft, gameStart]);

  const handleTimeUp = async () => {
    if (!hasAnswered && currentQuestion) {
      setWrongAns((prev) => prev + 1);
      if (user) {
        await submitAnswer(currentQuestion.quiz_question_id, user.id, "");
      }
      setEffect("noAnswer");
      noAnswerSound.current.play();
    }

    setShowLeaderboard(true);
    if (classId && user) {
      await updateLeaderBoard(
        classId,
        user.id,
        user.name || "",
        score,
        rightAns,
        wrongAns + (hasAnswered ? 0 : 1),
      );
    }

    setTimeout(() => {
      handleNextQuestion();
      getExitLeaderboard(setShowLeaderboard);
      setEffect(null);
    }, 5000);
  };

  useEffect(() => {
    if (classId && user?.id) {
      const channel = supabase
        .channel(classId)
        .on("broadcast", { event: "student_kicked" }, (payload) => {
          if (payload.payload.student_id === user.id) {
            setKickedDialogOpen(true);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [classId, user?.id]);

  useEffect(() => {
    if (!showLeaderboard && gameStart) {
      const nextQuestion = questions[currentQuestionIndex];
      setTimeLeft(nextQuestion.time);
      setHasAnswered(false);
      setSelectedAnswer(null);
      setAnswerInput([]);
    }
  }, [showLeaderboard, gameStart, currentQuestionIndex, questions]);

  const leaveHandler = () => {
    if (classId && user?.id) {
      const response = leaveRoom(classId, user.id);
      if (!response) alert("Can't leave the game");
      navigate("/student/dashboard");
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion || !user || hasAnswered) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);
    const response = await submitAnswer(
      currentQuestion.quiz_question_id,
      user.id,
      answer,
    );
    if (!response) {
      setWrongAns((prev) => prev + 1);
      setEffect("wrong");
      wrongSound.current.play();
    } else {
      setScore((prev) => prev + (currentQuestion.points || 0));
      setRightAns((prev) => prev + 1);
      setEffect("correct");
      correctSound.current.play();
    }
  };

  useEffect(() => {
    let currentMusic = lobbyMusic.current;

    const setupMusic = () => {
      lobbyMusic.current.loop = true;
      // gameMusic.current.loop = true;

      if (gameStart) {
        lobbyMusic.current.pause();
      } else {
        lobbyMusic.current.play().catch(console.error);
        currentMusic = lobbyMusic.current;
      }
    };

    const handleUserInteraction = () => {
      document.removeEventListener("click", handleUserInteraction);
      setupMusic();
    };

    document.addEventListener("click", handleUserInteraction);

    return () => {
      lobbyMusic.current.pause();
      document.removeEventListener("click", handleUserInteraction);
    };
  }, [gameStart]);

  const renderMultipleChoice = () => {
    if (!currentQuestion) return null;

    return (
      <div
        className="mt-4 grid gap-2 rounded-lg"
        style={{
          gridTemplateColumns: isTabletorMobile
            ? `repeat(1, 1fr)`
            : `repeat(${currentQuestion.distractor?.length || 0}, 1fr)`,
        }}
      >
        {currentQuestion.distractor?.map((answer, index) => {
          const bgColor =
            theme === "dark"
              ? lightColors[index % lightColors.length]
              : colors[index % colors.length];
          const isSelected = selectedAnswer === answer;

          return (
            <Button
              key={index}
              className={`relative h-full rounded-lg p-1 transition-transform duration-200 ease-in-out hover:translate-y-1 md:h-56 ${
                isSelected && effect === "correct"
                  ? "animate-pulse-green !bg-green-600"
                  : isSelected && effect === "wrong"
                    ? "animate-shake !bg-red-600"
                    : !isSelected && hasAnswered
                      ? "!bg-slate-500 !text-zinc-900"
                      : ""
              }`}
              style={{
                backgroundColor: hasAnswered ? undefined : bgColor,
                color: "#fff",
              }}
              onClick={() => handleAnswer(answer)}
              disabled={hasAnswered && !isSelected}
            >
              <div className="mt-2 flex h-full items-center justify-center rounded-lg border-none p-2 text-lg">
                {answer.charAt(0).toUpperCase() + answer.slice(1)}
              </div>
            </Button>
          );
        })}
      </div>
    );
  };

  const renderTrueFalse = () => {
    if (!currentQuestion) return null;

    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["True", "False"].map((option) => {
          const isSelected = selectedAnswer === option;

          return (
            <Button
              key={option}
              className={`rounded-lg ${!isSelected && "bg-purple-800 bg-opacity-20"} p-4 text-left transition-transform duration-200 ease-in-out hover:translate-y-1 md:h-56 ${isSelected && effect === "correct" && "animate-pulse-green !bg-green-600 bg-opacity-100"} ${isSelected && effect === "wrong" && "animate-shake !bg-red-600 bg-opacity-100 !text-white"} `}
              onClick={() => handleAnswer(option)}
              disabled={hasAnswered && !isSelected}
            >
              {option}
            </Button>
          );
        })}
      </div>
    );
  };

  const renderFillInTheBlank = () => {
    if (!currentQuestion) return null;

    const handleInputChange = (index: number, value: string) => {
      const newInput = [...answerInput];
      newInput[index] = value;
      setAnswerInput(newInput);

      if (index < currentQuestion.right_answer.length - 1 && value !== "") {
        inputRefs.current[index + 1]?.focus();
      }

      if (
        newInput.filter(Boolean).length ===
          currentQuestion.right_answer.length &&
        !hasAnswered
      ) {
        handleAnswer(newInput.join(""));
      }
    };

    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-zinc-200 p-4 dark:bg-zinc-800">
        <h1 className="mb-4 text-center font-bold opacity-70">
          Type your answer in the boxes
        </h1>
        <div
          className={`grid gap-1 ${effect === "wrong" ? "animate-shake" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${Math.min(currentQuestion.right_answer.length, isTabletorMobile ? 5 : 10)}, 1fr)`,
          }}
        >
          {currentQuestion.right_answer.split("").map((_, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              className={`flex size-12 items-center justify-center rounded-lg bg-zinc-700 text-center text-white ${effect === "correct" && "animate-pulse-green"} ${effect === "wrong" && "!bg-red-600"} `}
              maxLength={1}
              value={answerInput[index] || ""}
              onChange={(e) => handleInputChange(index, e.target.value)}
              disabled={hasAnswered}
            />
          ))}
        </div>
      </div>
    );
  };

  if (displayNameRequired) {
    return (
      <GameForm
        classId={classId!}
        user={user ? { ...user, role: user.role || "" } : null}
        setJoined={setJoined}
        setDisplayNameRequired={setDisplayNameRequired}
        setDisplayName={setDisplayName}
      />
    );
  }

  if (kickedDialogOpen)
    return (
      <KickedDialog
        isOpen={kickedDialogOpen}
        onClose={() => setKickedDialogOpen(false)}
      />
    );

  if (!joined) {
    return <LoadingSpinner message="Joining the game.." />;
  }

  if (!gameStart) {
    return <Lobby onLeave={leaveHandler} />;
  }

  if (showLeaderboard) {
    return <Leaderboard />;
  }

  return currentQuestion ? (
    <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center text-center">
      <div className="flex w-full items-center justify-between">
        <h1 className="mb-4 text-2xl font-bold">
          Question {currentQuestionIndex + 1}
        </h1>
        <p className="text-xl font-bold">
          {currentQuestion.points} point{currentQuestion.points! > 1 && "s"}
        </p>
      </div>
      <div className="mb-4 w-full">
        <ProgressBar
          progress={(timeLeft / currentQuestion.time) * 100}
          height={24}
        />
      </div>
      <div className="mb-6 w-full">
        <h2 className="mb-4 flex h-44 items-center justify-center rounded-lg bg-zinc-200 text-xl dark:bg-zinc-800">
          {currentQuestion.question}
        </h2>
        {currentQuestion.question_type.toLowerCase() === "mcq" &&
          renderMultipleChoice()}
        {currentQuestion.question_type.toLowerCase() === "boolean" &&
          renderTrueFalse()}
        {currentQuestion.question_type.toLowerCase() === "short" &&
          renderFillInTheBlank()}
      </div>
      {hasAnswered ? (
        <div
          className={`mt-4 text-lg font-bold ${
            effect === "correct"
              ? "text-green-500"
              : effect === "wrong"
                ? "text-red-500"
                : "text-yellow-500"
          }`}
        >
          {effect === "correct"
            ? "Correct!"
            : effect === "wrong"
              ? "Wrong!"
              : "Time's up!"}
          <br />
          <span className="text-zinc-900 dark:text-white">
            Answer submitted! Waiting for other player's answer...
          </span>
        </div>
      ) : (
        <div className="text-lg font-bold">Time Left: {timeLeft} seconds</div>
      )}
    </div>
  ) : null;
};

export default SGameLobby;

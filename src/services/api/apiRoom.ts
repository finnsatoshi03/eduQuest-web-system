/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LeaderboardEntry,
  Quiz,
  QuizQuestions,
  Student,
  User,
} from "@/lib/types";
import { Dispatch, SetStateAction } from "react";
import supabase from "../supabase";
import { QUIZ_STATUS } from "@/lib/constants/quizStatus";

// Function to start the game and notify all subscribers
export async function startGame(
  classCode: string,
  userId: string,
): Promise<void> {
  try {
    // Check if the user is the game owner
    const { data: quizData } = await supabase
      .from("quiz")
      .select("owner_id")
      .eq("class_code", classCode)
      .single();

    if (quizData?.owner_id !== userId) {
      throw new Error("Only the game owner can start the game");
    }

    const { data: statusData } = await supabase
      .from("quiz")
      .select("status")
      .eq("class_code", classCode)
      .single();

    if (statusData?.status === QUIZ_STATUS.IN_GAME) {
      throw new Error("Game is already in progress");
    }

    // Generate a unique session ID for this game instance
    const sessionId = crypto.randomUUID();
    console.log("🎮 Starting new game session:", sessionId);

    await supabase
      .from("quiz")
      .update({
        status: QUIZ_STATUS.IN_GAME,
        current_session_id: sessionId,
      })
      .eq("class_code", classCode);

    const channel = supabase.channel("room1");
    channel.send({
      type: "broadcast",
      event: "quiz-game-started",
      payload: { classCode, sessionId },
    });
    channel.unsubscribe();
    console.log(
      `Game started for quiz ID: ${classCode}, Session: ${sessionId}`,
    );
  } catch (error) {
    console.error("Error starting game:", error);
    throw error;
  }
}

export async function reconnectGame(classCode: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("quiz")
      .select("status")
      .eq("class_code", classCode)
      .single();
    return data?.status === QUIZ_STATUS.IN_GAME;
  } catch (error) {
    console.error("Error checking quiz status:", error);
    return false;
  }
}

export async function endGame(classCode: string): Promise<boolean> {
  try {
    // Update the quiz status to "active"
    await supabase
      .from("quiz")
      .update({ status: QUIZ_STATUS.ACTIVE })
      .eq("class_code", classCode)
      .select();

    // Remove all participants from the temp_room table
    await supabase.from("temp_room").delete().eq("class_code", classCode);

    return true;
  } catch (error) {
    console.error("Error ending game:", error);
    return false;
  }
}

export async function getParticipants(
  classCode: string,
  setStudents: Dispatch<SetStateAction<Student[]>>,
): Promise<void> {
  try {
    const { data: initialParticipants } = await supabase
      .from("temp_room")
      .select("*")
      .eq("class_code", classCode);

    if (initialParticipants) {
      const formattedParticipants: Student[] = initialParticipants.map(
        (student) => ({
          placement: 0,
          quiz_student_id: student.quiz_student_id,
          right_answer: 0,
          score: 0,
          student_name: student.student_name,
          student_avatar: student.student_avatar,
          student_email: student.student_email,
          wrong_answer: 0,
        }),
      );

      setStudents(formattedParticipants);

      // Set up real-time subscription for participant changes
      supabase
        .channel("db-changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "temp_room" },
          (payload) => {
            if (classCode === payload.new.class_code) {
              const newStudent: Student = {
                placement: 0,
                quiz_student_id: payload.new.quiz_student_id,
                right_answer: 0,
                score: 0,
                student_name: payload.new.student_name,
                student_avatar: payload.new.student_avatar,
                student_email: payload.new.student_email,
                wrong_answer: 0,
              };
              setStudents((prevStudents) => [...prevStudents, newStudent]);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "temp_room" },
          (payload) => {
            setStudents((prevStudents) =>
              prevStudents.filter(
                (student) =>
                  student.quiz_student_id !== payload.old.quiz_student_id,
              ),
            );
          },
        )
        .subscribe();
    }
  } catch (error) {
    console.error("Error fetching participants:", error);
  }
}

interface JoinRoomResponse {
  quiz_id?: string;
  success: boolean;
  status?: string;
  error?: string;
  open_time?: string;
  close_time?: string;
  title?: string;
}

export async function joinRoom(
  classCode: string,
  studentId: string,
  user: User,
  username?: string,
): Promise<JoinRoomResponse> {
  try {
    const { data, error } = await supabase
      .from("quiz")
      .select("quiz_id, status, open_time, close_time, title, retake")
      .eq("class_code", classCode)
      .single();

    if (error) {
      console.error("Error fetching quiz status:", error);
      return {
        success: false,
        error: "Error fetching quiz status",
      };
    }

    const quizData = data as Quiz;

    // Handle scheduled quizzes with time validation
    if (
      (quizData && quizData.status === QUIZ_STATUS.SCHEDULED) ||
      quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME
    ) {
      const now = new Date();
      const openTime = quizData.open_time ? new Date(quizData.open_time) : null;
      const closeTime = quizData.close_time
        ? new Date(quizData.close_time)
        : null;

      let errorMessage = "This quiz is scheduled and not yet available.";

      if (openTime && closeTime) {
        if (now < openTime) {
          errorMessage = `This quiz has not opened yet. It will be available starting ${openTime.toLocaleString()}.`;
        } else if (now > closeTime) {
          errorMessage = `This quiz has ended. It closed at ${closeTime.toLocaleString()}.`;
        }
      }

      return {
        quiz_id: quizData.quiz_id,
        success: false,
        status: QUIZ_STATUS.SCHEDULED,
        open_time: quizData.open_time,
        close_time: quizData.close_time,
        title: quizData.title,
        error: errorMessage,
      };
    }

    if (quizData && quizData.status !== QUIZ_STATUS.IN_LOBBY) {
      return {
        success: false,
        error:
          "The game hasn't started yet. Please wait for the instructor to start the game.",
      };
    }

    const { data: existingRecord } = await supabase
      .from("temp_room")
      .select("*")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .maybeSingle();

    if (existingRecord) {
      console.log("Record already exists:", existingRecord);
      return {
        success: true,
        status: QUIZ_STATUS.IN_LOBBY,
      };
    }

    const studentName = user.name || username;
    await supabase
      .from("temp_room")
      .insert({
        quiz_student_id: studentId,
        class_code: classCode,
        student_name: studentName,
        student_avatar: user.avatar,
        student_email: user.email,
      })
      .select()
      .single();

    return {
      success: true,
      status: QUIZ_STATUS.IN_LOBBY,
    };
  } catch (error) {
    console.error("Error joining room:", error);
    return {
      success: false,
      error: "Error joining room",
    };
  }
}

export async function leaveRoom(
  classCode: string,
  studentId: string,
): Promise<boolean> {
  try {
    await supabase.from("temp_room").delete().match({
      quiz_student_id: studentId,
      class_code: classCode,
    });

    await supabase.channel(classCode).send({
      type: "broadcast",
      event: "student_left",
      payload: { student_id: studentId },
    });

    return true;
  } catch (error) {
    console.error("Error leaving the room:", error);
    return false;
  }
}
export async function kickStudent(
  classCode: string,
  studentId: string,
): Promise<boolean> {
  try {
    // Remove the student from the temp_room table
    await supabase.from("temp_room").delete().match({
      quiz_student_id: studentId,
      class_code: classCode,
    });

    // Broadcast a "student_kicked" event using Supabase Realtime
    await supabase.channel(classCode).send({
      type: "broadcast",
      event: "student_kicked",
      payload: { student_id: studentId },
    });

    return true;
  } catch (error) {
    console.error("Error kicking the student:", error);
    return false;
  }
}

// Game event handling functions
export function gameEventHandler(
  _classCode: string,
  setGameStart: (value: boolean) => void,
): () => void {
  const channel = supabase
    .channel(`room1`)
    .on("broadcast", { event: "quiz-game-started" }, () => {
      setGameStart(true);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

export async function getQuestionsProf(
  classCode: string,
): Promise<QuizQuestions[]> {
  try {
    const { data: quizData } = await supabase
      .from("quiz")
      .select("quiz_id")
      .eq("class_code", classCode)
      .single();

    if (!quizData) {
      throw new Error("Quiz not found");
    }

    const { data: questionsData } = await supabase
      .from("quiz_questions")
      .select(
        "quiz_question_id, right_answer, question, distractor, time, image_url, points, question_type, order",
      )
      .eq("quiz_id", quizData.quiz_id)
      .order("order", { ascending: true });

    if (questionsData && questionsData.length > 0) {
      await sendNextQuestion(
        { ...questionsData[0], quiz_id: quizData.quiz_id },
        classCode,
      );
    }

    return (
      questionsData?.map((question) => ({
        ...question,
        quiz_id: quizData.quiz_id,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    return [];
  }
}

export async function sendNextQuestion(
  question: QuizQuestions,
  classCode: string,
): Promise<boolean> {
  try {
    const startTime = new Date().toISOString();
    const endTime = new Date(
      new Date().getTime() + question.time * 1000,
    ).toISOString();

    await supabase.from("temp_room_questions").insert([
      {
        ...question,
        class_code: classCode,
        start_time: startTime,
        end_time: endTime,
      },
    ]);
    // const { data: existingQuestion } = await supabase
    //   .from("temp_room_questions")
    //   .select("id")
    //   .eq("class_code", classCode)
    //   .single();

    // if (existingQuestion) {
    //   await supabase
    //     .from("temp_room_questions")
    //     .update({
    //       ...question,
    //       start_time: startTime,
    //       end_time: endTime,
    //     })
    //     .eq("id", existingQuestion.id);
    // } else {
    //   await supabase.from("temp_room_questions").insert([
    //     {
    //       ...question,
    //       class_code: classCode,
    //       start_time: startTime,
    //       end_time: endTime,
    //     },
    //   ]);
    // }
    console.log("sent question");
    return true;
  } catch (error) {
    console.error("Error sending next question:", error);
    return false;
  }
}

// Timer functions
export function sendTimer(classCode: string, time: number): void {
  const channel = supabase.channel("room1");
  const startTime = new Date().toISOString();
  const endTime = new Date(new Date().getTime() + time * 1000).toISOString();

  channel.send({
    type: "broadcast",
    event: "timer",
    payload: {
      classCode,
      startTime,
      endTime,
    },
  });
  channel.unsubscribe();
}

export function getTimer(
  setTimeLeft: Dispatch<SetStateAction<number>>,
): () => void {
  const channel = supabase
    .channel("room1")
    .on("broadcast", { event: "timer" }, (payload) => {
      const { startTime, endTime } = payload.payload;
      const startTimeDate = new Date(startTime);
      const endTimeDate = new Date(endTime);
      const currentTime = new Date();

      const totalDuration = Math.floor(
        (endTimeDate.getTime() - startTimeDate.getTime()) / 1000,
      );
      const elapsedTime = Math.floor(
        (currentTime.getTime() - startTimeDate.getTime()) / 1000,
      );
      const remainingTime = Math.max(totalDuration - elapsedTime, 0);

      setTimeLeft(() => remainingTime);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

export async function sendEndGame(classCode: string): Promise<boolean> {
  const channel = supabase.channel("room1");

  // Send the end game event to the channel
  await channel.send({
    type: "broadcast",
    event: "quiz-game-ended",
    payload: { classCode },
  });

  // Unsubscribe from the channel after sending
  channel.unsubscribe();

  // End the game logic
  endGame(classCode);

  try {
    console.log("🔄 Starting ATOMIC game end process for class:", classCode);

    // Get quiz_id and current_session_id
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("quiz_id, current_session_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      console.error("❌ Error fetching quiz data:", quizError);
      return false;
    }

    const { quiz_id: quizId, current_session_id: sessionId } = quizData;

    if (!sessionId) {
      console.error("❌ No session_id found for this quiz - cannot finalize");
      console.error("This means the quiz was never properly started");
      return false;
    }

    console.log("📝 Quiz ID:", quizId);
    console.log("🎯 Session ID:", sessionId);

    // Call the atomic RPC function with retry logic
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to finalize game...`);

      try {
        const { data: result, error: rpcError } = await supabase.rpc(
          "rpc_end_game_atomic",
          {
            p_class_code: classCode,
            p_quiz_id: quizId,
            p_session_id: sessionId,
          },
        );

        if (rpcError) {
          console.error(`❌ RPC Error on attempt ${attempt}:`, rpcError);
          lastError = rpcError;

          // Check for specific error codes
          if (rpcError.code === "42501") {
            console.error(
              "🔒 RLS POLICY ERROR: Row Level Security blocking operation",
            );
            console.error(
              "FIX: Run 002_fix_quiz_history_rls_policies.sql migration",
            );
            break; // Don't retry RLS errors
          } else if (rpcError.code === "42883") {
            console.error(
              "⚠️ RPC FUNCTION NOT FOUND: rpc_end_game_atomic doesn't exist",
            );
            console.error(
              "FIX: Run 003_create_atomic_end_game_rpc.sql migration",
            );
            break; // Don't retry missing function errors
          }

          // Exponential backoff for retryable errors
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
            console.log(`⏳ Retrying in ${delayMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }
        } else {
          // Success!
          console.log("✅ RPC Result:", result);

          if (result && result.success) {
            console.log(`✅ Successfully finalized game!`);
            console.log(
              `   - Inserted: ${result.inserted_count} records to quiz_history`,
            );
            console.log(
              `   - Deleted: ${result.deleted_count} records from quiz_students`,
            );
            console.log(`   - Total students: ${result.total_students}`);

            if (result.warning) {
              console.warn("⚠️ Warning:", result.warning);
            }

            return true;
          } else {
            console.error(
              "❌ RPC returned failure:",
              result?.error || "Unknown error",
            );
            lastError = result?.error;
            return false;
          }
        }
      } catch (error) {
        console.error(`❌ Exception on attempt ${attempt}:`, error);
        lastError = error;

        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 500;
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we get here, all retries failed
    console.error("❌ CRITICAL: All attempts to finalize game failed!");
    console.error("Last error:", lastError);
    console.error(
      "⚠️ DATA MAY BE IN INCONSISTENT STATE - Manual intervention may be required",
    );

    return false;
  } catch (error) {
    console.error("❌ Unexpected error in sendEndGame:", error);
    return false;
  }
}

export async function getEndGame(
  setGameStart: Dispatch<SetStateAction<boolean>>,
) {
  const channel = supabase
    .channel(`room1`)
    .on("broadcast", { event: "quiz-game-ended" }, (payload) => {
      console.log("Game started event received:", payload);
      setGameStart(false);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

export function sendExitLeaderboard(classCode: string): () => void {
  const channel = supabase.channel("room1");

  channel.send({
    type: "broadcast",
    event: "quiz-next-question",
    payload: { classCode },
  });

  console.log("Exit leaderboard signal sent");
  return () => channel.unsubscribe();
}

export function getExitLeaderboard(
  setLeaderBoard: Dispatch<SetStateAction<boolean>>,
): () => void {
  const channel = supabase
    .channel(`room1`)
    .on("broadcast", { event: "quiz-next-question" }, (payload) => {
      console.log("Next question event received:", payload);
      setLeaderBoard(false);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

// Time calculation function
// function getRemainingTime(start: string, end: string): number {
//   const startTime = new Date(start);
//   const endTime = new Date(end);
//   const timeDifferenceInMillis = endTime.getTime() - startTime.getTime();
//   return Math.floor(timeDifferenceInMillis / 1000);
// }

export async function getQuizQuestionsStud(
  classCode: string,
): Promise<QuizQuestions[]> {
  try {
    const { data: quizData } = await supabase
      .from("quiz")
      .select("quiz_id")
      .eq("class_code", classCode)
      .single();

    if (!quizData) {
      throw new Error("Quiz not found");
    }

    const { data: questionsData } = await supabase
      .from("quiz_questions")
      .select(
        "quiz_question_id, right_answer, question, distractor, time, image_url, points, question_type, order",
      )
      .eq("quiz_id", quizData.quiz_id)
      .order("order", { ascending: true });

    if (questionsData && questionsData.length > 0) {
      await sendNextQuestion(
        { ...questionsData[0], quiz_id: quizData.quiz_id },
        classCode,
      );
    }

    return (
      questionsData?.map((question) => ({
        ...question,
        quiz_id: quizData.quiz_id,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching quiz questions:", error);
    return [];
  }
}

// Student question retrieval function
// export function getQuizQuestionsStud(
//   classCode: string,
//   setTimeLeft: Dispatch<SetStateAction<number>>,
// ): Promise<TempQuizQuestionPayload | null> {
//   return new Promise((resolve) => {
//     // First, attempt to fetch the current question
//     supabase
//       .from("temp_room_questions")
//       .select("*")
//       .eq("class_code", classCode)
//       .order("start_time", { ascending: false })
//       .limit(1)
//       .single()
//       .then(({ data, error }) => {
//         if (error) {
//           if (error.code === "PGRST116") {
//             console.log(
//               "No current question found. Waiting for first question.",
//             );
//             resolve(null);
//           } else {
//             console.error("Error fetching current question:", error);
//             resolve(null);
//           }
//         } else if (data) {
//           const currentQuestion: TempQuizQuestionPayload = {
//             quiz_question_id: data.quiz_question_id,
//             class_code: classCode,
//             question: data.question,
//             distractor: data.distractor,
//             time: data.time,
//             image_url: data.image_url,
//             points: data.points,
//             question_type: data.question_type,
//             order: data.order,
//             start_time: data.start_time,
//             end_time: data.end_time,
//           };
//           console.log("Current question fetched: ", currentQuestion);
//           setTimeLeft(
//             getRemainingTime(
//               currentQuestion.start_time,
//               currentQuestion.end_time,
//             ),
//           );
//           resolve(currentQuestion);
//         }
//       });

//     // Set up subscription for future updates
//     const channel = supabase
//       .channel(`room-questions-${classCode}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "INSERT",
//           schema: "public",
//           table: "temp_room_questions",
//           filter: `class_code=eq.${classCode}`,
//         },
//         (payload: { new: Partial<TempQuizQuestionPayload> }) => {
//           try {
//             const newQuestion: TempQuizQuestionPayload = {
//               quiz_question_id: payload.new.quiz_question_id!,
//               class_code: classCode,
//               question: payload.new.question!,
//               distractor: payload.new.distractor!,
//               time: payload.new.time!,
//               image_url: payload.new.image_url!,
//               points: payload.new.points!,
//               question_type: payload.new.question_type!,
//               order: payload.new.order!,
//               start_time: payload.new.start_time!,
//               end_time: payload.new.end_time!,
//             };
//             console.log("New question received: ", newQuestion);
//             setTimeLeft(
//               getRemainingTime(newQuestion.start_time, newQuestion.end_time),
//             );
//             resolve(newQuestion);
//           } catch (error) {
//             console.error("Error processing payload:", error);
//             resolve(null);
//           }
//         },
//       )
//       .subscribe();

//     // Return a cleanup function to unsubscribe when component unmounts
//     return () => {
//       supabase.removeChannel(channel);
//     };
//   });
// }

// Answer checking function
export async function checkAnswer(
  questionId: string,
  answer: string,
): Promise<boolean> {
  try {
    const { count } = await supabase
      .from("quiz_questions")
      .select("quiz_question_id", { count: "exact" })
      .eq("quiz_question_id", questionId)
      .eq("right_answer", answer)
      .single();

    return count ? count > 0 : false;
  } catch (error) {
    console.error("Error checking answer:", error);
    return false;
  }
}

// Leaderboard update function
export async function updateLeaderBoard(
  classCode: string,
  studentId: string,
  studentName: string,
  studentAvatar: string,
  studentEmail: string,
  score: number,
  rightAns: number,
  wrongAns: number,
): Promise<LeaderboardEntry[]> {
  try {
    // Get the current session_id from the quiz table
    const { data: quizData } = await supabase
      .from("quiz")
      .select("current_session_id")
      .eq("class_code", classCode)
      .single();

    const sessionId = quizData?.current_session_id;

    // CRITICAL: Enforce valid session before updating leaderboard
    // This prevents NULL session_id records that cause sync issues
    if (!sessionId) {
      console.error(
        "🚫 BLOCKED: No active session_id for class_code:",
        classCode,
      );
      throw new Error("Quiz session not started. Cannot update leaderboard.");
    }

    const { data: existingStudent, error: fetchError } = await supabase
      .from("quiz_students")
      .select("quiz_student_id, score")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingStudent) {
      await supabase.from("quiz_students").insert([
        {
          quiz_student_id: studentId,
          student_name: studentName,
          student_avatar: studentAvatar,
          student_email: studentEmail,
          score: score,
          class_code: classCode,
          session_id: sessionId,
        },
      ]);
      console.log("New student added:", studentId, "Session:", sessionId);
    } else {
      await supabase
        .from("quiz_students")
        .update({
          score: score,
          right_answer: rightAns,
          wrong_answer: wrongAns,
          session_id: sessionId,
        })
        .match({
          quiz_student_id: studentId,
          class_code: classCode,
        });
      console.log("Student score updated:", studentId, "Session:", sessionId);
    }

    const { data: allStudents } = await supabase
      .from("quiz_students")
      .select(
        "quiz_student_id, score, id, right_answer, wrong_answer, student_name, student_avatar, student_email",
      )
      .eq("class_code", classCode)
      .order("score", { ascending: false });

    if (allStudents) {
      // CRITICAL: Include session_id in placement updates to prevent NULL constraint violation
      const updates = allStudents.map((student, index) => ({
        id: student.id,
        quiz_student_id: student.quiz_student_id,
        placement: index + 1,
        session_id: sessionId, // CRITICAL: Must include session_id
      }));

      // Use update instead of upsert to ensure session_id is preserved
      const updatePromises = updates.map((update) =>
        supabase
          .from("quiz_students")
          .update({
            placement: update.placement,
            session_id: update.session_id,
          })
          .match({
            id: update.id,
            quiz_student_id: update.quiz_student_id,
            session_id: sessionId,
          }),
      );

      await Promise.all(updatePromises);
      console.log("Leaderboard updated successfully.");
      return allStudents;
    }

    return [];
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    throw error;
  }
}

// Answer submission function with individual answer tracking
export async function submitAnswer(
  questionId: string,
  studentId: string,
  answer: string,
  quizId: string,
  classCode: string,
  timeTaken: number = 0,
): Promise<boolean> {
  const isCorrect = await checkAnswer(questionId, answer);
  console.log("Answer is correct:", isCorrect);

  try {
    // Get the current session_id from the quiz table
    const { data: quizData } = await supabase
      .from("quiz")
      .select("current_session_id")
      .eq("class_code", classCode)
      .single();

    const sessionId = quizData?.current_session_id;

    // CRITICAL: Block answer submission if no valid session exists
    // This prevents NULL session_id records that cause sync issues
    if (!sessionId) {
      console.error(
        "🚫 BLOCKED: No active session_id for class_code:",
        classCode,
      );
      console.error("Quiz must be started before accepting answers");
      throw new Error(
        "Quiz session not started. Please wait for the professor to start the game.",
      );
    }

    // Get the quiz_students record for this student (includes id, name, email)
    const { data: quizStudent, error: fetchError } = await supabase
      .from("quiz_students")
      .select("id, student_name, student_email")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .maybeSingle();

    if (fetchError) {
      console.error("❌ Error fetching quiz student:", fetchError);
    }

    if (!quizStudent) {
      console.error("❌ Quiz student record not found for:", {
        studentId,
        classCode,
      });
    }

    // Store the individual answer in quiz_student_answers table
    // Include student_name, student_email, class_code, and session_id for permanent storage
    const { error: insertError } = await supabase
      .from("quiz_student_answers")
      .insert([
        {
          quiz_student_id: quizStudent?.id || studentId,
          quiz_id: quizId,
          quiz_question_id: questionId,
          class_code: classCode, // Track which quiz this answer belongs to
          session_id: sessionId, // Track which specific game session this answer belongs to
          student_answer: answer,
          is_correct: isCorrect,
          time_taken: timeTaken,
          answered_at: new Date().toISOString(),
          student_name: quizStudent?.student_name || "Unknown",
          student_email: quizStudent?.student_email || null,
        },
      ]);

    if (insertError) {
      console.error("❌ CRITICAL: Failed to store answer in database!");
      console.error("Error details:", insertError);

      // Check for specific error codes
      if (insertError.code === "42501") {
        console.error(
          "🔒 RLS POLICY ERROR: Row Level Security is blocking inserts",
        );
        console.error(
          "FIX: Run migration_fix_rls_policies.sql in Supabase SQL Editor",
        );
        console.error(
          "This will create permissive policies for authenticated users",
        );
      } else if (insertError.code === "42703") {
        console.error(
          "📋 COLUMN ERROR: Missing column in quiz_student_answers table",
        );
        console.error("Error message:", insertError.message);
        if (insertError.message?.includes("class_code")) {
          console.error(
            "🔧 FIX: Run migration_add_class_code_to_answers.sql in Supabase SQL Editor",
          );
        } else if (insertError.message?.includes("session_id")) {
          console.error(
            "🔧 FIX: session_id column is missing - should have been added in migration",
          );
        } else {
          console.error(
            "🔧 FIX: Run migration_quiz_answers_student_info.sql in Supabase SQL Editor",
          );
        }
      } else {
        console.error(
          "⚠️ UNKNOWN ERROR - Check Supabase logs for more details",
        );
      }
    } else {
      console.log("✅ Answer stored successfully - Session:", sessionId);
    }
  } catch (error) {
    console.error("❌ Exception storing individual answer:", error);
    // Don't throw - we still want to return the isCorrect result
  }

  return isCorrect;
}

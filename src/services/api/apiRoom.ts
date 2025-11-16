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

    if (statusData?.status === "in game") {
      throw new Error("Game is already in progress");
    }

    await supabase
      .from("quiz")
      .update({ status: "in game" })
      .eq("class_code", classCode);

    const channel = supabase.channel("room1");
    channel.send({
      type: "broadcast",
      event: "quiz-game-started",
      payload: { classCode },
    });
    channel.unsubscribe();
    console.log(`Game started for quiz ID: ${classCode}`);
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
    return data?.status === "in game";
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
      .update({ status: "active" })
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

    if (quizData && quizData.status === "scheduled") {
      return {
        quiz_id: quizData.quiz_id,
        success: false,
        status: "scheduled",
        open_time: quizData.open_time,
        close_time: quizData.close_time,
        title: quizData.title,
      };
    }

    if (quizData && quizData.status !== "in lobby") {
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
      .single();

    if (existingRecord) {
      console.log("Record already exists:", existingRecord);
      return {
        success: true,
        status: "in lobby",
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
      status: "in lobby",
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
    console.log("🔄 Starting game end process for class:", classCode);

    // STEP 1: Copy quiz_students data to quiz_history BEFORE deleting
    const { data: quizStudents, error: fetchError } = await supabase
      .from("quiz_students")
      .select("*")
      .eq("class_code", classCode);

    if (fetchError) {
      console.error("❌ Error fetching quiz students:", fetchError);
      return false;
    }

    console.log(`📊 Found ${quizStudents?.length || 0} students to save to history`);

    if (quizStudents && quizStudents.length > 0) {
      // Get quiz_id from class_code
      const { data: quizData, error: quizError } = await supabase
        .from("quiz")
        .select("quiz_id")
        .eq("class_code", classCode)
        .single();

      if (quizError) {
        console.error("❌ Error fetching quiz data:", quizError);
        return false;
      }

      const quizId = quizData?.quiz_id;
      console.log("📝 Quiz ID:", quizId);

      // Prepare history records
      const historyRecords = quizStudents.map((student) => ({
        quiz_id: quizId,
        class_code: classCode,
        quiz_student_id: student.quiz_student_id,
        student_name: student.student_name,
        student_email: student.student_email,
        student_avatar: student.student_avatar,
        score: student.score || 0,
        right_answer: student.right_answer || 0,
        wrong_answer: student.wrong_answer || 0,
        placement: student.placement || 0,
        quiz_taken: true,
        completed_at: new Date().toISOString(),
      }));

      console.log("💾 Attempting to save to quiz_history table...");

      // Insert into quiz_history
      const { error: insertError } = await supabase
        .from("quiz_history")
        .insert(historyRecords);

      if (insertError) {
        console.error("❌ CRITICAL: Failed to save quiz history!");
        console.error("Error details:", insertError);

        // Check for specific error codes
        if (insertError.code === "42501") {
          console.error("🔒 RLS POLICY ERROR: Row Level Security is blocking inserts to quiz_history");
          console.error("FIX: Run migration_fix_rls_policies.sql in Supabase SQL Editor");
        } else if (insertError.code === "42P01") {
          console.error("📋 TABLE ERROR: quiz_history table doesn't exist");
          console.error("FIX: Run migration_quiz_history.sql in Supabase SQL Editor");
        } else {
          console.error("⚠️ UNKNOWN ERROR - Check Supabase logs for more details");
        }
        // Continue anyway - don't fail the game end
      } else {
        console.log(`✅ Successfully saved ${historyRecords.length} quiz results to history`);
      }
    } else {
      console.log("⚠️ No students found to save to history");
    }

    // STEP 2: Now safe to delete quiz_students (answers are preserved)
    const { error: deleteError } = await supabase
      .from("quiz_students")
      .delete()
      .eq("class_code", classCode);

    if (deleteError) {
      console.error("Error removing students from quiz_students table:", deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in sendEndGame:", error);
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
    const { data: existingStudent, error: fetchError } = await supabase
      .from("quiz_students")
      .select("quiz_student_id, score")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
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
        },
      ]);
      console.log("New student added:", studentId);
    } else {
      await supabase
        .from("quiz_students")
        .update({
          score: score,
          right_answer: rightAns,
          wrong_answer: wrongAns,
        })
        .match({
          quiz_student_id: studentId,
          class_code: classCode,
        });
      console.log("Student score updated:", studentId);
    }

    const { data: allStudents } = await supabase
      .from("quiz_students")
      .select(
        "quiz_student_id, score, id, right_answer, wrong_answer, student_name, student_avatar, student_email",
      )
      .eq("class_code", classCode)
      .order("score", { ascending: false });

    if (allStudents) {
      const updates = allStudents.map((student, index) => ({
        id: student.id,
        quiz_student_id: student.quiz_student_id,
        placement: index + 1,
      }));

      await supabase.from("quiz_students").upsert(updates);
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
    // Get the quiz_students record for this student (includes id, name, email)
    const { data: quizStudent, error: fetchError } = await supabase
      .from("quiz_students")
      .select("id, student_name, student_email")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .single();

    if (fetchError) {
      console.error("❌ Error fetching quiz student:", fetchError);
    }

    if (!quizStudent) {
      console.error("❌ Quiz student record not found for:", { studentId, classCode });
    }

    // Store the individual answer in quiz_student_answers table
    // Include student_name, student_email, and class_code for permanent storage
    const { error: insertError } = await supabase
      .from("quiz_student_answers")
      .insert([
        {
          quiz_student_id: quizStudent?.id || studentId,
          quiz_id: quizId,
          quiz_question_id: questionId,
          class_code: classCode, // Track which game session this answer belongs to
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
        console.error("🔒 RLS POLICY ERROR: Row Level Security is blocking inserts");
        console.error("FIX: Run migration_fix_rls_policies.sql in Supabase SQL Editor");
        console.error("This will create permissive policies for authenticated users");
      } else if (insertError.code === "42703") {
        console.error("📋 COLUMN ERROR: Missing column in quiz_student_answers table");
        console.error("Error message:", insertError.message);
        if (insertError.message?.includes("class_code")) {
          console.error("🔧 FIX: Run migration_add_class_code_to_answers.sql in Supabase SQL Editor");
        } else {
          console.error("🔧 FIX: Run migration_quiz_answers_student_info.sql in Supabase SQL Editor");
        }
      } else {
        console.error("⚠️ UNKNOWN ERROR - Check Supabase logs for more details");
      }
    } else {
      console.log("✅ Answer stored successfully with class_code:", classCode);
    }
  } catch (error) {
    console.error("❌ Exception storing individual answer:", error);
    // Don't throw - we still want to return the isCorrect result
  }

  return isCorrect;
}

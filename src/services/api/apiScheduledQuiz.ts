import { QuizQuestions, User } from "@/lib/types";
import supabase from "../supabase";
import { QUIZ_STATUS } from "@/lib/constants/quizStatus";

interface QuizStatusResponse {
  hasTaken: boolean;
  canRetake: boolean;
}
interface QuizStudentData {
  quiz_student_id: string;
  class_code: string;
  quiz_id: string;
  quiz_taken: boolean;
}

export interface ScheduledQuizStatus {
  status: string;
  isOpen: boolean;
  message?: string;
  openTime?: Date;
  closeTime?: Date;
}

export async function getQuestionsForScheduledQuiz(
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

export async function updateQuizTaken({
  classCode,
  userId,
}: {
  classCode: string;
  userId: string;
}) {
  try {
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("quiz_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error(quizError?.message || "Quiz not found");
    }

    const { data, error } = await supabase
      .from("quiz_students")
      .update({ quiz_taken: true })
      .eq("class_code", classCode)
      .eq("quiz_student_id", userId)
      .select();

    if (error) {
      throw new Error(`Error updating quiz_taken status: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error updating quiz_taken status:", error);
    throw error;
  }
}

export async function getQuizById(classCode: string) {
  const { data: quizData, error: quizError } = await supabase
    .from("quiz")
    .select("quiz_id, retake")
    .eq("class_code", classCode)
    .single();

  if (quizError) {
    throw new Error("Quiz not found");
  }

  return quizData;
}

/**
 * Check if a scheduled quiz can be accessed without modifying its state
 * Returns status information and validation results
 *
 * CRITICAL: Scheduled quizzes with current_session_id are considered "active"
 * even though their status remains "scheduled" to differentiate from live quizzes
 */
export async function checkScheduledQuizAccess(
  classCode: string,
): Promise<ScheduledQuizStatus> {
  const { data: quizData, error: quizError } = await supabase
    .from("quiz")
    .select("quiz_id, status, open_time, close_time, current_session_id")
    .eq("class_code", classCode)
    .single();

  if (quizError || !quizData) {
    throw new Error("Quiz not found");
  }

  const now = new Date();
  const openTime = quizData.open_time ? new Date(quizData.open_time) : null;
  const closeTime = quizData.close_time ? new Date(quizData.close_time) : null;

  // Check if quiz is scheduled (including in-game and completed scheduled quizzes)
  if (
    quizData.status === QUIZ_STATUS.SCHEDULED ||
    quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
    quizData.status === QUIZ_STATUS.SCHEDULED_COMPLETED
  ) {
    // Completed scheduled quizzes are not accessible for new participation
    if (quizData.status === QUIZ_STATUS.SCHEDULED_COMPLETED) {
      return {
        status: QUIZ_STATUS.SCHEDULED_COMPLETED,
        isOpen: false,
        message:
          "This scheduled quiz has been completed. You can view your results in your dashboard.",
        openTime: openTime || undefined,
        closeTime: closeTime || undefined,
      };
    }

    // In-game scheduled quizzes are active and students can participate
    if (quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME) {
      return {
        status: QUIZ_STATUS.SCHEDULED_IN_GAME,
        isOpen: true,
        message: "Quiz is in progress. You can participate now.",
        openTime: openTime || undefined,
        closeTime: closeTime || undefined,
      };
    }

    // For SCHEDULED status (not yet started), always block students
    // Professor must explicitly start the quiz (status changes to SCHEDULED_IN_GAME)

    if (openTime && now < openTime) {
      return {
        status: QUIZ_STATUS.SCHEDULED,
        isOpen: false,
        message: `This quiz is scheduled and will open at ${openTime.toLocaleString()}. Please wait for the professor to start it.`,
        openTime,
        closeTime: closeTime || undefined,
      };
    }

    if (closeTime && now > closeTime) {
      return {
        status: QUIZ_STATUS.SCHEDULED,
        isOpen: false,
        message: `This quiz has ended. It closed at ${closeTime.toLocaleString()}.`,
        openTime: openTime || undefined,
        closeTime,
      };
    }

    // Quiz is within time window but professor hasn't started it yet
    // Even if quiz has session_id, status must be SCHEDULED_IN_GAME for students to join
    return {
      status: QUIZ_STATUS.SCHEDULED,
      isOpen: false,
      message:
        "This quiz has not started yet. Please wait for the professor to start the scheduled session.",
      openTime: openTime || undefined,
      closeTime: closeTime || undefined,
    };
  }

  // Quiz is in game (live quiz) - students can participate
  if (quizData.status === QUIZ_STATUS.IN_GAME) {
    return {
      status: QUIZ_STATUS.IN_GAME,
      isOpen: true,
      openTime: openTime || undefined,
      closeTime: closeTime || undefined,
    };
  }

  // Other statuses
  return {
    status: quizData.status,
    isOpen: false,
    message: `Quiz is currently ${quizData.status}`,
  };
}

/**
 * Start a scheduled quiz (called by professor)
 * Preserves "scheduled" status and creates session_id for participation tracking
 * Scheduled quizzes remain "scheduled" throughout participation to differentiate from live quizzes
 */
export async function startScheduledQuiz(
  classCode: string,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Starting scheduled quiz for:", classCode, userId);

    // Verify user is quiz owner
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("owner_id, status, open_time, close_time, current_session_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    if (quizData.owner_id !== userId) {
      throw new Error("Only the quiz owner can start the quiz");
    }

    // Ensure quiz is in scheduled status (not completed or already in-game)
    if (
      quizData.status !== QUIZ_STATUS.SCHEDULED &&
      quizData.status !== QUIZ_STATUS.SCHEDULED_IN_GAME &&
      quizData.status !== QUIZ_STATUS.SCHEDULED_COMPLETED
    ) {
      throw new Error(
        `Cannot start quiz. Current status: ${quizData.status}. Only scheduled quizzes can be started.`,
      );
    }

    // Prevent starting a completed scheduled quiz
    if (quizData.status === QUIZ_STATUS.SCHEDULED_COMPLETED) {
      throw new Error(
        "Cannot start quiz. This scheduled quiz has already been completed. You can view results instead.",
      );
    }

    // If already in-game, just return the existing session
    if (quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME) {
      if (quizData.current_session_id) {
        console.log(
          `⚠️ Scheduled quiz already in progress: ${quizData.current_session_id}. Returning existing session.`,
        );
        return quizData.current_session_id;
      }
    }

    // Check if quiz is already started (has session_id)
    if (quizData.current_session_id) {
      console.log(
        `⚠️ Scheduled quiz already has session_id: ${quizData.current_session_id}. Returning existing session.`,
      );
      return quizData.current_session_id;
    }

    // Validate quiz is within the scheduled time window
    if (quizData.open_time && quizData.close_time) {
      const now = new Date();
      const openTime = new Date(quizData.open_time);
      const closeTime = new Date(quizData.close_time);

      if (now < openTime) {
        throw new Error(
          `Cannot start quiz yet. It will be available starting ${openTime.toLocaleString()}.`,
        );
      }

      if (now > closeTime) {
        throw new Error(
          `Cannot start quiz. It closed at ${closeTime.toLocaleString()}.`,
        );
      }
    }

    console.log("🔄 Quiz is within time window. Generating session ID...");

    // Generate unique session ID for this game instance
    const sessionId = crypto.randomUUID();
    console.log("🎮 Starting scheduled quiz session:", sessionId);

    // CRITICAL: Set status to SCHEDULED_IN_GAME when starting
    // This differentiates in-progress scheduled quizzes from live "in game" quizzes

    console.log("🔄 Updating quiz status to SCHEDULED_IN_GAME...");
    const { error: updateError } = await supabase
      .from("quiz")
      .update({
        status: QUIZ_STATUS.SCHEDULED_IN_GAME,
        current_session_id: sessionId,
      })
      .eq("class_code", classCode);

    if (updateError) {
      throw new Error("Failed to start quiz session");
    }

    console.log(
      "🔄 Quiz status updated to SCHEDULED_IN_GAME. Broadcasting event...",
    );

    // Broadcast event to all connected students
    const channel = supabase.channel("scheduled-quiz-room");
    channel.send({
      type: "broadcast",
      event: "scheduled-quiz-started",
      payload: { classCode, sessionId },
    });
    channel.unsubscribe();

    console.log(
      `✅ Scheduled quiz started with status SCHEDULED_IN_GAME: ${classCode}, Session: ${sessionId}`,
    );
    return sessionId;
  } catch (error) {
    console.error("Error starting scheduled quiz:", error);
    throw error;
  }
}

/**
 * Ensures a scheduled quiz has a valid session_id before students can join
 * Creates a new session if quiz is within time window and doesn't have one
 * @deprecated Use checkScheduledQuizAccess() and startScheduledQuiz() instead
 */
export async function ensureScheduledQuizSession(
  classCode: string,
): Promise<string> {
  const { data: quizData, error: quizError } = await supabase
    .from("quiz")
    .select("quiz_id, current_session_id, open_time, close_time, status")
    .eq("class_code", classCode)
    .single();

  if (quizError || !quizData) {
    throw new Error("Quiz not found");
  }

  // Validate quiz is within the scheduled time window
  if (quizData.open_time && quizData.close_time) {
    const now = new Date();
    const openTime = new Date(quizData.open_time);
    const closeTime = new Date(quizData.close_time);

    if (now < openTime) {
      throw new Error(
        `This quiz has not opened yet. It will be available starting ${openTime.toLocaleString()}.`,
      );
    }

    if (now > closeTime) {
      throw new Error(
        `This quiz has ended. It closed at ${closeTime.toLocaleString()}.`,
      );
    }
  }

  // If session already exists, return it
  if (quizData.current_session_id) {
    return quizData.current_session_id;
  }

  // Create a new session for this scheduled quiz
  const newSessionId = crypto.randomUUID();

  const { error: updateError } = await supabase
    .from("quiz")
    .update({
      current_session_id: newSessionId,
      status: "in game", // Set status to in game when session is created
    })
    .eq("class_code", classCode);

  if (updateError) {
    throw new Error("Failed to create quiz session");
  }

  console.log(
    "Created new session for scheduled quiz:",
    classCode,
    "Session:",
    newSessionId,
  );

  return newSessionId;
}

export async function getQuizStudent(
  classCode: string,
  studentId: string,
): Promise<QuizStudentData | null> {
  const { data, error } = await supabase
    .from("quiz_students")
    .select("*")
    .eq("class_code", classCode)
    .eq("quiz_student_id", studentId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching quiz student data:", error);
    return null;
  }

  return data;
}

export async function insertQuizStudent(
  user: User,
  classCode: string,
  name?: string,
) {
  // Check quiz access status without modifying state
  const quizStatus = await checkScheduledQuizAccess(classCode);

  // Block registration if quiz is not open
  if (!quizStatus.isOpen) {
    throw new Error(
      quizStatus.message || "This quiz is not currently available.",
    );
  }

  // Get the current session_id from quiz
  const { data: quizData, error: quizError } = await supabase
    .from("quiz")
    .select("current_session_id, status")
    .eq("class_code", classCode)
    .single();

  if (quizError || !quizData) {
    throw new Error("Quiz not found");
  }

  // CRITICAL: Only allow SCHEDULED_IN_GAME or IN_GAME status
  // Block SCHEDULED status even if it has a session_id - professor must explicitly start it
  const isScheduledQuizActive =
    quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME &&
    !!quizData.current_session_id;
  const isLiveQuizActive = quizData.status === QUIZ_STATUS.IN_GAME;

  // Provide specific error message for scheduled quizzes that haven't started
  if (quizData.status === QUIZ_STATUS.SCHEDULED) {
    throw new Error(
      "This quiz has not started yet. Please wait for the professor to start the scheduled session.",
    );
  }

  if (!isScheduledQuizActive && !isLiveQuizActive) {
    throw new Error("Cannot join quiz. The quiz is not currently active.");
  }

  if (!quizData.current_session_id) {
    throw new Error(
      "No active session found. Please wait for the professor to start the quiz.",
    );
  }

  // Insert student with valid session_id
  const { data, error } = await supabase
    .from("quiz_students")
    .insert([
      {
        quiz_student_id: user.id,
        class_code: classCode,
        student_name: name || user.name,
        student_email: user.email,
        student_avatar: user.avatar,
        quiz_taken: false,
        session_id: quizData.current_session_id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  console.log(
    `✅ Student registered for quiz: ${user.name}, Session: ${quizData.current_session_id}, Status: ${quizData.status}`,
  );
  return data;
}

export async function checkQuizStatus(
  classCode: string,
  user: User,
): Promise<QuizStatusResponse> {
  // Get quiz data
  const quizData = await getQuizById(classCode);
  if (!quizData) {
    throw new Error("Quiz not found");
  }

  // Check if student exists in quiz_students
  const quizStudent = await getQuizStudent(classCode, user.id);

  // Don't insert students here - only check their status
  // Students will be inserted when they actually start the quiz
  return {
    hasTaken: quizStudent?.quiz_taken || false,
    canRetake: quizData.retake || false,
  };
}

// Store individual answer for scheduled quiz
export async function submitScheduledAnswer(
  questionId: string,
  studentId: string,
  answer: string,
  quizId: string,
  classCode: string,
  timeTaken: number = 0,
): Promise<boolean> {
  try {
    // CRITICAL: Validate quiz is active before accepting answers
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("status, current_session_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    // Block answer submission if no valid session exists
    if (!quizData.current_session_id) {
      throw new Error(
        "No active session found. Please wait for the professor to start the quiz.",
      );
    }

    // CRITICAL: Only allow SCHEDULED_IN_GAME or IN_GAME status
    // Block SCHEDULED status even if it has a session_id - professor must explicitly start it
    const isScheduledQuizActive =
      quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME &&
      !!quizData.current_session_id;
    const isLiveQuizActive = quizData.status === QUIZ_STATUS.IN_GAME;

    // Provide specific error message for scheduled quizzes that haven't started
    if (quizData.status === QUIZ_STATUS.SCHEDULED) {
      throw new Error(
        "This quiz has not started yet. Please wait for the professor to start the scheduled session.",
      );
    }

    if (!isScheduledQuizActive && !isLiveQuizActive) {
      throw new Error(
        `Cannot submit answer. Quiz status is ${quizData.status}. The quiz is not currently active.`,
      );
    }

    // Get the correct answer from the database
    const { data: questionData } = await supabase
      .from("quiz_questions")
      .select("right_answer")
      .eq("quiz_question_id", questionId)
      .single();

    const isCorrect = questionData?.right_answer === answer;

    // Get the quiz_students record for this student (includes id, name, email)
    const { data: quizStudent } = await supabase
      .from("quiz_students")
      .select("id, student_name, student_email")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .maybeSingle();

    // Ensure student is registered for this quiz
    if (!quizStudent) {
      throw new Error(
        "Student not registered for this quiz. Please join the quiz first.",
      );
    }

    // Store the individual answer in quiz_student_answers table
    await supabase.from("quiz_student_answers").insert([
      {
        quiz_student_id: quizStudent.id,
        quiz_id: quizId,
        quiz_question_id: questionId,
        class_code: classCode,
        session_id: quizData.current_session_id, // Track session for this answer
        student_answer: answer,
        is_correct: isCorrect,
        time_taken: timeTaken,
        answered_at: new Date().toISOString(),
        student_name: quizStudent.student_name,
        student_email: quizStudent.student_email,
      },
    ]);

    console.log(
      `✅ Answer stored - Session: ${quizData.current_session_id}, Correct: ${isCorrect}`,
    );
    return isCorrect;
  } catch (error) {
    console.error("Error storing individual answer for scheduled quiz:", error);
    throw error;
  }
}

// Update student's total score in quiz_students table
export async function updateScheduledQuizScore(
  classCode: string,
  studentId: string,
  score: number,
  rightAns: number,
  wrongAns: number,
): Promise<void> {
  try {
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

    console.log("Scheduled quiz score updated successfully");
  } catch (error) {
    console.error("Error updating scheduled quiz score:", error);
    throw error;
  }
}

/**
 * Finalize a scheduled quiz - copy data from quiz_students to quiz_history
 * This ensures student dashboards and exports work correctly
 * Should be called when:
 * 1. Student completes all questions
 * 2. Professor manually ends the quiz
 * 3. Quiz reaches close_time (automatic finalization)
 */
export async function finalizeScheduledQuiz(
  classCode: string,
): Promise<boolean> {
  try {
    console.log("🔄 Starting scheduled quiz finalization for:", classCode);

    // Get quiz data including session_id
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("quiz_id, current_session_id, status")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      console.error("❌ Error fetching quiz data:", quizError);
      throw new Error("Quiz not found");
    }

    const { quiz_id: quizId, current_session_id: sessionId, status } = quizData;

    // Check if quiz is already finalized
    if (status === QUIZ_STATUS.SCHEDULED_COMPLETED) {
      console.log(
        "⚠️ Quiz is already finalized (SCHEDULED_COMPLETED). Skipping finalization.",
      );
      return true; // Already finalized, return success
    }

    // Validate quiz was started (has session_id)
    if (!sessionId) {
      console.error("❌ No session_id found - quiz was never started");
      throw new Error(
        "Cannot finalize quiz: No active session found. The quiz may not have been started properly.",
      );
    }

    // Check if quiz is in a state that can be finalized
    // CRITICAL: Scheduled quizzes use SCHEDULED_IN_GAME status when in progress
    // Only finalize if quiz has a session_id (was started by professor)
    if (
      status !== QUIZ_STATUS.IN_GAME &&
      status !== QUIZ_STATUS.SCHEDULED &&
      status !== QUIZ_STATUS.SCHEDULED_IN_GAME
    ) {
      console.log(`⚠️ Quiz status is ${status} - may already be finalized`);
    }

    // Ensure scheduled quiz has session_id before finalizing
    if (
      (status === QUIZ_STATUS.SCHEDULED ||
        status === QUIZ_STATUS.SCHEDULED_IN_GAME) &&
      !sessionId
    ) {
      throw new Error(
        "Cannot finalize scheduled quiz: No active session found. The quiz may not have been started properly.",
      );
    }

    console.log("📝 Quiz ID:", quizId);
    console.log("🎯 Session ID:", sessionId);

    // Call the atomic RPC function with retry logic
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(
        `🔄 Attempt ${attempt}/${maxRetries} to finalize scheduled quiz...`,
      );

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
              "FIX: Run supabase/migrations/002_fix_quiz_history_rls_policies.sql",
            );
            break; // Don't retry RLS errors
          } else if (rpcError.code === "42883") {
            console.error(
              "⚠️ RPC FUNCTION NOT FOUND: rpc_end_game_atomic doesn't exist",
            );
            console.error(
              "FIX: Run supabase/migrations/001_create_atomic_end_game_rpc.sql",
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
            console.log(`✅ Successfully finalized scheduled quiz!`);
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

            // CRITICAL: Update quiz status to SCHEDULED_COMPLETED (not ACTIVE)
            // This keeps scheduled quizzes in the scheduled category after finalization
            // and prevents them from appearing in live quiz tabs
            await supabase
              .from("quiz")
              .update({ status: QUIZ_STATUS.SCHEDULED_COMPLETED })
              .eq("class_code", classCode);

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
    console.error("❌ CRITICAL: All attempts to finalize quiz failed!");
    console.error("Last error:", lastError);
    throw new Error(
      `Failed to finalize quiz after ${maxRetries} attempts: ${lastError}`,
    );
  } catch (error) {
    console.error("❌ Error in finalizeScheduledQuiz:", error);
    throw error;
  }
}

/**
 * Finalize a single student's quiz attempt
 * Used when a student completes all questions in a scheduled quiz
 * This creates a partial finalization for one student only
 */
export async function finalizeStudentAttempt(
  classCode: string,
  studentId: string,
): Promise<boolean> {
  try {
    console.log("📝 Finalizing attempt for student:", studentId);

    // Get quiz and student data
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("quiz_id, current_session_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    const { quiz_id: quizId, current_session_id: sessionId } = quizData;

    if (!sessionId) {
      throw new Error("No active session found");
    }

    // Get student data from quiz_students
    const { data: studentData, error: studentError } = await supabase
      .from("quiz_students")
      .select("*")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
        session_id: sessionId,
      })
      .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (!studentData) {
      console.warn(
        "⚠️ Student not found in quiz_students - may already be finalized",
      );
      return true;
    }

    // Insert into quiz_history
    const { error: insertError } = await supabase.from("quiz_history").insert([
      {
        quiz_id: quizId,
        class_code: classCode,
        quiz_student_id: studentData.quiz_student_id,
        student_name: studentData.student_name,
        student_email: studentData.student_email,
        student_avatar: studentData.student_avatar,
        score: studentData.score || 0,
        right_answer: studentData.right_answer || 0,
        wrong_answer: studentData.wrong_answer || 0,
        placement: studentData.placement || 0,
        quiz_taken: true,
        session_id: sessionId,
        completed_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      // Check if error is due to duplicate (already finalized)
      if (insertError.code === "23505") {
        console.log("✅ Student already finalized - skipping");
        return true;
      }
      throw insertError;
    }

    // Delete from quiz_students
    await supabase.from("quiz_students").delete().match({
      quiz_student_id: studentId,
      class_code: classCode,
      session_id: sessionId,
    });

    console.log("✅ Student attempt finalized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error finalizing student attempt:", error);
    throw error;
  }
}

import { QuizQuestions, User, LeaderboardEntry } from "@/lib/types";
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
        "quiz_question_id, right_answer, question, distractor, time, image_url, points, question_type, order, difficulty",
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

  // CRITICAL: Check both quiz_students and quiz_history for retake prevention
  // This prevents retakes even if quiz_students record was deleted during finalization
  const quizStudent = await getQuizStudent(classCode, user.id);

  // Check quiz_history for completed attempts
  const { data: historyRecord } = await supabase
    .from("quiz_history")
    .select("quiz_taken")
    .eq("class_code", classCode)
    .eq("quiz_student_id", user.id)
    .maybeSingle();

  // Student has taken the quiz if:
  // 1. They have a record in quiz_students with quiz_taken = true, OR
  // 2. They have a record in quiz_history (which means they completed it)
  const hasTaken = quizStudent?.quiz_taken === true || historyRecord !== null;

  // Don't insert students here - only check their status
  // Students will be inserted when they actually start the quiz
  return {
    hasTaken,
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

    // CRITICAL: Get the quiz_students record for this student with session_id validation
    // This ensures the student is registered for the current session
    const { data: quizStudent } = await supabase
      .from("quiz_students")
      .select("id, student_name, student_email, session_id")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
        session_id: quizData.current_session_id, // CRITICAL: Match by session_id
      })
      .maybeSingle();

    // Ensure student is registered for this quiz session
    if (!quizStudent) {
      // Check if student exists but with different session_id (retake scenario)
      const { data: otherSessionStudent } = await supabase
        .from("quiz_students")
        .select("session_id")
        .match({
          quiz_student_id: studentId,
          class_code: classCode,
        })
        .maybeSingle();

      if (otherSessionStudent) {
        throw new Error(
          "Student is registered for a different quiz session. Please refresh and rejoin the quiz.",
        );
      }

      // Check if student has already completed this quiz (in quiz_history)
      const { data: historyRecord } = await supabase
        .from("quiz_history")
        .select("quiz_student_id")
        .eq("class_code", classCode)
        .eq("quiz_student_id", studentId)
        .maybeSingle();

      if (historyRecord) {
        throw new Error(
          "You have already completed this quiz. Retakes are not allowed.",
        );
      }

      throw new Error(
        "Student not registered for this quiz session. Please join the quiz first.",
      );
    }

    // CRITICAL: Verify session_id matches (double-check)
    if (quizStudent.session_id !== quizData.current_session_id) {
      throw new Error("Session mismatch. Please refresh and rejoin the quiz.");
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

    // CRITICAL: Immediately update score in quiz_students for real-time leaderboard updates
    // Get all answers for this student to calculate current score
    const { data: allAnswers } = await supabase
      .from("quiz_student_answers")
      .select("is_correct, quiz_questions(points)")
      .eq("quiz_student_id", quizStudent.id)
      .eq("class_code", classCode)
      .eq("session_id", quizData.current_session_id);

    if (allAnswers && allAnswers.length > 0) {
      // Recalculate score from all answers
      let totalScore = 0;
      let rightAns = 0;
      let wrongAns = 0;

      allAnswers.forEach((answerData: {
        is_correct: boolean;
        quiz_questions?: { points?: number }[] | null;
      }) => {
        const points = answerData.quiz_questions?.[0]?.points || 0;
        if (answerData.is_correct) {
          totalScore += points;
          rightAns++;
        } else {
          wrongAns++;
        }
      });

      // Update quiz_students with recalculated score for real-time leaderboard
      await supabase
        .from("quiz_students")
        .update({
          score: totalScore,
          right_answer: rightAns,
          wrong_answer: wrongAns,
          session_id: quizData.current_session_id, // Ensure session_id is preserved
        })
        .match({
          id: quizStudent.id,
          quiz_student_id: studentId,
          class_code: classCode,
          session_id: quizData.current_session_id,
        });

      console.log(
        `✅ Answer stored and score updated - Session: ${quizData.current_session_id}, Score: ${totalScore}, Correct: ${isCorrect}`,
      );
    } else {
      console.log(
        `✅ Answer stored - Session: ${quizData.current_session_id}, Correct: ${isCorrect}`,
      );
    }

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
 * Update leaderboard for scheduled quizzes
 * CRITICAL: Ensures session_id exists before updating quiz_students
 * This prevents NULL session_id constraint violations
 */
export async function updateScheduledQuizLeaderboard(
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
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("current_session_id, status")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    const sessionId = quizData?.current_session_id;

    // CRITICAL: Enforce valid session before updating leaderboard
    // This prevents NULL session_id records that cause sync issues
    if (!sessionId) {
      console.error(
        "🚫 BLOCKED: No active session_id for scheduled quiz class_code:",
        classCode,
      );
      throw new Error(
        "Quiz session not started. Cannot update leaderboard. Please wait for the professor to start the quiz.",
      );
    }

    // Verify quiz is in active status
    const isScheduledQuizActive =
      quizData.status === QUIZ_STATUS.SCHEDULED_IN_GAME && !!sessionId;
    const isLiveQuizActive = quizData.status === QUIZ_STATUS.IN_GAME;

    if (!isScheduledQuizActive && !isLiveQuizActive) {
      throw new Error(
        `Cannot update leaderboard. Quiz status is ${quizData.status}. The quiz is not currently active.`,
      );
    }

    // Check if student exists in quiz_students
    const { data: existingStudent, error: fetchError } = await supabase
      .from("quiz_students")
      .select("quiz_student_id, score, id")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
        session_id: sessionId, // CRITICAL: Match by session_id to ensure correct session
      })
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingStudent) {
      // CRITICAL: Insert student with valid session_id
      // This ensures the student record is created before finalization
      const { error: insertError } = await supabase
        .from("quiz_students")
        .insert([
          {
            quiz_student_id: studentId,
            student_name: studentName,
            student_avatar: studentAvatar,
            student_email: studentEmail,
            score: score,
            class_code: classCode,
            session_id: sessionId, // CRITICAL: Must have valid session_id
            right_answer: rightAns,
            wrong_answer: wrongAns,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error(
          "❌ Failed to insert student into quiz_students:",
          insertError,
        );
        throw new Error(
          `Failed to register student attempt: ${insertError.message}`,
        );
      }

      console.log(
        "✅ New student added to scheduled quiz:",
        studentId,
        "Session:",
        sessionId,
      );
    } else {
      // Update existing student record
      const { error: updateError } = await supabase
        .from("quiz_students")
        .update({
          score: score,
          right_answer: rightAns,
          wrong_answer: wrongAns,
          session_id: sessionId, // Ensure session_id is set
        })
        .match({
          quiz_student_id: studentId,
          class_code: classCode,
          session_id: sessionId, // Match by session_id
        });

      if (updateError) {
        console.error("❌ Failed to update student score:", updateError);
        throw updateError;
      }

      console.log(
        "✅ Student score updated:",
        studentId,
        "Session:",
        sessionId,
      );
    }

    // Get all students for leaderboard ranking
    const { data: allStudents, error: leaderboardError } = await supabase
      .from("quiz_students")
      .select(
        "quiz_student_id, score, id, right_answer, wrong_answer, student_name, student_avatar, student_email",
      )
      .eq("class_code", classCode)
      .eq("session_id", sessionId) // CRITICAL: Only get students from this session
      .order("score", { ascending: false });

    if (leaderboardError) {
      throw leaderboardError;
    }

    if (allStudents && allStudents.length > 0) {
      // Update placements
      // CRITICAL: Must include session_id in updates to prevent NULL constraint violation
      const updates = allStudents.map((student, index) => ({
        id: student.id,
        quiz_student_id: student.quiz_student_id,
        placement: index + 1,
        session_id: sessionId, // CRITICAL: Preserve session_id in update
      }));

      // Use update instead of upsert to avoid constraint issues
      // Update each student's placement individually to ensure session_id is preserved
      const updatePromises = updates.map((update) =>
        supabase
          .from("quiz_students")
          .update({
            placement: update.placement,
            session_id: update.session_id, // Ensure session_id is set
          })
          .match({
            id: update.id,
            quiz_student_id: update.quiz_student_id,
            session_id: sessionId, // Match by session_id to ensure correct record
          }),
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        console.error("⚠️ Failed to update some placements:", errors);
        // Don't throw - leaderboard data is still valid
      }

      console.log("✅ Scheduled quiz leaderboard updated successfully");
      return allStudents;
    }

    return [];
  } catch (error) {
    console.error("❌ Error updating scheduled quiz leaderboard:", error);
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
    console.log("🔄 Finalizing student attempt for scheduled quiz...");
    console.log("📝 Student ID:", studentId, "Class Code:", classCode);

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
      throw new Error(
        "No active session found. The quiz may not have been started properly.",
      );
    }

    // CRITICAL: Check if student already exists in quiz_history (already finalized)
    const { data: existingHistory } = await supabase
      .from("quiz_history")
      .select("quiz_student_id")
      .eq("class_code", classCode)
      .eq("quiz_student_id", studentId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingHistory) {
      console.log(
        "✅ Student already finalized - skipping duplicate finalization",
      );
      return true;
    }

    // Get student data from quiz_students
    // CRITICAL: Must match by session_id to ensure we're finalizing the correct attempt
    const { data: studentData, error: studentError } = await supabase
      .from("quiz_students")
      .select("*")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
        session_id: sessionId, // CRITICAL: Match by session_id
      })
      .maybeSingle();

    if (studentError) {
      console.error("❌ Error fetching student data:", studentError);
      throw studentError;
    }

    if (!studentData) {
      console.warn(
        "⚠️ Student not found in quiz_students with session_id:",
        sessionId,
      );
      console.warn(
        "This may indicate the student record was already deleted or never created.",
      );

      // Check if student exists in quiz_history (already finalized)
      const { data: historyCheck } = await supabase
        .from("quiz_history")
        .select("quiz_student_id")
        .eq("class_code", classCode)
        .eq("quiz_student_id", studentId)
        .maybeSingle();

      if (historyCheck) {
        console.log(
          "✅ Student already finalized (found in quiz_history) - skipping",
        );
        return true;
      }

      // If no record exists in either table, this is an error
      throw new Error(
        "Student record not found. Cannot finalize attempt. Please ensure the student completed the quiz.",
      );
    }

    // CRITICAL: Insert into quiz_history BEFORE deleting from quiz_students
    // This ensures data is preserved even if deletion fails
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
        session_id: sessionId, // CRITICAL: Preserve session_id in history
        completed_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      // Check if error is due to duplicate (already finalized)
      if (insertError.code === "23505") {
        console.log("✅ Student already finalized (duplicate key) - skipping");
        return true;
      }
      console.error("❌ Failed to insert into quiz_history:", insertError);
      throw new Error(
        `Failed to finalize student attempt: ${insertError.message}`,
      );
    }

    console.log("✅ Successfully inserted into quiz_history");

    // Delete from quiz_students AFTER successful insert
    // This ensures data is preserved even if deletion fails
    const { error: deleteError } = await supabase
      .from("quiz_students")
      .delete()
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
        session_id: sessionId, // CRITICAL: Match by session_id
      });

    if (deleteError) {
      console.error("⚠️ Failed to delete from quiz_students:", deleteError);
      // Don't throw - data is already in quiz_history, so finalization succeeded
      console.warn(
        "⚠️ Student data remains in quiz_students but is also in quiz_history",
      );
    } else {
      console.log("✅ Successfully deleted from quiz_students");
    }

    console.log("✅ Student attempt finalized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error finalizing student attempt:", error);
    throw error;
  }
}

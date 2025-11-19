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
 */
export async function checkScheduledQuizAccess(
  classCode: string,
): Promise<ScheduledQuizStatus> {
  const { data: quizData, error: quizError } = await supabase
    .from("quiz")
    .select("quiz_id, status, open_time, close_time")
    .eq("class_code", classCode)
    .single();

  if (quizError || !quizData) {
    throw new Error("Quiz not found");
  }

  const now = new Date();
  const openTime = quizData.open_time ? new Date(quizData.open_time) : null;
  const closeTime = quizData.close_time ? new Date(quizData.close_time) : null;

  // Check if quiz is scheduled but not yet started by professor
  if (quizData.status === QUIZ_STATUS.SCHEDULED) {
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

    // Quiz is within time window but still scheduled - needs professor to start
    return {
      status: QUIZ_STATUS.SCHEDULED,
      isOpen: false,
      message: "This quiz is scheduled. Please wait for the professor to start it.",
      openTime: openTime || undefined,
      closeTime: closeTime || undefined,
    };
  }

  // Quiz is in game - students can participate
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
 * Changes status from "scheduled" to "in game" and creates session_id
 */
export async function startScheduledQuiz(
  classCode: string,
  userId: string,
): Promise<string> {
  try {
    // Verify user is quiz owner
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("owner_id, status, open_time, close_time")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    if (quizData.owner_id !== userId) {
      throw new Error("Only the quiz owner can start the quiz");
    }

    // Ensure quiz is in scheduled status
    if (quizData.status !== QUIZ_STATUS.SCHEDULED) {
      throw new Error(
        `Cannot start quiz. Current status: ${quizData.status}. Only scheduled quizzes can be started.`,
      );
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

    // Generate unique session ID for this game instance
    const sessionId = crypto.randomUUID();
    console.log("🎮 Starting scheduled quiz session:", sessionId);

    // Update status to IN_GAME and set session_id
    const { error: updateError } = await supabase
      .from("quiz")
      .update({
        status: QUIZ_STATUS.IN_GAME,
        current_session_id: sessionId,
      })
      .eq("class_code", classCode);

    if (updateError) {
      throw new Error("Failed to start quiz session");
    }

    // Broadcast event to all connected students
    const channel = supabase.channel("scheduled-quiz-room");
    channel.send({
      type: "broadcast",
      event: "scheduled-quiz-started",
      payload: { classCode, sessionId },
    });
    channel.unsubscribe();

    console.log(
      `✅ Scheduled quiz started: ${classCode}, Session: ${sessionId}`,
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

  // Block registration if quiz is not in game
  if (quizStatus.status === QUIZ_STATUS.SCHEDULED) {
    throw new Error(
      quizStatus.message ||
        "This quiz is scheduled. Please wait for the professor to start it.",
    );
  }

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

  // Verify quiz is in game and has a valid session
  if (quizData.status !== QUIZ_STATUS.IN_GAME) {
    throw new Error(
      "Cannot join quiz. The professor has not started the quiz yet.",
    );
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
    `✅ Student registered for quiz: ${user.name}, Session: ${quizData.current_session_id}`,
  );
  return data;
}

export async function checkQuizStatus(
  classCode: string,
  user: User,
  name?: string,
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
    // CRITICAL: Validate quiz is in game before accepting answers
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("status, current_session_id")
      .eq("class_code", classCode)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    // Block answer submission if quiz is still scheduled
    if (quizData.status === QUIZ_STATUS.SCHEDULED) {
      throw new Error(
        "Cannot submit answer. The quiz is scheduled but not started. Please wait for the professor to start it.",
      );
    }

    // Block answer submission if no valid session exists
    if (!quizData.current_session_id) {
      throw new Error(
        "No active session found. Please wait for the professor to start the quiz.",
      );
    }

    // Verify quiz is in game status
    if (quizData.status !== QUIZ_STATUS.IN_GAME) {
      throw new Error(
        `Cannot submit answer. Quiz status is ${quizData.status}. Only active quizzes accept answers.`,
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

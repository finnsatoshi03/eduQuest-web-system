import { QuizQuestions, User } from "@/lib/types";
import supabase from "../supabase";

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

export async function getQuizStudent(
  classCode: string,
  studentId: string,
): Promise<QuizStudentData | null> {
  const { data, error } = await supabase
    .from("quiz_students")
    .select("*")
    .eq("class_code", classCode)
    .eq("quiz_student_id", studentId)
    .single();

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
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

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
  let quizStudent = await getQuizStudent(classCode, user.id);

  // If student doesn't exist, insert them
  if (!quizStudent) {
    quizStudent = await insertQuizStudent(user, classCode, name);
  }

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
      .single();

    // Store the individual answer in quiz_student_answers table
    // Include student_name, student_email, and class_code for permanent storage
    await supabase.from("quiz_student_answers").insert([
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

    console.log("Individual answer stored successfully for scheduled quiz");
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

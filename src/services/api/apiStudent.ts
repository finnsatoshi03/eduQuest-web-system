/* eslint-disable @typescript-eslint/no-explicit-any */
import supabase from "../supabase";

export interface StudentQuizHistory {
  id: string;
  quiz_id: string;
  quiz_title: string;
  subject: string;
  score: number;
  total_points: number;
  right_answer: number;
  wrong_answer: number;
  placement: number;
  accuracy: number;
  quiz_taken: boolean;
  created_at: string;
  cover_image: string;
  retake: boolean;
}

export interface StudentPerformanceStats {
  total_quizzes: number;
  average_score: number;
  average_accuracy: number;
  best_score: number;
  worst_score: number;
  total_correct_answers: number;
  total_wrong_answers: number;
  recent_performance: "improving" | "declining" | "stable";
}

export interface SubjectPerformance {
  subject: string;
  quiz_count: number;
  average_score: number;
  average_accuracy: number;
  total_points_earned: number;
  total_points_possible: number;
}

export interface QuizAnswer {
  question: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points_earned: number;
  points_possible: number;
  time_taken: number;
  question_type: string;
}

/**
 * Get student's quiz history with quiz details
 * NOW READS FROM quiz_history (permanent storage)
 * @param studentId - The student's ID
 * @returns Promise<StudentQuizHistory[]>
 */
export async function getStudentQuizHistory(
  studentId: string,
): Promise<StudentQuizHistory[]> {
  try {
    // Read from quiz_history table (permanent storage)
    const { data, error } = await supabase
      .from("quiz_history")
      .select(
        `
        id,
        quiz_id,
        quiz_student_id,
        class_code,
        score,
        right_answer,
        wrong_answer,
        placement,
        quiz_taken,
        completed_at,
        quiz:quiz_id (
          title,
          subject,
          total_points,
          created_at,
          cover_image,
          retake
        )
      `,
      )
      .eq("quiz_student_id", studentId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Error fetching student quiz history:", error);
      return [];
    }

    // Format the data
    const formattedHistory: StudentQuizHistory[] = (data || [])
      .filter((record: any) => record.quiz) // Only include records with quiz data
      .map((record: any) => {
        const totalAnswers =
          (record.right_answer || 0) + (record.wrong_answer || 0);
        const accuracy = totalAnswers > 0
          ? ((record.right_answer || 0) / totalAnswers) * 100
          : 0;

        return {
          id: record.id,
          quiz_id: record.quiz?.quiz_id || "",
          quiz_title: record.quiz?.title || "Unknown Quiz",
          subject: record.quiz?.subject || "General",
          score: record.score || 0,
          total_points: record.quiz?.total_points || 0,
          right_answer: record.right_answer || 0,
          wrong_answer: record.wrong_answer || 0,
          placement: record.placement || 0,
          accuracy: parseFloat(accuracy.toFixed(2)),
          quiz_taken: record.quiz_taken || false,
          created_at: record.quiz?.created_at || new Date().toISOString(),
          cover_image: record.quiz?.cover_image || "",
          retake: record.quiz?.retake || false,
        };
      });

    return formattedHistory;
  } catch (error) {
    console.error("Error in getStudentQuizHistory:", error);
    return [];
  }
}

/**
 * Get student's performance statistics
 * @param studentId - The student's ID
 * @returns Promise<StudentPerformanceStats>
 */
export async function getStudentPerformanceStats(
  studentId: string,
): Promise<StudentPerformanceStats> {
  try {
    const history = await getStudentQuizHistory(studentId);

    if (history.length === 0) {
      return {
        total_quizzes: 0,
        average_score: 0,
        average_accuracy: 0,
        best_score: 0,
        worst_score: 0,
        total_correct_answers: 0,
        total_wrong_answers: 0,
        recent_performance: "stable",
      };
    }

    const scores = history.map((h) => h.score);
    const accuracies = history.map((h) => h.accuracy);

    const totalQuizzes = history.length;
    const averageScore =
      scores.reduce((a, b) => a + b, 0) / totalQuizzes;
    const averageAccuracy =
      accuracies.reduce((a, b) => a + b, 0) / totalQuizzes;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const totalCorrectAnswers = history.reduce(
      (sum, h) => sum + h.right_answer,
      0,
    );
    const totalWrongAnswers = history.reduce(
      (sum, h) => sum + h.wrong_answer,
      0,
    );

    // Calculate recent performance trend (last 3 vs previous 3)
    let recentPerformance: "improving" | "declining" | "stable" = "stable";
    if (totalQuizzes >= 6) {
      const recent3 = history.slice(0, 3);
      const previous3 = history.slice(3, 6);

      const recentAvg =
        recent3.reduce((sum, h) => sum + h.accuracy, 0) / 3;
      const previousAvg =
        previous3.reduce((sum, h) => sum + h.accuracy, 0) / 3;

      if (recentAvg > previousAvg + 5) {
        recentPerformance = "improving";
      } else if (recentAvg < previousAvg - 5) {
        recentPerformance = "declining";
      }
    }

    return {
      total_quizzes: totalQuizzes,
      average_score: parseFloat(averageScore.toFixed(2)),
      average_accuracy: parseFloat(averageAccuracy.toFixed(2)),
      best_score: bestScore,
      worst_score: worstScore,
      total_correct_answers: totalCorrectAnswers,
      total_wrong_answers: totalWrongAnswers,
      recent_performance: recentPerformance,
    };
  } catch (error) {
    console.error("Error calculating student performance stats:", error);
    return {
      total_quizzes: 0,
      average_score: 0,
      average_accuracy: 0,
      best_score: 0,
      worst_score: 0,
      total_correct_answers: 0,
      total_wrong_answers: 0,
      recent_performance: "stable",
    };
  }
}

/**
 * Get student's performance by subject
 * @param studentId - The student's ID
 * @returns Promise<SubjectPerformance[]>
 */
export async function getStudentPerformanceBySubject(
  studentId: string,
): Promise<SubjectPerformance[]> {
  try {
    const history = await getStudentQuizHistory(studentId);

    if (history.length === 0) {
      return [];
    }

    // Group by subject
    const subjectMap = new Map<string, StudentQuizHistory[]>();

    history.forEach((quiz) => {
      const subject = quiz.subject || "General";
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, []);
      }
      subjectMap.get(subject)!.push(quiz);
    });

    // Calculate stats for each subject
    const subjectPerformance: SubjectPerformance[] = Array.from(
      subjectMap.entries(),
    ).map(([subject, quizzes]) => {
      const quizCount = quizzes.length;
      const averageScore =
        quizzes.reduce((sum, q) => sum + q.score, 0) / quizCount;
      const averageAccuracy =
        quizzes.reduce((sum, q) => sum + q.accuracy, 0) / quizCount;
      const totalPointsEarned = quizzes.reduce((sum, q) => sum + q.score, 0);
      const totalPointsPossible = quizzes.reduce(
        (sum, q) => sum + q.total_points,
        0,
      );

      return {
        subject,
        quiz_count: quizCount,
        average_score: parseFloat(averageScore.toFixed(2)),
        average_accuracy: parseFloat(averageAccuracy.toFixed(2)),
        total_points_earned: totalPointsEarned,
        total_points_possible: totalPointsPossible,
      };
    });

    // Sort by quiz count (most quizzes first)
    return subjectPerformance.sort((a, b) => b.quiz_count - a.quiz_count);
  } catch (error) {
    console.error("Error calculating subject performance:", error);
    return [];
  }
}

/**
 * Get student's answers for a specific quiz (for review)
 * @param studentId - The student's ID
 * @param quizId - The quiz ID
 * @param classCode - The class code
 * @returns Promise<QuizAnswer[]>
 */
export async function getStudentAnswersByQuiz(
  studentId: string,
  quizId: string,
  classCode: string,
): Promise<QuizAnswer[]> {
  try {
    // First, get the quiz_students.id
    const { data: quizStudentData, error: quizStudentError } = await supabase
      .from("quiz_students")
      .select("id")
      .match({
        quiz_student_id: studentId,
        class_code: classCode,
      })
      .single();

    if (quizStudentError || !quizStudentData) {
      console.error("Quiz student record not found:", quizStudentError);
      return [];
    }

    // Fetch individual answers with question details
    const { data, error } = await supabase
      .from("quiz_student_answers")
      .select(
        `
        *,
        quiz_questions!inner(
          question,
          right_answer,
          points,
          question_type
        )
      `,
      )
      .eq("quiz_student_id", quizStudentData.id)
      .eq("quiz_id", quizId);

    if (error) {
      console.error("Error fetching student answers:", error);
      return [];
    }

    // Format the answers
    const formattedAnswers: QuizAnswer[] = (data || []).map((answer: any) => ({
      question: answer.quiz_questions?.question || "N/A",
      student_answer: answer.student_answer || "No answer",
      correct_answer: answer.quiz_questions?.right_answer || "N/A",
      is_correct: answer.is_correct || false,
      points_earned: answer.is_correct
        ? answer.quiz_questions?.points || 0
        : 0,
      points_possible: answer.quiz_questions?.points || 0,
      time_taken: answer.time_taken || 0,
      question_type: answer.quiz_questions?.question_type || "unknown",
    }));

    return formattedAnswers;
  } catch (error) {
    console.error("Error in getStudentAnswersByQuiz:", error);
    return [];
  }
}

/**
 * Filter student quiz history by date range
 * @param studentId - The student's ID
 * @param filterType - "week" | "month" | "all"
 * @returns Promise<StudentQuizHistory[]>
 */
export async function getFilteredQuizHistory(
  studentId: string,
  filterType: "week" | "month" | "all" = "all",
): Promise<StudentQuizHistory[]> {
  try {
    const allHistory = await getStudentQuizHistory(studentId);

    if (filterType === "all") {
      return allHistory;
    }

    const now = new Date();
    let cutoffDate: Date;

    if (filterType === "week") {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // month
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return allHistory.filter(
      (quiz) => new Date(quiz.created_at) >= cutoffDate,
    );
  } catch (error) {
    console.error("Error filtering quiz history:", error);
    return [];
  }
}

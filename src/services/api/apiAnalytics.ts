import supabase from "../supabase";

export interface ProfessorOverallStats {
  total_quizzes: number;
  total_students: number;
  total_quiz_attempts: number;
  average_completion_rate: number;
  average_class_score: number;
  quizzes_this_week: number;
  quizzes_this_month: number;
}

export interface QuizDetailedAnalytics {
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string;
  total_points: number;
  total_students: number;
  average_score: number;
  median_score: number;
  highest_score: number;
  lowest_score: number;
  std_deviation: number;
  completion_rate: number;
  average_accuracy: number;
  score_distribution: { range: string; count: number }[];
}

export interface PerformanceTrendData {
  date: string;
  quiz_count: number;
  average_score: number;
  average_accuracy: number;
  total_students: number;
}

export interface QuestionDifficultyAnalysis {
  quiz_question_id: string;
  question: string;
  question_type: string;
  points: number;
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  accuracy_percentage: number;
  average_time_taken: number;
}

/**
 * Get professor's overall statistics across all quizzes
 * @param professorId - Professor's user ID
 * @returns Promise<ProfessorOverallStats>
 */
export async function getProfessorOverallStats(
  professorId: string,
): Promise<ProfessorOverallStats> {
  try {
    // Get all quizzes by professor
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quiz")
      .select("quiz_id, created_at")
      .eq("owner_id", professorId);

    if (quizzesError) throw quizzesError;

    const totalQuizzes = quizzes?.length || 0;

    if (totalQuizzes === 0) {
      return {
        total_quizzes: 0,
        total_students: 0,
        total_quiz_attempts: 0,
        average_completion_rate: 0,
        average_class_score: 0,
        quizzes_this_week: 0,
        quizzes_this_month: 0,
      };
    }

    // Get quiz IDs
    const quizIds = quizzes?.map((q) => q.quiz_id) || [];

    // Get all student attempts for these quizzes from quiz_history (permanent storage)
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_history")
      .select("*")
      .in("quiz_id", quizIds);

    if (attemptsError) console.error("Error fetching attempts:", attemptsError);

    const totalAttempts = attempts?.length || 0;
    const uniqueStudents = new Set(
      attempts?.map((a) => a.quiz_student_id) || [],
    ).size;
    const averageClassScore =
      totalAttempts > 0
        ? attempts!.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts
        : 0;

    // Calculate date ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const quizzesThisWeek = quizzes?.filter(
      (q) => new Date(q.created_at) >= oneWeekAgo,
    ).length || 0;

    const quizzesThisMonth = quizzes?.filter(
      (q) => new Date(q.created_at) >= oneMonthAgo,
    ).length || 0;

    return {
      total_quizzes: totalQuizzes,
      total_students: uniqueStudents,
      total_quiz_attempts: totalAttempts,
      average_completion_rate: 0, // Can be calculated if you track expected vs actual students
      average_class_score: parseFloat(averageClassScore.toFixed(2)),
      quizzes_this_week: quizzesThisWeek,
      quizzes_this_month: quizzesThisMonth,
    };
  } catch (error) {
    console.error("Error getting professor overall stats:", error);
    return {
      total_quizzes: 0,
      total_students: 0,
      total_quiz_attempts: 0,
      average_completion_rate: 0,
      average_class_score: 0,
      quizzes_this_week: 0,
      quizzes_this_month: 0,
    };
  }
}

/**
 * Get detailed analytics for a specific quiz
 * @param quizId - The quiz ID
 * @param classCode - The class code
 * @returns Promise<QuizDetailedAnalytics>
 */
export async function getQuizDetailedAnalytics(
  quizId: string,
  classCode: string,
): Promise<QuizDetailedAnalytics | null> {
  try {
    void classCode;

    // Get quiz details
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .select("title, subject, total_points")
      .eq("quiz_id", quizId)
      .single();

    if (quizError || !quiz) {
      console.error("Error fetching quiz:", quizError);
      return null;
    }

    // Get all student results from quiz_history (permanent storage)
    const { data: students, error: studentsError } = await supabase
      .from("quiz_history")
      .select("score, right_answer, wrong_answer")
      .eq("quiz_id", quizId);

    if (studentsError) {
      console.error("Error fetching students:", studentsError);
      return null;
    }

    const totalStudents = students?.length || 0;

    if (totalStudents === 0) {
      return {
        quiz_id: quizId,
        quiz_title: quiz.title,
        quiz_subject: quiz.subject,
        total_points: quiz.total_points,
        total_students: 0,
        average_score: 0,
        median_score: 0,
        highest_score: 0,
        lowest_score: 0,
        std_deviation: 0,
        completion_rate: 0,
        average_accuracy: 0,
        score_distribution: [],
      };
    }

    // Calculate statistics
    const scores = students!.map((s) => s.score || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalStudents;

    // Sort for median and min/max
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    // Calculate standard deviation
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) /
      totalStudents;
    const stdDeviation = Math.sqrt(variance);

    // Calculate accuracy
    const totalCorrect = students!.reduce(
      (sum, s) => sum + (s.right_answer || 0),
      0,
    );
    const totalAnswers =
      students!.reduce(
        (sum, s) => sum + (s.right_answer || 0) + (s.wrong_answer || 0),
        0,
      ) || 1;
    const averageAccuracy = (totalCorrect / totalAnswers) * 100;

    // Score distribution (0-25%, 26-50%, 51-75%, 76-100%)
    const scoreDistribution = [
      {
        range: "0-25%",
        count: scores.filter((s) => s <= quiz.total_points * 0.25).length,
      },
      {
        range: "26-50%",
        count: scores.filter(
          (s) => s > quiz.total_points * 0.25 && s <= quiz.total_points * 0.5,
        ).length,
      },
      {
        range: "51-75%",
        count: scores.filter(
          (s) => s > quiz.total_points * 0.5 && s <= quiz.total_points * 0.75,
        ).length,
      },
      {
        range: "76-100%",
        count: scores.filter((s) => s > quiz.total_points * 0.75).length,
      },
    ];

    return {
      quiz_id: quizId,
      quiz_title: quiz.title,
      quiz_subject: quiz.subject,
      total_points: quiz.total_points,
      total_students: totalStudents,
      average_score: parseFloat(averageScore.toFixed(2)),
      median_score: medianScore,
      highest_score: highestScore,
      lowest_score: lowestScore,
      std_deviation: parseFloat(stdDeviation.toFixed(2)),
      completion_rate: 100, // Assuming all students completed
      average_accuracy: parseFloat(averageAccuracy.toFixed(2)),
      score_distribution: scoreDistribution,
    };
  } catch (error) {
    console.error("Error getting quiz detailed analytics:", error);
    return null;
  }
}

/**
 * Get performance trends over time
 * @param professorId - Professor's user ID
 * @param timeFilter - "week" or "month"
 * @returns Promise<PerformanceTrendData[]>
 */
export async function getPerformanceTrends(
  professorId: string,
  timeFilter: "week" | "month",
): Promise<PerformanceTrendData[]> {
  try {
    const daysBack = timeFilter === "week" ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Get quizzes created within timeframe
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quiz")
      .select("quiz_id, class_code, created_at")
      .eq("owner_id", professorId)
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: true });

    if (quizzesError || !quizzes || quizzes.length === 0) {
      return [];
    }

    // Group quizzes by date
    const dataByDate = new Map<string, PerformanceTrendData>();

    for (const quiz of quizzes) {
      const dateKey = new Date(quiz.created_at).toISOString().split("T")[0];

      // Get students for this quiz from quiz_history (permanent storage)
      const { data: students } = await supabase
        .from("quiz_history")
        .select("score, right_answer, wrong_answer")
        .eq("quiz_id", quiz.quiz_id);

      if (!students || students.length === 0) continue;

      const avgScore =
        students.reduce((sum, s) => sum + (s.score || 0), 0) / students.length;
      const totalCorrect = students.reduce(
        (sum, s) => sum + (s.right_answer || 0),
        0,
      );
      const totalAnswers =
        students.reduce(
          (sum, s) => sum + (s.right_answer || 0) + (s.wrong_answer || 0),
          0,
        ) || 1;
      const avgAccuracy = (totalCorrect / totalAnswers) * 100;

      if (dataByDate.has(dateKey)) {
        const existing = dataByDate.get(dateKey)!;
        existing.quiz_count += 1;
        existing.average_score =
          (existing.average_score * (existing.quiz_count - 1) + avgScore) /
          existing.quiz_count;
        existing.average_accuracy =
          (existing.average_accuracy * (existing.quiz_count - 1) + avgAccuracy) /
          existing.quiz_count;
        existing.total_students += students.length;
      } else {
        dataByDate.set(dateKey, {
          date: dateKey,
          quiz_count: 1,
          average_score: avgScore,
          average_accuracy: avgAccuracy,
          total_students: students.length,
        });
      }
    }

    return Array.from(dataByDate.values()).map((data) => ({
      ...data,
      average_score: parseFloat(data.average_score.toFixed(2)),
      average_accuracy: parseFloat(data.average_accuracy.toFixed(2)),
    }));
  } catch (error) {
    console.error("Error getting performance trends:", error);
    return [];
  }
}

/**
 * Get question difficulty analysis for a quiz
 * @param quizId - The quiz ID
 * @returns Promise<QuestionDifficultyAnalysis[]>
 */
export async function getQuestionDifficultyAnalysis(
  quizId: string,
): Promise<QuestionDifficultyAnalysis[]> {
  try {
    // Get all questions for the quiz
    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order", { ascending: true });

    if (questionsError || !questions) {
      console.error("Error fetching questions:", questionsError);
      return [];
    }

    // Get answer data for each question
    const analysisPromises = questions.map(async (question) => {
      const { data: answers } = await supabase
        .from("quiz_student_answers")
        .select("is_correct, time_taken")
        .eq("quiz_question_id", question.quiz_question_id);

      const totalAttempts = answers?.length || 0;
      const correctAttempts =
        answers?.filter((a) => a.is_correct).length || 0;
      const incorrectAttempts = totalAttempts - correctAttempts;
      const accuracyPercentage =
        totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
      const averageTimeTaken =
        totalAttempts > 0
          ? answers!.reduce((sum, a) => sum + (a.time_taken || 0), 0) /
            totalAttempts
          : 0;

      return {
        quiz_question_id: question.quiz_question_id,
        question: question.question,
        question_type: question.question_type,
        points: question.points,
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts,
        incorrect_attempts: incorrectAttempts,
        accuracy_percentage: parseFloat(accuracyPercentage.toFixed(2)),
        average_time_taken: parseFloat(averageTimeTaken.toFixed(2)),
      };
    });

    const analysis = await Promise.all(analysisPromises);

    // Sort by accuracy (hardest questions first)
    return analysis.sort(
      (a, b) => a.accuracy_percentage - b.accuracy_percentage,
    );
  } catch (error) {
    console.error("Error getting question difficulty analysis:", error);
    return [];
  }
}

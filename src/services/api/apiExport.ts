/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import supabase from "../supabase";

interface QuizMetadata {
  quiz_id: string;
  title: string;
  subject: string;
  description: string;
  total_points: number;
  max_items: number;
  created_at: string;
  question_type: string;
}

interface StudentResult {
  student_name: string;
  student_email: string;
  score: number;
  right_answer: number;
  wrong_answer: number;
  placement: number;
  accuracy: number;
}

interface DetailedAnswer {
  student_name: string;
  student_email: string;
  question: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points: number;
  time_taken: number;
}

interface QuestionAnalytics {
  question: string;
  correct_answer: string;
  total_responses: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_percentage: number;
  average_time: number;
  points: number;
}

/**
 * Export quiz results to Excel with multiple sheets
 * @param quizId - The quiz ID
 * @param classCode - The class code for the quiz
 * @returns Promise<void> - Downloads the Excel file
 */
export async function exportQuizResultsToExcel(
  quizId: string,
  classCode: string,
): Promise<void> {
  try {
    // 1. Fetch quiz metadata
    const { data: quizData, error: quizError } = await supabase
      .from("quiz")
      .select("*")
      .eq("quiz_id", quizId)
      .single();

    if (quizError || !quizData) {
      throw new Error("Quiz not found");
    }

    const quizMetadata: QuizMetadata = quizData;

    // 2. Fetch student results from quiz_history (permanent storage)
    // Filter by BOTH quiz_id AND class_code to get only THIS game session
    // This prevents getting duplicate students from previous sessions of the same quiz

    console.log("📊 Fetching quiz history data...");

    // With atomic RPC implementation, data should be available immediately
    // Only do ONE fallback retry after 1 second for edge cases
    let studentsData: any[] | null = null;
    let attempt = 0;

    while (attempt < 2) {
      // Max 2 attempts (immediate + 1 retry)
      const { data, error: studentsError } = await supabase
        .from("quiz_history")
        .select("*")
        .eq("quiz_id", quizId)
        .eq("class_code", classCode)
        .order("completed_at", { ascending: false }) // Get most recent session first
        .order("placement", { ascending: true });

      if (studentsError) {
        console.error("❌ Error fetching student results:", studentsError);
        throw new Error(`Error fetching student results: ${studentsError.message}`);
      }

      if (data && data.length > 0) {
        // Get the most recent session_id from the first record
        const mostRecentSessionId = data[0].session_id;

        // Filter to only include records from the most recent session
        // This ensures we don't mix data from multiple sessions if there are retakes
        studentsData = mostRecentSessionId
          ? data.filter((record) => record.session_id === mostRecentSessionId)
          : data;

        console.log(
          `✅ Found ${studentsData.length} student records for session ${mostRecentSessionId}`
        );
        break;
      }

      attempt++;
      if (attempt < 2) {
        console.log("⏳ No data found. Waiting 1 second before retry...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!studentsData || studentsData.length === 0) {
      console.warn("⚠️ No student data found in quiz_history");
      console.warn("Possible reasons:");
      console.warn("1. No students took the quiz");
      console.warn("2. Quiz was not properly ended (run sendEndGame)");
      console.warn("3. RLS policies are blocking access (run 002_fix_quiz_history_rls_policies.sql)");
      console.warn("4. Atomic RPC failed (check Supabase logs)");
      // Continue anyway to at least export quiz metadata and questions
    }

    console.log(`📊 Found ${studentsData?.length || 0} student records for this game session`);

    // 3. Fetch all questions for this quiz
    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order", { ascending: true });

    if (questionsError) {
      throw new Error("Error fetching questions");
    }

    // 4. Fetch all individual answers for THIS game session only
    // Filter by session_id to get ONLY answers from this specific game session
    console.log("📊 Fetching answers for quiz:", quizId, "session:", classCode);

    // Get the session_id from the quiz_history data
    let sessionId: string | null = null;

    if (studentsData && studentsData.length > 0) {
      sessionId = studentsData[0].session_id;
      console.log("🎯 Using session_id for filtering:", sessionId);
    }

    let answersData: any[] | null = null;

    if (sessionId) {
      // Fetch answers ONLY for this session_id (unique per game session)
      const { data, error: answersError } = await supabase
        .from("quiz_student_answers")
        .select(
          `
          *,
          quiz_questions!inner(question, right_answer, points)
        `,
        )
        .eq("quiz_id", quizId)
        .eq("session_id", sessionId); // Filter by session_id instead of class_code

      if (answersError) {
        console.error("❌ Error fetching individual answers:", answersError);
      }

      answersData = data;
      console.log(
        `📝 Found ${answersData?.length || 0} answer records for session ${sessionId}`,
      );
    } else {
      // Fallback: No session_id available (old data or migration incomplete)
      console.warn("⚠️ No session_id available. Using class_code filter (may include retakes)");

      const { data, error: answersError } = await supabase
        .from("quiz_student_answers")
        .select(
          `
          *,
          quiz_questions!inner(question, right_answer, points)
        `,
        )
        .eq("quiz_id", quizId)
        .eq("class_code", classCode);

      if (answersError) {
        console.error("❌ Error fetching individual answers:", answersError);
      }

      answersData = data;
      console.log(`📝 Found ${answersData?.length || 0} answer records (fallback mode)`);
    }

    // Debug: Check if student names are present
    if (answersData && answersData.length > 0) {
      const sampleAnswer = answersData[0];
      console.log("Sample answer data:", {
        has_student_name: !!sampleAnswer.student_name,
        has_student_email: !!sampleAnswer.student_email,
        student_name: sampleAnswer.student_name,
      });
    } else {
      console.warn("⚠️ NO ANSWERS FOUND! Check if:");
      console.warn("1. Students actually submitted answers during the quiz");
      console.warn("2. The quiz_student_answers table has student_name column");
      console.warn("3. Run: SELECT * FROM quiz_student_answers WHERE quiz_id = '" + quizId + "'");
    }

    // Calculate class statistics
    const totalStudents = studentsData?.length || 0;
    const scores = studentsData?.map((s) => s.score || 0) || [];
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Calculate median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore =
      sortedScores.length > 0
        ? sortedScores[Math.floor(sortedScores.length / 2)]
        : 0;

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // SHEET 1: Summary
    const summaryData = [
      ["Quiz Export Summary"],
      [""],
      ["Quiz Information"],
      ["Title:", quizMetadata.title],
      ["Subject:", quizMetadata.subject],
      ["Description:", quizMetadata.description],
      ["Total Points:", quizMetadata.total_points],
      ["Total Questions:", quizMetadata.max_items],
      ["Question Type:", quizMetadata.question_type],
      [
        "Created At:",
        new Date(quizMetadata.created_at).toLocaleDateString(),
      ],
      [""],
      ["Class Statistics"],
      ["Total Students:", totalStudents],
      ["Average Score:", avgScore.toFixed(2)],
      ["Median Score:", medianScore.toFixed(2)],
      ["Highest Score:", maxScore],
      ["Lowest Score:", minScore],
      [
        "Class Accuracy:",
        totalStudents > 0
          ? (
              (studentsData!.reduce(
                (sum, s) => sum + (s.right_answer || 0),
                0,
              ) /
                (studentsData!.reduce(
                  (sum, s) => sum + (s.right_answer || 0) + (s.wrong_answer || 0),
                  0,
                ) || 1)) *
              100
            ).toFixed(2) + "%"
          : "0%",
      ],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // SHEET 2: Student Results
    const studentResults: StudentResult[] =
      studentsData?.map((student) => ({
        student_name: student.student_name,
        student_email: student.student_email || "N/A",
        score: student.score || 0,
        right_answer: student.right_answer || 0,
        wrong_answer: student.wrong_answer || 0,
        placement: student.placement || 0,
        accuracy:
          student.right_answer || student.wrong_answer
            ? parseFloat(
                (
                  ((student.right_answer || 0) /
                    ((student.right_answer || 0) +
                      (student.wrong_answer || 0))) *
                  100
                ).toFixed(2),
              )
            : 0,
      })) || [];

    const studentResultsSheet = XLSX.utils.json_to_sheet(studentResults, {
      header: [
        "student_name",
        "student_email",
        "score",
        "right_answer",
        "wrong_answer",
        "placement",
        "accuracy",
      ],
    });

    // Rename headers
    XLSX.utils.sheet_add_aoa(
      studentResultsSheet,
      [
        [
          "Student Name",
          "Email",
          "Score",
          "Correct Answers",
          "Wrong Answers",
          "Rank",
          "Accuracy (%)",
        ],
      ],
      { origin: "A1" },
    );

    XLSX.utils.book_append_sheet(workbook, studentResultsSheet, "Student Results");

    // SHEET 3: Detailed Answers (if answers data exists)
    if (answersData && answersData.length > 0) {
      const detailedAnswers: DetailedAnswer[] = answersData.map(
        (answer: any) => ({
          student_name: answer.student_name || "Unknown",
          student_email: answer.student_email || "N/A",
          question: answer.quiz_questions?.question || "N/A",
          student_answer: answer.student_answer || "No answer",
          correct_answer: answer.quiz_questions?.right_answer || "N/A",
          is_correct: answer.is_correct,
          points: answer.is_correct ? answer.quiz_questions?.points || 0 : 0,
          time_taken: answer.time_taken || 0,
        }),
      );

      const detailedAnswersSheet = XLSX.utils.json_to_sheet(detailedAnswers, {
        header: [
          "student_name",
          "student_email",
          "question",
          "student_answer",
          "correct_answer",
          "is_correct",
          "points",
          "time_taken",
        ],
      });

      // Rename headers
      XLSX.utils.sheet_add_aoa(
        detailedAnswersSheet,
        [
          [
            "Student Name",
            "Email",
            "Question",
            "Student Answer",
            "Correct Answer",
            "Is Correct",
            "Points Earned",
            "Time (seconds)",
          ],
        ],
        { origin: "A1" },
      );

      XLSX.utils.book_append_sheet(
        workbook,
        detailedAnswersSheet,
        "Detailed Answers",
      );
    }

    // SHEET 4: Question Analytics
    if (questionsData && answersData) {
      const questionAnalytics: QuestionAnalytics[] = questionsData.map(
        (question) => {
          const questionAnswers = answersData.filter(
            (a: any) => a.quiz_question_id === question.quiz_question_id,
          );

          const correctCount = questionAnswers.filter(
            (a: any) => a.is_correct,
          ).length;
          const incorrectCount = questionAnswers.length - correctCount;
          const totalResponses = questionAnswers.length;
          const accuracyPercentage =
            totalResponses > 0 ? (correctCount / totalResponses) * 100 : 0;

          const avgTime =
            totalResponses > 0
              ? questionAnswers.reduce(
                  (sum: number, a: any) => sum + (a.time_taken || 0),
                  0,
                ) / totalResponses
              : 0;

          return {
            question: question.question,
            correct_answer: question.right_answer,
            total_responses: totalResponses,
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            accuracy_percentage: parseFloat(accuracyPercentage.toFixed(2)),
            average_time: parseFloat(avgTime.toFixed(2)),
            points: question.points || 0,
          };
        },
      );

      const questionAnalyticsSheet = XLSX.utils.json_to_sheet(
        questionAnalytics,
        {
          header: [
            "question",
            "correct_answer",
            "total_responses",
            "correct_count",
            "incorrect_count",
            "accuracy_percentage",
            "average_time",
            "points",
          ],
        },
      );

      // Rename headers
      XLSX.utils.sheet_add_aoa(
        questionAnalyticsSheet,
        [
          [
            "Question",
            "Correct Answer",
            "Total Responses",
            "Correct",
            "Incorrect",
            "Accuracy (%)",
            "Avg Time (s)",
            "Points",
          ],
        ],
        { origin: "A1" },
      );

      XLSX.utils.book_append_sheet(
        workbook,
        questionAnalyticsSheet,
        "Question Analytics",
      );
    }

    // Generate filename
    const fileName = `${quizMetadata.title.replace(/[^a-z0-9]/gi, "_")}_Results_${new Date().toISOString().split("T")[0]}.xlsx`;

    // Write file
    XLSX.writeFile(workbook, fileName);

    console.log("Excel file exported successfully:", fileName);
  } catch (error) {
    console.error("Error exporting quiz results to Excel:", error);
    throw error;
  }
}

/**
 * Export student quiz history to Excel
 * @param studentId - The student's ID
 * @param studentName - The student's name
 * @returns Promise<void> - Downloads the Excel file
 */
export async function exportStudentHistoryToExcel(
  studentId: string,
  studentName: string,
): Promise<void> {
  try {
    // Fetch student's quiz history
    const { data: historyData, error: historyError } = await supabase
      .from("quiz_students")
      .select(
        `
        *,
        quiz:class_code (
          quiz_id,
          title,
          subject,
          total_points,
          created_at
        )
      `,
      )
      .eq("quiz_student_id", studentId)
      .order("created_at", { ascending: false });

    if (historyError) {
      throw new Error("Error fetching student history");
    }

    const workbook = XLSX.utils.book_new();

    // Format data for Excel
    const formattedData = historyData?.map((record: any) => ({
      quiz_title: record.quiz?.title || "N/A",
      subject: record.quiz?.subject || "N/A",
      score: record.score || 0,
      total_points: record.quiz?.total_points || 0,
      correct_answers: record.right_answer || 0,
      wrong_answers: record.wrong_answer || 0,
      accuracy:
        record.right_answer || record.wrong_answer
          ? parseFloat(
              (
                ((record.right_answer || 0) /
                  ((record.right_answer || 0) + (record.wrong_answer || 0))) *
                100
              ).toFixed(2),
            )
          : 0,
      rank: record.placement || "N/A",
      date: record.quiz?.created_at
        ? new Date(record.quiz.created_at).toLocaleDateString()
        : "N/A",
    }));

    const sheet = XLSX.utils.json_to_sheet(formattedData || [], {
      header: [
        "quiz_title",
        "subject",
        "score",
        "total_points",
        "correct_answers",
        "wrong_answers",
        "accuracy",
        "rank",
        "date",
      ],
    });

    // Rename headers
    XLSX.utils.sheet_add_aoa(
      sheet,
      [
        [
          "Quiz Title",
          "Subject",
          "Score",
          "Total Points",
          "Correct",
          "Wrong",
          "Accuracy (%)",
          "Rank",
          "Date",
        ],
      ],
      { origin: "A1" },
    );

    XLSX.utils.book_append_sheet(workbook, sheet, "Quiz History");

    const fileName = `${studentName.replace(/[^a-z0-9]/gi, "_")}_Quiz_History_${new Date().toISOString().split("T")[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    console.log("Student history exported successfully:", fileName);
  } catch (error) {
    console.error("Error exporting student history:", error);
    throw error;
  }
}

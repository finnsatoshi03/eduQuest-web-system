/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import supabase from "../supabase";
import { v4 as uuidv4 } from "uuid";
import { qgen } from "./apiUrl";
import axios from "axios";
import { Quiz, QuizQuestions } from "@/lib/types";
import { QUIZ_STATUS, QuizStatus } from "@/lib/constants/quizStatus";

export async function createQuiz(ownerId: string): Promise<Quiz | null> {
  const newQuizId = uuidv4();
  const { data, error } = await supabase
    .from("quiz")
    .insert({
      title: "Untitled Quiz",
      quiz_id: newQuizId,
      owner_id: ownerId,
      status: QUIZ_STATUS.DRAFT,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating quiz:", error);
    return null;
  }

  // console.log("Quiz created:", data);
  return data;
}

export async function getQuizById(quizId: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quiz")
    .select()
    .eq("quiz_id", quizId)
    .single();

  if (error) {
    console.error("Error fetching quiz:", error);
    return null;
  }

  return data;
}

export async function updateQuizSettings(updateData: {
  title: string;
  quizId: string;
  description: string;
  subject: string;
  cover_image?: File;
  open_time: string;
  close_time: string;
}): Promise<any> {
  const {
    quizId,
    title,
    description,
    subject,
    cover_image,
    open_time,
    close_time,
  } = updateData;
  let coverImageUrl = null;

  if (cover_image) {
    const fileExt = cover_image.name.split(".").pop();
    const fileName = `${quizId}_cover.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, cover_image);

    if (uploadError) {
      throw new Error(`Error uploading cover image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(fileName);

    coverImageUrl = urlData.publicUrl;
  }

  const updateObject: any = {};
  if (title !== undefined) updateObject.title = title;
  if (description !== undefined) updateObject.description = description;
  if (subject !== undefined) updateObject.subject = subject;
  if (coverImageUrl) updateObject.cover_image = coverImageUrl;
  if (open_time !== undefined) updateObject.open_time = open_time;
  if (close_time !== undefined) updateObject.close_time = close_time;

  const { data, error } = await supabase
    .from("quiz")
    .update(updateObject)
    .eq("quiz_id", quizId)
    .single();

  if (error) {
    throw new Error(`Error updating quiz: ${error.message}`);
  }

  return data;
}

export async function updateQuizTitle(quizId: string, title: string) {
  const { data, error } = await supabase
    .from("quiz")
    .update({ title })
    .eq("quiz_id", quizId)
    .single();

  if (error) {
    throw new Error(`Error updating quiz title: ${error.message}`);
  }

  return data;
}

export async function editQuiz(
  ownerId: string,
  quizId: string,
  quizData: Quiz,
): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quiz")
    .update({
      title: quizData.title,
      subject: quizData.subject,
      description: quizData.description,
      total_points: quizData.total_points,
      status: quizData.status,
    })
    .eq("ownerId", ownerId)
    .eq("quizId", quizId)
    .select();

  if (error) throw new Error(error.message);
  const quiz: Quiz | null = data && data.length > 0 ? (data[0] as Quiz) : null;
  return quiz ? quiz : null;
}

export async function getQuizzesByOwnerId(
  ownerId: string,
): Promise<Quiz[] | null> {
  const { data, error } = await supabase
    .from("quiz")
    .select(
      `
      *,
      quiz_questions (
        *
      )
    `,
    )
    .eq("owner_id", ownerId)
    .order("order", {
      referencedTable: "quiz_questions",
      ascending: false,
    });

  if (error) {
    console.error("Error fetching quizzes:", error);
    return null;
  }
  return data;
}

export async function deleteQuiz(
  ownerId: string,
  quizId: string,
): Promise<Quiz | boolean> {
  const response = await supabase
    .from("quiz")
    .delete()
    .eq("owner_id", ownerId)
    .eq("quiz_id", quizId);

  if (response.status !== 204) throw new Error("Quiz not deleted!");

  return true;
}

export async function cloneQuiz(
  sourceQuizId: string,
  ownerId: string,
): Promise<Quiz | null> {
  try {
    // 1. Fetch source quiz
    const sourceQuiz = await getQuizById(sourceQuizId);
    if (!sourceQuiz) {
      throw new Error("Source quiz not found");
    }

    // Verify ownership
    if (sourceQuiz.owner_id !== ownerId) {
      throw new Error("Unauthorized to clone this quiz");
    }

    // 2. Fetch source questions
    const sourceQuestions = await getQuestions(sourceQuizId);

    // 3. Generate new IDs
    const newQuizId = uuidv4();

    // 4. Create cloned quiz data (draft status)
    const clonedQuizData = {
      quiz_id: newQuizId,
      title: `${sourceQuiz.title} (Copy)`,
      description: sourceQuiz.description,
      subject: sourceQuiz.subject,
      cover_image: sourceQuiz.cover_image,
      owner_id: ownerId,
      status: QUIZ_STATUS.DRAFT,
      retake: sourceQuiz.retake,
      shuffle: sourceQuiz.shuffle,
      no_time: sourceQuiz.no_time,
      max_items: sourceQuiz.max_items,
      total_points: sourceQuiz.total_points,
      question_type: sourceQuiz.question_type,
    };

    // 5. Insert cloned quiz
    const { data: clonedQuiz, error: quizError } = await supabase
      .from("quiz")
      .insert(clonedQuizData)
      .select()
      .single();

    if (quizError) {
      console.error("Error cloning quiz:", quizError);
      throw new Error(`Failed to clone quiz: ${quizError.message}`);
    }

    // 6. Clone all questions if they exist
    if (sourceQuestions && sourceQuestions.length > 0) {
      const clonedQuestions = sourceQuestions.map((q) => ({
        quiz_id: newQuizId,
        question: q.question,
        right_answer: q.right_answer,
        distractor: q.distractor,
        time: q.time,
        image_url: q.image_url,
        points: q.points,
        question_type: q.question_type,
        order: q.order,
      }));

      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(clonedQuestions);

      if (questionsError) {
        // Rollback: delete the cloned quiz if questions fail
        await supabase.from("quiz").delete().eq("quiz_id", newQuizId);
        console.error("Error cloning questions:", questionsError);
        throw new Error(`Failed to clone questions: ${questionsError.message}`);
      }
    }

    return clonedQuiz;
  } catch (error) {
    console.error("Error in cloneQuiz:", error);
    throw error;
  }
}

export async function generateQuestions(
  file: File,
  questionType: string,
  numQuestions: string,
  quizSettings?: Record<string, string | number | boolean>,
): Promise<QuizQuestions[] | null> {
  let generateQuestionsResponse;
  try {
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("question_type", questionType);
    formData.append("num_questions", numQuestions);
    if (quizSettings && Object.keys(quizSettings).length > 0) {
      formData.append("settings", JSON.stringify(quizSettings));
    }

    generateQuestionsResponse = await axios.post(qgen, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (generateQuestionsResponse.status === 200) {
      // const response_data = { sample response for T/F and Q&A
      //   "questions": [
      //     {
      //       "right_answer": "false",
      //       "id": 1,
      //       "question": "Is there a class for reading visual arts?",
      //       "question_type": "boolean",
      //       "distractor" : ["1", "2", "3"] // if multiple choices
      //     },
      //     {
      //       "right_answer": "false",
      //       "id": 2,
      //       "question": "Is there a class in reading visual arts?",
      //       "question_type": "boolean"
      //       "distractor" : ["1", "2", "3"]
      //     },
      //   ]
      // }
      // console.log(generateQuestions.data.questions);

      return generateQuestionsResponse.data.questions;
    } else {
      throw new Error("Something went wrong! Please try again later.");
    }
  } catch {
    console.log("Error generating questions:", generateQuestionsResponse);
    throw new Error("Something went wrong! Please try again later.");
  }
}

export async function getQuestions(
  quizId: string,
): Promise<QuizQuestions[] | null> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select()
    .eq("quiz_id", quizId);

  if (error) throw new Error(error.message);
  const questions: QuizQuestions[] | null = data || [];

  return questions && questions.length > 0 ? questions : null;
}

export async function getQuestion(
  questionId: string,
): Promise<QuizQuestions | null> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select()
    .eq("quiz_question_id", questionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateBulkPointsAndTime(
  quizId: string,
  bulkPoints: string,
  bulkTime: string,
): Promise<QuizQuestions[] | null> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .update({
      points: bulkPoints,
      time: bulkTime,
    })
    .eq("quiz_id", quizId);

  if (error) throw new Error(error.message);
  const questions: QuizQuestions[] | null = data || [];

  return questions && questions.length > 0 ? questions : null;
}

export async function updateSingleQuestion(
  quizId: string,
  questionId: string,
  points?: string,
  time?: string,
): Promise<QuizQuestions | null> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .update({
      points: points ? parseInt(points) : undefined,
      time: time ? parseInt(time) : undefined,
    })
    .eq("quiz_id", quizId)
    .eq("quiz_question_id", questionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuestionOrder(
  quizId: string,
  newOrder: { id: string; order: number }[],
) {
  const updates = newOrder.map(({ id, order }) =>
    supabase
      .from("quiz_questions")
      .update({ order })
      .eq("quiz_question_id", id)
      .eq("quiz_id", quizId),
  );

  const results = await Promise.all(updates);

  const errors = results.filter((result) => result.error);

  if (errors.length > 0) {
    console.error("Errors updating question order:", errors);
    throw new Error("Failed to update one or more question orders");
  }

  return results.map((result) => result.data).flat();
}

export async function createQuestion(quizId: string, questionType: string) {
  // First, get the current maximum order for the quiz
  const { data: maxOrderData, error: maxOrderError } = await supabase
    .from("quiz_questions")
    .select("order")
    .eq("quiz_id", quizId)
    .order("order", { ascending: false })
    .limit(1)
    .single();

  if (maxOrderError && maxOrderError.code !== "PGRST116") {
    // PGRST116 is the error code for no rows returned, which is fine if there are no questions yet
    throw maxOrderError;
  }

  const newOrder = (maxOrderData?.order || 0) + 1;

  // Now create the new question with the calculated order
  const { data, error } = await supabase
    .from("quiz_questions")
    .insert({
      quiz_id: quizId,
      question_type: questionType,
      question: "",
      right_answer: "",
      points: 1,
      time: 30,
      order: newOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateQuestion(params: QuizQuestions) {
  const { quiz_question_id, ...updateData } = params;

  const { data, error } = await supabase
    .from("quiz_questions")
    .update(updateData)
    .eq("quiz_question_id", quiz_question_id);

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteQuestion(questionId: string) {
  const { data, error } = await supabase
    .from("quiz_questions")
    .delete()
    .match({ quiz_question_id: questionId });

  if (error) throw error;
  return data;
}

export async function duplicateQuestion(questionId: string) {
  // First, fetch the question to duplicate
  const { data: originalQuestion, error: fetchError } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_question_id", questionId)
    .single();

  if (fetchError) throw fetchError;

  // Remove the id from the original question to create a new entry
  const { quiz_question_id, ...newQuestion } = originalQuestion;

  // Insert the new question
  const { data: duplicatedQuestion, error: insertError } = await supabase
    .from("quiz_questions")
    .insert({ ...newQuestion, order: newQuestion.order + 1 })
    .select();

  if (insertError) throw insertError;

  // Update the order of subsequent questions using a raw SQL query
  const { error: updateError } = await supabase.rpc(
    "increment_question_order",
    {
      min_order: newQuestion.order + 1,
      excluded_id: duplicatedQuestion[0].quiz_question_id,
    },
  );

  if (updateError) throw updateError;

  return duplicatedQuestion[0];
}

export async function updateQuizAndQuestions(
  quizId: string,
  quizData: Partial<Quiz>,
  questions: QuizQuestions[],
): Promise<{ quiz: Quiz; questions: QuizQuestions[] } | null> {
  try {
    // Calculate max_items and total_points
    const max_items = questions.length;
    const total_points = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    // Determine quiz status based on open_time and close_time
    let status = QUIZ_STATUS.ACTIVE;
    if (quizData.open_time && quizData.close_time) {
      status = QUIZ_STATUS.SCHEDULED;
    }

    // Prepare the quiz update object
    const quizUpdateData: Partial<Quiz> = {
      title: quizData.title,
      description: quizData.description,
      subject: quizData.subject,
      max_items,
      total_points,
      question_type: quizData.question_type,
      status,
      cover_image: quizData.cover_image,
      open_time: quizData.open_time,
      close_time: quizData.close_time,
    };

    // Remove any undefined values
    Object.keys(quizUpdateData).forEach(
      (key) =>
        quizUpdateData[key as keyof Partial<Quiz>] === undefined &&
        delete quizUpdateData[key as keyof Partial<Quiz>],
    );

    // Update the quiz
    const { data: updatedQuiz, error: quizError } = await supabase
      .from("quiz")
      .update(quizUpdateData)
      .eq("quiz_id", quizId)
      .single();

    if (quizError) throw quizError;

    // Get existing questions
    const { data: existingQuestions, error: existingQuestionsError } =
      await supabase
        .from("quiz_questions")
        .select("quiz_question_id")
        .eq("quiz_id", quizId);

    if (existingQuestionsError) throw existingQuestionsError;

    const existingQuestionIds = new Set(
      existingQuestions.map((q) => q.quiz_question_id),
    );

    // Prepare question operations
    const questionOps = questions.map((question) => {
      const isExisting = existingQuestionIds.has(question.quiz_question_id);
      existingQuestionIds.delete(question.quiz_question_id);

      const questionData: Partial<QuizQuestions> = {
        quiz_id: quizId,
        right_answer: question.right_answer,
        question: question.question,
        distractor: question.distractor,
        time: question.time,
        image_url: question.image_url,
        points: question.points,
        question_type: question.question_type,
        order: question.order,
      };

      // Remove any undefined values
      Object.keys(questionData).forEach(
        (key) =>
          questionData[key as keyof Partial<QuizQuestions>] === undefined &&
          delete questionData[key as keyof Partial<QuizQuestions>],
      );

      if (isExisting) {
        return supabase
          .from("quiz_questions")
          .update(questionData)
          .eq("quiz_question_id", question.quiz_question_id);
      } else {
        return supabase.from("quiz_questions").insert({
          ...questionData,
          quiz_question_id: question.quiz_question_id,
        });
      }
    });

    // Delete questions that are no longer present
    if (existingQuestionIds.size > 0) {
      questionOps.push(
        supabase
          .from("quiz_questions")
          .delete()
          .in("quiz_question_id", Array.from(existingQuestionIds)),
      );
    }

    // Execute all question operations
    const questionResults = await Promise.all(questionOps);
    const questionErrors = questionResults.filter((result) => result.error);

    if (questionErrors.length > 0) {
      throw new Error("Failed to update one or more questions");
    }

    // Fetch the updated questions
    const { data: updatedQuestions, error: updatedQuestionsError } =
      await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order");

    if (updatedQuestionsError) throw updatedQuestionsError;

    return {
      quiz: updatedQuiz as Quiz,
      questions: updatedQuestions as QuizQuestions[],
    };
  } catch (error) {
    console.error("Error updating quiz and questions:", error);
    throw error;
  }
}

export async function updateQuizStatus(
  quizId: string,
  status: QuizStatus,
): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quiz")
    .update({ status })
    .eq("quiz_id", quizId)
    .select()
    .single();

  if (error) {
    console.error("Error updating quiz status:", error);
    throw new Error(`Failed to update quiz status: ${error.message}`);
  }

  return data;
}

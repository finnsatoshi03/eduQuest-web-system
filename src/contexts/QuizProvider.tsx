import React, { createContext, useState, useContext } from "react";
import {
  generateQuestions,
  GenerateQuizProgressEvent,
  GenerateQuizProgressStage,
} from "@/services/api/apiQuiz";
import { QuestionDifficulty } from "@/lib/types";
import supabase from "@/services/supabase";
import toast from "react-hot-toast";
interface QuizProviderProps {
  children: React.ReactNode;
}

export type QuizGenerationStage =
  | "updating_quiz_settings"
  | GenerateQuizProgressStage
  | "replacing_existing_questions"
  | "saving_generated_questions";

interface UpdateQuizOptions {
  signal?: AbortSignal;
  onProgress?: (stage: QuizGenerationStage) => void;
}

interface QuizContextType {
  quizData: {
    file: File | null;
    questionType: string | null;
    maxQuestions: number | null;
  };
  setQuizData: React.Dispatch<
    React.SetStateAction<QuizContextType["quizData"]>
  >;
  updateQuiz: (
    quizId: string,
    maxQuestions: number,
    options?: UpdateQuizOptions,
  ) => Promise<string | null>;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);
const DIFFICULTY_SEQUENCE: QuestionDifficulty[] = ["easy", "medium", "hard"];

function resolveDifficulty(
  difficulty: unknown,
  index: number,
): QuestionDifficulty {
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty;
  }
  return DIFFICULTY_SEQUENCE[index % DIFFICULTY_SEQUENCE.length];
}

export const QuizProvider: React.FC<QuizProviderProps> = ({ children }) => {
  const [quizData, setQuizData] = useState<{
    file: File | null;
    questionType: string | null;
    maxQuestions: number | null;
  }>({
    file: null,
    questionType: null,
    maxQuestions: null,
  });

  const updateQuiz = async (
    quizId: string,
    maxQuestions: number,
    options?: UpdateQuizOptions,
  ) => {
    const throwIfAborted = () => {
      if (options?.signal?.aborted) {
        const abortError = new Error("Quiz generation was cancelled.");
        abortError.name = "AbortError";
        throw abortError;
      }
    };
    const emitProgress = (stage: QuizGenerationStage) => {
      options?.onProgress?.(stage);
    };

    try {
      emitProgress("updating_quiz_settings");
      throwIfAborted();

      // Step 1: Update the quiz in the quiz table
      // console.log(quizId, maxQuestions, quizData.questionType);
      const { error: quizError } = await supabase
        .from("quiz")
        .update({
          max_items: maxQuestions,
          question_type: quizData.questionType,
        })
        .eq("quiz_id", quizId)
        .select()
        .single();

      if (quizError) throw quizError;
      // console.log("Quiz updated:", updatedQuizData);

      // Step 2: Generate new questions
      if (!quizData.file || !quizData.questionType) {
        throw new Error("Incomplete quiz data");
      }

      throwIfAborted();

      const generatedQuestions = await generateQuestions(
        quizData.file,
        quizData.questionType,
        maxQuestions.toString(),
        undefined,
        {
          signal: options?.signal,
          onProgress: (event: GenerateQuizProgressEvent) =>
            emitProgress(event.stage),
        },
      );

      if (Array.isArray(generatedQuestions)) {
        if (generatedQuestions.length < maxQuestions) {
          toast.error(
            `Only ${generatedQuestions.length} questions were generated. Please try to generate again or you can customize the quiz by adding questions manually.`,
            { duration: 7000 },
          );
        }
      }

      throwIfAborted();
      emitProgress("replacing_existing_questions");

      // Step 3: Delete existing questions for this quiz
      const { error: deleteError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("quiz_id", quizId);

      if (deleteError) throw deleteError;

      throwIfAborted();
      emitProgress("saving_generated_questions");

      // Step 4: Insert new generated questions into quiz_questions table
      const { error: questionsError } = await supabase
        .from("quiz_questions")
        .insert(
          Array.isArray(generatedQuestions)
            ? generatedQuestions.map((question, index) => {
                const distractors = question.distractor
                  ? [...question.distractor]
                  : [];
                const randomIndex = Math.floor(
                  Math.random() * (distractors.length + 1),
                );
                distractors.splice(randomIndex, 0, question.right_answer);

                return {
                  quiz_id: quizId,
                  question: question.question,
                  question_type: question.question_type,
                  right_answer: question.right_answer,
                  points: 1,
                  distractor: distractors,
                  order: index + 1,
                  difficulty: resolveDifficulty(
                    (question as { difficulty?: unknown }).difficulty,
                    index,
                  ),
                };
              })
            : [],
        );

      if (questionsError) throw questionsError;

      emitProgress("completed");
      return quizId;
    } catch (error: unknown) {
      console.error("Error updating quiz:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to generate quiz.");
    }
  };

  return (
    <QuizContext.Provider value={{ quizData, setQuizData, updateQuiz }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
};

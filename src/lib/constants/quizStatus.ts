// Quiz status constants to ensure consistency between frontend and database
// Database stores these values as lowercase strings

export const QUIZ_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  SCHEDULED: "scheduled",
  SCHEDULED_IN_GAME: "scheduled-in-game",
  SCHEDULED_COMPLETED: "scheduled-completed",
  IN_LOBBY: "in lobby",
  IN_GAME: "in game",
  ARCHIVED: "archived",
} as const;

// TypeScript type derived from the constants
export type QuizStatus = (typeof QUIZ_STATUS)[keyof typeof QUIZ_STATUS];

// Helper function to validate quiz status
export function isValidQuizStatus(status: string): status is QuizStatus {
  return Object.values(QUIZ_STATUS).includes(status as QuizStatus);
}

// Helper to check if quiz is currently playable/joinable
export function isQuizLive(status: QuizStatus): boolean {
  return status === QUIZ_STATUS.IN_LOBBY || status === QUIZ_STATUS.IN_GAME;
}

// Helper to check if quiz is in progress
export function isQuizInProgress(status: QuizStatus): boolean {
  return status === QUIZ_STATUS.IN_GAME || status === QUIZ_STATUS.SCHEDULED_IN_GAME;
}

// Helper to check if quiz is scheduled (including in-game and completed scheduled quizzes)
export function isScheduledQuiz(status: QuizStatus): boolean {
  return (
    status === QUIZ_STATUS.SCHEDULED ||
    status === QUIZ_STATUS.SCHEDULED_IN_GAME ||
    status === QUIZ_STATUS.SCHEDULED_COMPLETED
  );
}

// Helper to check if scheduled quiz is completed
export function isScheduledQuizCompleted(status: QuizStatus): boolean {
  return status === QUIZ_STATUS.SCHEDULED_COMPLETED;
}

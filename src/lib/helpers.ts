import { LeaderboardEntry, SubjectData } from "./types";

export function transformSubjectData(subjectData: SubjectData) {
  return Object.entries(subjectData).map(([value, label]) => ({
    value,
    label,
  }));
}

export function formatTimeAgo(date: Date) {
  const now = new Date().getTime();
  const diffInSeconds = Math.floor((now - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec${diffInSeconds === 1 ? "" : "s"} ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } else if (diffInSeconds < 31104000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  } else if (diffInSeconds < 311040000) {
    const years = Math.floor(diffInSeconds / 31104000);
    return `${years} yr${years === 1 ? "" : "s"} ago`;
  } else {
    const decades = Math.floor(diffInSeconds / 311040000);
    return `${decades} decade${decades === 1 ? "" : "s"} ago`;
  }
}

export function formatQuestionType(type: string) {
  switch (type) {
    case "boolean":
      return "True/False";
    case "mcq":
      return "Multiple Choice";
    case "short":
      return "Fill in the Blank";
    default:
      return type;
  }
}

export function parseQuestionType(formattedType: string): string {
  switch (formattedType) {
    case "True/False":
      return "boolean";
    case "Multiple Choice":
      return "mcq";
    case "Fill in the Blank":
      return "short";
    default:
      return formattedType;
  }
}

export function questionTypeIcon(type: string) {
  switch (type) {
    case "boolean":
      return "Scale";
    case "mcq":
      return "Check";
    case "short":
      return "RectangleEllipsis";
    default:
      return "HelpCircle";
  }
}

export function getLoadingStates(questionType: string) {
  switch (questionType) {
    case "multiple-choice":
      return [
        { text: "Initializing quiz setup..." },
        { text: "Loading question templates..." },
        { text: "Fetching multiple-choice question pool..." },
        { text: "Randomizing question selection..." },
        { text: "Generating question text..." },
        { text: "Adding answer choices..." },
        { text: "Reviewing multiple-choice questions..." },
        { text: "Finalizing quiz data..." },
        { text: "Almost done! Wrapping up..." },
      ];
    case "true-false":
      return [
        { text: "Initializing quiz setup..." },
        { text: "Loading question templates..." },
        { text: "Fetching true/false question pool..." },
        { text: "Generating true/false statements..." },
        { text: "Setting up correct answers..." },
        { text: "Reviewing true/false questions..." },
        { text: "Finalizing quiz data..." },
        { text: "Almost done! Wrapping up..." },
      ];
    case "identification":
      return [
        { text: "Initializing quiz setup..." },
        { text: "Loading question templates..." },
        { text: "Fetching identification question pool..." },
        { text: "Generating question prompts..." },
        { text: "Reviewing identification questions..." },
        { text: "Finalizing quiz data..." },
        { text: "Almost done! Wrapping up..." },
      ];
    default:
      return [
        { text: "Initializing quiz setup..." },
        { text: "Loading question templates..." },
        { text: "Fetching question pool..." },
        { text: "Generating questions..." },
        { text: "Compiling quiz data..." },
        { text: "Finalizing quiz structure..." },
        { text: "Almost done! Wrapping up..." },
      ];
  }
}

export function getDarkerShade(color: string, percent: number) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;

  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
}

export function calculateRanks(data: LeaderboardEntry[]): Map<string, number> {
  const ranks = new Map<string, number>();
  let currentRank = 1;

  for (let i = 0; i < data.length; i++) {
    if (i > 0 && data[i].score < data[i - 1].score) {
      currentRank = i + 1;
    }
    ranks.set(data[i].id, currentRank);
  }

  return ranks;
}

export const calculateClassAccuracy = (leaderboardData: LeaderboardEntry[]) => {
  if (leaderboardData.length === 0) return 0;
  const totalRight = leaderboardData.reduce(
    (sum, entry) => sum + entry.right_answer,
    0,
  );
  const totalQuestions = leaderboardData.reduce(
    (sum, entry) => sum + entry.right_answer + entry.wrong_answer,
    0,
  );
  return totalQuestions > 0 ? (totalRight / totalQuestions) * 100 : 0;
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Converts a datetime-local input value (in user's local timezone) to UTC ISO string
 * @param localDatetimeString - String from datetime-local input (format: "YYYY-MM-DDTHH:mm")
 * @returns ISO string in UTC timezone
 */
export function convertLocalToUTC(localDatetimeString: string): string {
  if (!localDatetimeString) return "";
  const localDate = new Date(localDatetimeString);
  return localDate.toISOString();
}

/**
 * Converts a UTC ISO string to datetime-local input format (in user's local timezone)
 * @param utcISOString - ISO string in UTC timezone
 * @returns String formatted for datetime-local input (format: "YYYY-MM-DDTHH:mm")
 */
export function convertUTCToLocal(utcISOString: string): string {
  if (!utcISOString) return "";
  const date = new Date(utcISOString);
  // Format: "YYYY-MM-DDTHH:mm"
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a UTC ISO string to a human-readable local time
 * @param utcISOString - ISO string in UTC timezone
 * @returns Formatted string in user's local timezone
 */
export function formatUTCToLocalDisplay(utcISOString: string): string {
  if (!utcISOString) return "";
  const date = new Date(utcISOString);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
}

/**
 * Checks if a time range spans across midnight (overnight)
 * @param startLocalString - Start datetime-local string
 * @param endLocalString - End datetime-local string
 * @returns true if the range spans across midnight
 */
export function isOvernightSchedule(
  startLocalString: string,
  endLocalString: string,
): boolean {
  if (!startLocalString || !endLocalString) return false;
  const start = new Date(startLocalString);
  const end = new Date(endLocalString);
  return start.getDate() !== end.getDate() || start.getMonth() !== end.getMonth();
}

/**
 * Checks if current UTC time is within the scheduled quiz window
 * @param openTimeUTC - Quiz open time in UTC ISO string
 * @param closeTimeUTC - Quiz close time in UTC ISO string
 * @returns true if current time is within the window
 */
export function isQuizActive(
  openTimeUTC: string | null,
  closeTimeUTC: string | null,
): boolean {
  if (!openTimeUTC || !closeTimeUTC) return false;
  const now = new Date();
  const openDate = new Date(openTimeUTC);
  const closeDate = new Date(closeTimeUTC);
  return now >= openDate && now <= closeDate;
}

/**
 * Gets the quiz availability status
 * @param openTimeUTC - Quiz open time in UTC ISO string
 * @param closeTimeUTC - Quiz close time in UTC ISO string
 * @returns "not_started" | "active" | "ended"
 */
export function getQuizAvailabilityStatus(
  openTimeUTC: string | null,
  closeTimeUTC: string | null,
): "not_started" | "active" | "ended" {
  if (!openTimeUTC || !closeTimeUTC) return "ended";
  const now = new Date();
  const openDate = new Date(openTimeUTC);
  const closeDate = new Date(closeTimeUTC);

  if (now < openDate) return "not_started";
  if (now > closeDate) return "ended";
  return "active";
}

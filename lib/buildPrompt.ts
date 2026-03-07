export type PromptQuestionType = "mcq" | "boolean" | "short";

export interface BuildPromptInput {
  sourceLabel: string;
  sourceText: string;
  questionType: PromptQuestionType;
  questionCount: number;
  existingQuestions: string[];
  settings?: Record<string, string>;
}

export function buildPrompt({
  sourceLabel,
  sourceText,
  questionType,
  questionCount,
  existingQuestions,
  settings = {},
}: BuildPromptInput): string {
  const settingsBlock =
    Object.keys(settings).length > 0
      ? Object.entries(settings)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join("\n")
      : "- none";

  const existingQuestionsBlock =
    existingQuestions.length > 0
      ? existingQuestions
          .slice(0, 50)
          .map((question, index) => `${index + 1}. ${question}`)
          .join("\n")
      : "none";

  const typeRules = getQuestionTypeRules(questionType);

  return [
    "You are an assessment-content generator for an education platform.",
    `Source label: ${sourceLabel}`,
    "",
    "Hard requirements:",
    `1) Generate exactly ${questionCount} questions.`,
    "2) Use only facts present in the source excerpt.",
    "3) Do not generate questions similar in concept or phrasing to the avoid-list.",
    "4) Do not add explanations, markdown, or extra keys.",
    "5) Return only strict JSON that matches the required schema.",
    "",
    "Concept coverage workflow (internal, do not output):",
    "Step 1: Identify key concepts in the excerpt.",
    "Step 2: Select distinct concepts first to maximize coverage.",
    "Step 3: Write one precise question per selected concept before repeating any concept.",
    "",
    "Multiple-choice distractor quality rules:",
    "- Distractors must be plausible and conceptually close to the correct answer.",
    "- Distractors should reflect common misconceptions or likely confusion points.",
    "- Distractors must not be humorous, random, trivial, or unrelated.",
    "- Distractors must never repeat the correct answer.",
    "",
    "Question type rules:",
    typeRules,
    "",
    "Required JSON schema:",
    "{",
    '  "questions": [',
    "    {",
    '      "id": 1,',
    '      "question": "string",',
    `      "question_type": "${questionType}",`,
    '      "right_answer": "string",',
    '      "distractor": ["string"]',
    "    }",
    "  ]",
    "}",
    "",
    "Batch ID rule:",
    "- IDs must be sequential integers starting at 1 for this batch.",
    "",
    "Quiz settings:",
    settingsBlock,
    "",
    "Avoid generating questions similar to the following:",
    existingQuestionsBlock,
    "",
    "Source excerpt:",
    "<<<",
    sourceText,
    ">>>",
  ].join("\n");
}

function getQuestionTypeRules(questionType: PromptQuestionType): string {
  if (questionType === "mcq") {
    return '- For each item, use question_type "mcq" and exactly 3 distractors.';
  }
  if (questionType === "boolean") {
    return '- For each item, use question_type "boolean", right_answer as "True" or "False", and distractor as exactly one opposite value.';
  }
  return [
    '- For each item, use question_type "short" and distractor as an empty array.',
    '- For identification questions (question_type = "short"), right_answer must be ONE word or a short term (max 3 words).',
    '- Do NOT return explanations, definitions, or full-sentence right_answer values.',
    '- right_answer must be a concept, keyword, name, section label, or number found in the source excerpt.',
    '- right_answer must not start with "a", "an", or "the".',
    '- Write short-question prompts so they naturally expect a single term answer.',
    '- Avoid open-ended wording such as "What is the purpose of..."; prefer concrete prompts like "Which term/section/concept...".',
  ].join("\n");
}

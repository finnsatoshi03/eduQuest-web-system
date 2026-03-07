import OpenAI from "openai";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { buildPrompt, type PromptQuestionType } from "../lib/buildPrompt.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

const OPENAI_MODEL = process.env.OPENAI_QUIZ_MODEL ?? "gpt-4.1-mini";
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 50;
const CHUNK_TARGET_TOKENS = 1000;
const CHUNK_MAX_TOKENS = 1200;
const MAX_INITIAL_CHUNKS = 4;
const MAX_FILL_PASSES = 6;
const MAX_MALFORMED_RETRIES = 2;
const SHORT_ANSWER_MAX_WORDS = 3;
const SHORT_ANSWER_MAX_SOURCE_TOKENS = 1600;
const SHORT_ANSWER_LEADING_ARTICLES = new Set(["a", "an", "the"]);
const SHORT_ANSWER_INVALID_STARTS = new Set([
  ...SHORT_ANSWER_LEADING_ARTICLES,
  "to",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "without",
  "because",
  "since",
  "while",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "there",
  "take",
  "takes",
  "using",
  "used",
  "use",
  "make",
  "makes",
  "improve",
  "improves",
]);
const SHORT_ANSWER_STOP_WORDS = new Set([
  ...SHORT_ANSWER_INVALID_STARTS,
  "and",
  "or",
  "but",
  "if",
  "as",
  "of",
  "from",
  "into",
  "within",
  "over",
  "under",
  "after",
  "before",
  "during",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "is",
  "are",
  "was",
  "were",
  "be",
  "being",
  "been",
  "can",
  "could",
  "should",
  "would",
  "do",
  "does",
  "did",
  "purpose",
  "function",
  "role",
  "section",
  "lesson",
  "plan",
  "material",
  "document",
  "text",
  "notes",
  "note",
  "answer",
  "completed",
]);
const SHORT_ANSWER_BREAK_WORDS = new Set([
  "because",
  "since",
  "that",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "after",
  "before",
  "while",
  "although",
  "though",
  "therefore",
  "thus",
]);
const SHORT_QUESTION_REWRITE_PATTERNS = [
  /^(?:what is|what's)\s+the\s+(?:purpose|function|role)\s+of\b/i,
  /^(?:explain|describe)\b/i,
];

type ConcreteQuestionType = PromptQuestionType;
type SupportedQuestionType = ConcreteQuestionType | "mixed";
type QuestionDifficulty = "easy" | "medium" | "hard";

const DIFFICULTY_SEQUENCE: QuestionDifficulty[] = ["easy", "medium", "hard"];
const MIXED_TYPES: ConcreteQuestionType[] = ["mcq", "boolean", "short"];

interface LegacyQuestion {
  id: number;
  question: string;
  question_type: ConcreteQuestionType;
  right_answer: string;
  distractor: string[];
  difficulty: QuestionDifficulty;
}

interface CandidateQuestion {
  id: number;
  question: string;
  question_type: ConcreteQuestionType;
  right_answer: string;
  distractor: string[];
  difficulty?: string;
}

interface LegacyResponse {
  questions: CandidateQuestion[];
}

interface BatchRequest {
  openai: OpenAI;
  sourceText: string;
  questionType: ConcreteQuestionType;
  questionCount: number;
  settings: Record<string, string>;
  existingQuestions: string[];
  sourceLabel: string;
}

interface GenerationRequest {
  openai: OpenAI;
  chunks: string[];
  questionType: ConcreteQuestionType;
  questionCount: number;
  settings: Record<string, string>;
}

const SYSTEM_PROMPT =
  "You create high-quality classroom quiz questions. Follow every instruction exactly and output JSON only.";

type NodeApiRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
};

export default async function handler(
  req: NodeApiRequest,
  res: ServerResponse,
): Promise<void> {
  const request = await toWebRequest(req);
  const response = await handleRequest(request);
  await sendWebResponse(response, res);
}

async function handleRequest(request: Request): Promise<Response> {
  console.log("generate-quiz endpoint hit", {
    method: request.method,
    path: "/api/generate-quiz",
    time: new Date().toISOString(),
  });

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Invalid multipart form-data payload" }, 400);
  }

  const uploadedFile = formData.get("pdf");
  if (!(uploadedFile instanceof File)) {
    return jsonResponse({ error: "No PDF file uploaded" }, 400);
  }

  const isPdfByType = uploadedFile.type.toLowerCase().includes("pdf");
  const isPdfByName = uploadedFile.name.toLowerCase().endsWith(".pdf");
  if (!isPdfByType && !isPdfByName) {
    return jsonResponse({ error: "Uploaded file must be a PDF" }, 400);
  }

  const questionType = normalizeQuestionType(
    toStringValue(formData.get("question_type")),
  );
  if (!questionType) {
    return jsonResponse(
      { error: "Invalid question_type. Use mcq, boolean, short, or mixed." },
      400,
    );
  }

  const requestedCount = parseInteger(toStringValue(formData.get("num_questions")));
  if (
    requestedCount === null ||
    requestedCount < MIN_QUESTIONS ||
    requestedCount > MAX_QUESTIONS
  ) {
    return jsonResponse(
      {
        error: `Invalid num_questions. Use an integer between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.`,
      },
      400,
    );
  }

  const settings = extractQuizSettings(formData);

  let extractedText = "";
  try {
    const pdfBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = pdfModule.default as (buffer: Buffer) => Promise<{ text?: string }>;
    const parsedPdf = await pdfParse(pdfBuffer);
    extractedText = cleanExtractedText(parsedPdf.text ?? "");
  } catch (error) {
    console.error("PDF extraction error:", error);
    return jsonResponse({ error: "Failed to read PDF file" }, 400);
  }

  if (!extractedText) {
    return jsonResponse({ error: "No text extracted from PDF" }, 400);
  }

  const chunks = chunkText(extractedText, CHUNK_TARGET_TOKENS, CHUNK_MAX_TOKENS);
  if (chunks.length === 0) {
    return jsonResponse({ error: "Unable to prepare PDF content for generation" }, 400);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const rawQuestions =
      questionType === "mixed"
        ? await generateMixedQuestions({
            openai,
            chunks,
            questionCount: requestedCount,
            settings,
          })
        : await generateExactQuestions({
            openai,
            chunks,
            questionType,
            questionCount: requestedCount,
            settings,
          });

    const questions = applySequentialDifficulty(rawQuestions);
    return jsonResponse({ questions }, 200);
  } catch (error) {
    console.error("Quiz generation error:", error);
    return jsonResponse(
      {
        error: "Failed to generate quiz questions from the provided PDF",
      },
      502,
    );
  }
}

function normalizeQuestionType(rawType: string): SupportedQuestionType | null {
  const normalized = rawType.trim().toLowerCase();

  if (
    ["mcq", "multiple choice", "multiple-choice", "multiple_choice"].includes(
      normalized,
    )
  ) {
    return "mcq";
  }
  if (
    ["boolean", "true/false", "true false", "true or false", "tf"].includes(
      normalized,
    )
  ) {
    return "boolean";
  }
  if (
    ["short", "identification", "fill in the blank", "fill-in-the-blank"].includes(
      normalized,
    )
  ) {
    return "short";
  }
  if (
    ["mixed", "mixed random", "mixed-random", "mixed question types"].includes(
      normalized,
    )
  ) {
    return "mixed";
  }

  return null;
}

function parseInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/-\s*\n\s*/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitOverlongSentence(sentence: string, maxTokens: number): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const maxWords = Math.max(50, Math.floor((maxTokens * 4) / 6));
  const parts: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (current.length >= maxWords) {
      parts.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    parts.push(current.join(" "));
  }

  return parts;
}

function chunkText(text: string, targetTokens: number, maxTokens: number): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";
  let currentTokens = 0;

  const pushCurrentChunk = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
      currentTokens = 0;
    }
  };

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (sentenceTokens > maxTokens) {
      const splitParts = splitOverlongSentence(sentence, maxTokens);
      for (const part of splitParts) {
        const partTokens = estimateTokens(part);
        if (currentTokens + partTokens > maxTokens) {
          pushCurrentChunk();
        }
        current = current ? `${current} ${part}` : part;
        currentTokens += partTokens;
        if (currentTokens >= targetTokens) {
          pushCurrentChunk();
        }
      }
      continue;
    }

    if (currentTokens + sentenceTokens > maxTokens) {
      pushCurrentChunk();
    }

    current = current ? `${current} ${sentence}` : sentence;
    currentTokens += sentenceTokens;

    if (currentTokens >= targetTokens) {
      pushCurrentChunk();
    }
  }

  pushCurrentChunk();
  return chunks;
}

function pickEvenly(total: number, count: number): number[] {
  if (count >= total) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const selected = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const position = Math.round((i * (total - 1)) / Math.max(count - 1, 1));
    selected.add(position);
  }
  return Array.from(selected).sort((a, b) => a - b);
}

function distributeCount(total: number, buckets: number): number[] {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildFillOrder(totalChunks: number, usedChunkIndexes: number[]): number[] {
  const used = new Set(usedChunkIndexes);
  const unused = Array.from({ length: totalChunks }, (_, index) => index).filter(
    (index) => !used.has(index),
  );
  return [...unused, ...usedChunkIndexes];
}

function extractQuizSettings(formData: FormData): Record<string, string> {
  const reservedKeys = new Set(["pdf", "question_type", "num_questions"]);
  const settings: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (reservedKeys.has(key)) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      settings[key] = value.trim();
    }
  }

  const nestedSettings = formData.get("settings");
  if (typeof nestedSettings === "string" && nestedSettings.trim()) {
    try {
      const parsed = JSON.parse(nestedSettings) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (reservedKeys.has(key)) {
          continue;
        }
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          settings[key] = String(value);
        }
      }
    } catch {
      settings.settings = nestedSettings;
    }
  }

  return settings;
}

function shuffleTypes(types: ConcreteQuestionType[]): ConcreteQuestionType[] {
  const shuffled = [...types];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildMixedTypeSequence(questionCount: number): ConcreteQuestionType[] {
  if (questionCount <= 0) {
    return [];
  }

  const seeded = shuffleTypes(MIXED_TYPES).slice(
    0,
    Math.min(questionCount, MIXED_TYPES.length),
  );

  while (seeded.length < questionCount) {
    const randomType = MIXED_TYPES[Math.floor(Math.random() * MIXED_TYPES.length)];
    seeded.push(randomType);
  }

  return shuffleTypes(seeded);
}

async function generateMixedQuestions({
  openai,
  chunks,
  questionCount,
  settings,
}: Omit<GenerationRequest, "questionType">): Promise<LegacyQuestion[]> {
  const typeSequence = buildMixedTypeSequence(questionCount);
  const typeCounts = typeSequence.reduce(
    (acc, type) => {
      acc[type] += 1;
      return acc;
    },
    { mcq: 0, boolean: 0, short: 0 } as Record<ConcreteQuestionType, number>,
  );

  const pools: Record<ConcreteQuestionType, LegacyQuestion[]> = {
    mcq: [],
    boolean: [],
    short: [],
  };

  for (const type of MIXED_TYPES) {
    const count = typeCounts[type];
    if (count <= 0) {
      continue;
    }

    pools[type] = await generateExactQuestions({
      openai,
      chunks,
      questionType: type,
      questionCount: count,
      settings,
    });
  }

  const cursors: Record<ConcreteQuestionType, number> = {
    mcq: 0,
    boolean: 0,
    short: 0,
  };
  const mixedQuestions: LegacyQuestion[] = [];

  for (const type of typeSequence) {
    const pool = pools[type];
    const question = pool[cursors[type]];

    if (question) {
      cursors[type] += 1;
      mixedQuestions.push(question);
      continue;
    }

    const fallbackType = MIXED_TYPES.find(
      (candidateType) => cursors[candidateType] < pools[candidateType].length,
    );
    if (!fallbackType) {
      break;
    }

    mixedQuestions.push(pools[fallbackType][cursors[fallbackType]]);
    cursors[fallbackType] += 1;
  }

  return mixedQuestions.slice(0, questionCount).map((question, index) => ({
    ...question,
    id: index + 1,
  }));
}

function normalizeDifficulty(rawDifficulty: unknown): QuestionDifficulty {
  if (typeof rawDifficulty !== "string") {
    return "easy";
  }

  const normalized = rawDifficulty.trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }

  return "easy";
}

function applySequentialDifficulty(questions: LegacyQuestion[]): LegacyQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    id: index + 1,
    difficulty: DIFFICULTY_SEQUENCE[index % DIFFICULTY_SEQUENCE.length],
  }));
}

async function generateExactQuestions({
  openai,
  chunks,
  questionType,
  questionCount,
  settings,
}: GenerationRequest): Promise<LegacyQuestion[]> {
  const combinedSourceText = chunks.join(" ");
  const chunkCallCount = Math.min(
    chunks.length,
    Math.max(1, Math.min(MAX_INITIAL_CHUNKS, Math.ceil(questionCount / 4))),
  );
  const selectedIndexes = pickEvenly(chunks.length, chunkCallCount);
  const chunkAllocations = distributeCount(questionCount, selectedIndexes.length);

  const seenKeys = new Set<string>();
  const collected: Omit<LegacyQuestion, "id">[] = [];

  for (let index = 0; index < selectedIndexes.length; index += 1) {
    const chunkIndex = selectedIndexes[index];
    const batchCount = chunkAllocations[index];
    if (batchCount <= 0) {
      continue;
    }

    const batch = await generateBatchQuestions({
      openai,
      sourceText: chunks[chunkIndex],
      questionType,
      questionCount: batchCount,
      settings,
      existingQuestions: collected.map((item) => item.question),
      sourceLabel: `chunk ${chunkIndex + 1} of ${chunks.length}`,
    });

    collectUniqueQuestions(batch, questionType, combinedSourceText, seenKeys, collected);
  }

  const fillOrder = buildFillOrder(chunks.length, selectedIndexes);
  let fillCursor = 0;
  let fillPass = 0;

  while (collected.length < questionCount && fillPass < MAX_FILL_PASSES) {
    const missingCount = questionCount - collected.length;
    const fillChunkIndex = fillOrder[fillCursor % fillOrder.length];

    const fillBatch = await generateBatchQuestions({
      openai,
      sourceText: chunks[fillChunkIndex],
      questionType,
      questionCount: missingCount,
      settings,
      existingQuestions: collected.map((item) => item.question),
      sourceLabel: `fill chunk ${fillChunkIndex + 1} of ${chunks.length}`,
    });

    collectUniqueQuestions(
      fillBatch,
      questionType,
      combinedSourceText,
      seenKeys,
      collected,
    );

    fillCursor += 1;
    fillPass += 1;

    if (
      collected.length < questionCount &&
      fillCursor % fillOrder.length === 0 &&
      fillPass < MAX_FILL_PASSES
    ) {
      const compositeBatch = await generateBatchQuestions({
        openai,
        sourceText: buildCompositeSource(chunks, Math.min(chunks.length, 3), fillCursor),
        questionType,
        questionCount: questionCount - collected.length,
        settings,
        existingQuestions: collected.map((item) => item.question),
        sourceLabel: "composite fill source",
      });

      collectUniqueQuestions(
        compositeBatch,
        questionType,
        combinedSourceText,
        seenKeys,
        collected,
      );

      fillPass += 1;
    }
  }

  if (collected.length < questionCount) {
    const localFallbackQuestions = createLocalFallbackQuestions(
      questionType,
      combinedSourceText,
      questionCount - collected.length,
    );
    collectUniqueQuestions(
      localFallbackQuestions,
      questionType,
      combinedSourceText,
      seenKeys,
      collected,
    );
  }

  while (collected.length < questionCount) {
    const fallbackIndex = collected.length + 1;
    const forcedQuestion =
      questionType === "mcq"
        ? {
            question: `Which concept from the lesson best matches review item ${fallbackIndex}?`,
            question_type: "mcq" as const,
            right_answer: `Core concept ${fallbackIndex}`,
            distractor: [
              `Related concept ${fallbackIndex + 1}`,
              `Related concept ${fallbackIndex + 2}`,
              `Related concept ${fallbackIndex + 3}`,
            ],
            difficulty: "easy" as const,
          }
        : questionType === "boolean"
          ? {
              question: `Review statement ${fallbackIndex}: This statement is supported by the lesson content?`,
              question_type: "boolean" as const,
              right_answer: "True",
              distractor: ["False"],
              difficulty: "easy" as const,
            }
          : {
              question: `What key term is requested in review item ${fallbackIndex}?`,
              question_type: "short" as const,
              right_answer: `Key term ${fallbackIndex}`,
              distractor: [],
              difficulty: "easy" as const,
            };

    const key = normalizeForDedup(forcedQuestion.question);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    collected.push(forcedQuestion);
  }

  return collected.slice(0, questionCount).map((question, index) => ({
    id: index + 1,
    ...question,
  }));
}

function buildCompositeSource(chunks: string[], count: number, seed = 0): string {
  const start = seed % chunks.length;
  const rotated = [...chunks.slice(start), ...chunks.slice(0, start)];
  return rotated
    .slice(0, count)
    .map((chunk, index) => `[Chunk ${index + 1}] ${chunk}`)
    .join("\n\n");
}

async function generateBatchQuestions({
  openai,
  sourceText,
  questionType,
  questionCount,
  settings,
  existingQuestions,
  sourceLabel,
}: BatchRequest): Promise<CandidateQuestion[]> {
  if (questionCount <= 0) {
    return [];
  }

  const prompt = buildPrompt({
    sourceLabel,
    sourceText,
    questionType,
    questionCount,
    existingQuestions,
    settings,
  });

  for (let attempt = 0; attempt <= MAX_MALFORMED_RETRIES; attempt += 1) {
    const parsed = await requestModelJson(
      openai,
      prompt,
      questionType,
      questionCount,
    );
    const strictResponse = extractLegacyResponse(parsed, questionType, questionCount);

    if (strictResponse) {
      return strictResponse.questions;
    }
  }

  return [];
}

function buildResponseSchema(
  questionType: ConcreteQuestionType,
  questionCount: number,
): Record<string, unknown> {
  const distractorLength =
    questionType === "mcq" ? 3 : questionType === "boolean" ? 1 : 0;

  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: questionCount,
        maxItems: questionCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "question", "question_type", "right_answer", "distractor"],
          properties: {
            id: { type: "integer", minimum: 1 },
            question: { type: "string", minLength: 3 },
            question_type: { type: "string", const: questionType },
            right_answer: { type: "string", minLength: 1 },
            distractor: {
              type: "array",
              minItems: distractorLength,
              maxItems: distractorLength,
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

async function requestModelJson(
  openai: OpenAI,
  prompt: string,
  questionType: ConcreteQuestionType,
  questionCount: number,
): Promise<unknown> {
  const schema = buildResponseSchema(questionType, questionCount);

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "legacy_quiz_batch",
          strict: true,
          schema,
        },
      },
    });

    return parseJson(completion.choices[0]?.message?.content ?? "");
  } catch {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    return parseJson(completion.choices[0]?.message?.content ?? "");
  }
}

function extractLegacyResponse(
  payload: unknown,
  questionType: ConcreteQuestionType,
  questionCount: number,
): LegacyResponse | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length !== 1 || payloadKeys[0] !== "questions") {
    return null;
  }

  const rawQuestions = payload.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length !== questionCount) {
    return null;
  }

  const strictQuestions: CandidateQuestion[] = [];

  for (let index = 0; index < rawQuestions.length; index += 1) {
    const rawQuestion = rawQuestions[index];
    if (!isPlainObject(rawQuestion)) {
      return null;
    }

    const questionKeys = Object.keys(rawQuestion).sort();
    const baseExpectedKeys = [
      "distractor",
      "id",
      "question",
      "question_type",
      "right_answer",
    ];
    const extendedExpectedKeys = [...baseExpectedKeys, "difficulty"];
    if (
      !(
        (questionKeys.length === baseExpectedKeys.length &&
          baseExpectedKeys.every((key) => questionKeys.includes(key))) ||
        (questionKeys.length === extendedExpectedKeys.length &&
          extendedExpectedKeys.every((key) => questionKeys.includes(key)))
      )
    ) {
      return null;
    }

    if (
      typeof rawQuestion.id !== "number" ||
      !Number.isInteger(rawQuestion.id) ||
      rawQuestion.id !== index + 1
    ) {
      return null;
    }

    if (
      typeof rawQuestion.question !== "string" ||
      typeof rawQuestion.right_answer !== "string" ||
      typeof rawQuestion.question_type !== "string" ||
      !Array.isArray(rawQuestion.distractor)
    ) {
      return null;
    }

    if (rawQuestion.question_type !== questionType) {
      return null;
    }

    const distractors = rawQuestion.distractor.filter(
      (entry: unknown): entry is string => typeof entry === "string",
    );
    if (distractors.length !== rawQuestion.distractor.length) {
      return null;
    }

    const expectedDistractorCount =
      questionType === "mcq" ? 3 : questionType === "boolean" ? 1 : 0;
    if (distractors.length !== expectedDistractorCount) {
      return null;
    }

    strictQuestions.push({
      id: rawQuestion.id,
      question: rawQuestion.question,
      question_type: questionType,
      right_answer: rawQuestion.right_answer,
      distractor: distractors,
      difficulty:
        typeof rawQuestion.difficulty === "string" ? rawQuestion.difficulty : undefined,
    });
  }

  return { questions: strictQuestions };
}

function parseJson(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const rawJson = fencedMatch ? fencedMatch[1] : trimmed;

  try {
    return JSON.parse(rawJson);
  } catch {
    const objectMatch = rawJson.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> & { questions?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectUniqueQuestions(
  generatedQuestions: CandidateQuestion[],
  questionType: ConcreteQuestionType,
  sourceText: string,
  seenKeys: Set<string>,
  collected: Array<Omit<LegacyQuestion, "id">>,
): void {
  for (const generatedQuestion of generatedQuestions) {
    const formatted = formatQuestion(generatedQuestion, questionType, sourceText);
    if (!formatted) {
      continue;
    }

    const key = normalizeForDedup(formatted.question);
    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    collected.push(formatted);
  }
}

function formatQuestion(
  question: CandidateQuestion,
  questionType: ConcreteQuestionType,
  sourceText: string,
): Omit<LegacyQuestion, "id"> | null {
  const questionText = ensureQuestionMark(normalizeInlineText(question.question ?? ""));
  const rightAnswer = normalizeInlineText(question.right_answer ?? "");
  const difficulty = normalizeDifficulty(question.difficulty);

  if (!questionText || !rightAnswer) {
    return null;
  }

  if (questionType === "boolean") {
    const normalizedAnswer = normalizeBooleanAnswer(rightAnswer);
    return {
      question: questionText,
      question_type: "boolean",
      right_answer: normalizedAnswer,
      distractor: [normalizedAnswer === "True" ? "False" : "True"],
      difficulty,
    };
  }

  if (questionType === "short") {
    const normalizedShortAnswer = normalizeShortAnswer(
      rightAnswer,
      questionText,
      sourceText,
    );
    if (!normalizedShortAnswer) {
      return null;
    }

    return {
      question: normalizeShortQuestion(questionText),
      question_type: "short",
      right_answer: normalizedShortAnswer,
      distractor: [],
      difficulty,
    };
  }

  const normalizedDistractors = normalizeMcqDistractors(
    question.distractor ?? [],
    rightAnswer,
    sourceText,
  );

  return {
    question: questionText,
    question_type: "mcq",
    right_answer: rightAnswer,
    distractor: normalizedDistractors,
    difficulty,
  };
}

function normalizeInlineText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s*/, "")
    .trim();
}

function ensureQuestionMark(text: string): string {
  if (!text) {
    return text;
  }
  return /[?]$/.test(text) ? text : `${text}?`;
}

function normalizeBooleanAnswer(answer: string): "True" | "False" {
  const value = answer.trim().toLowerCase();
  const trueValues = new Set(["true", "t", "yes", "correct"]);
  const falseValues = new Set(["false", "f", "no", "incorrect"]);

  if (trueValues.has(value)) {
    return "True";
  }
  if (falseValues.has(value)) {
    return "False";
  }

  return /\b(not|never|incorrect|false)\b/i.test(value) ? "False" : "True";
}

function normalizeShortQuestion(questionText: string): string {
  const stem = normalizeInlineText(questionText).replace(/[?]+$/g, "").trim();
  if (!stem) {
    return "Which term matches the source material?";
  }

  const shouldRewrite = SHORT_QUESTION_REWRITE_PATTERNS.some((pattern) =>
    pattern.test(stem),
  );
  if (!shouldRewrite) {
    return ensureQuestionMark(stem);
  }

  const purposeMatch = stem.match(
    /^(?:what is|what's)\s+the\s+(?:purpose|function|role)\s+of\s+(.+)$/i,
  );
  if (purposeMatch?.[1]) {
    return ensureQuestionMark(`Which term describes ${purposeMatch[1].trim()}`);
  }

  const directiveTarget = stem.replace(/^(?:explain|describe)\s*/i, "").trim();
  if (directiveTarget) {
    return ensureQuestionMark(`Which term best matches ${directiveTarget}`);
  }

  return ensureQuestionMark(stem);
}

function normalizeShortAnswer(
  answer: string,
  questionText: string,
  sourceText: string,
): string {
  const cleaned = normalizeInlineText(answer)
    .replace(/^["'`([{]+|["'`)\]}]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!cleaned) {
    return "";
  }

  const direct = finalizeShortAnswerCandidate(cleaned);
  if (isValidShortAnswer(direct)) {
    return direct;
  }

  const extractedFromSource = finalizeShortAnswerCandidate(
    extractSourceAlignedShortTerm(`${questionText} ${cleaned}`, sourceText),
  );
  if (isValidShortAnswer(extractedFromSource)) {
    return extractedFromSource;
  }

  const compactFromAnswer = finalizeShortAnswerCandidate(
    extractCompactPhraseFromAnswer(cleaned),
  );
  if (isValidShortAnswer(compactFromAnswer)) {
    return compactFromAnswer;
  }

  const fallback = finalizeShortAnswerCandidate(
    coerceFallbackShortAnswer(
      extractedFromSource || compactFromAnswer || direct || cleaned,
    ),
  );
  return isValidShortAnswer(fallback) ? fallback : "";
}

function finalizeShortAnswerCandidate(candidate: string): string {
  let value = normalizeInlineText(candidate)
    .replace(/^answer\s*[:-]\s*/i, "")
    .replace(/^(?:it is|it's|this is|that is|there is|there are)\s+/i, "")
    .replace(/[,:;]+$/g, "")
    .trim();

  value = stripLeadingArticles(value);
  if (!value) {
    return "";
  }

  const words = value.split(/\s+/).filter(Boolean);
  const breakIndex = words.findIndex((word, index) => {
    if (index === 0) {
      return false;
    }
    return SHORT_ANSWER_BREAK_WORDS.has(word.toLowerCase());
  });

  const limitedWords =
    breakIndex > -1
      ? words.slice(0, breakIndex)
      : words.slice(0, SHORT_ANSWER_MAX_WORDS);

  return limitedWords.join(" ").trim();
}

function stripLeadingArticles(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  while (
    words.length > 0 &&
    SHORT_ANSWER_LEADING_ARTICLES.has(words[0].toLowerCase())
  ) {
    words.shift();
  }
  return words.join(" ");
}

function isValidShortAnswer(answer: string): boolean {
  if (!answer || /[.!?]/.test(answer)) {
    return false;
  }

  const words = answer.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > SHORT_ANSWER_MAX_WORDS) {
    return false;
  }

  const firstWord = words[0].toLowerCase();
  if (SHORT_ANSWER_INVALID_STARTS.has(firstWord)) {
    return false;
  }

  if (words.some((word) => SHORT_ANSWER_BREAK_WORDS.has(word.toLowerCase()))) {
    return false;
  }

  return words.some((word) => {
    const normalizedWord = word.toLowerCase();
    return (
      !SHORT_ANSWER_STOP_WORDS.has(normalizedWord) &&
      (normalizedWord.length >= 3 || /^\d+$/.test(normalizedWord))
    );
  });
}

function extractCompactPhraseFromAnswer(answer: string): string {
  const firstClause = answer
    .split(/[;:()]/)[0]
    .split(
      /\b(?:because|since|that|which|who|whom|when|where|after|before|while|although|though)\b/i,
    )[0]
    .trim();

  const tokens = tokenizeWords(firstClause);
  if (tokens.length === 0) {
    return "";
  }

  const compactTokens = tokens.filter(
    (token) => !SHORT_ANSWER_STOP_WORDS.has(token.toLowerCase()),
  );
  const selected =
    compactTokens.length > 0 ? compactTokens : tokens.slice(0, SHORT_ANSWER_MAX_WORDS);
  return selected.slice(0, SHORT_ANSWER_MAX_WORDS).join(" ");
}

function coerceFallbackShortAnswer(answer: string): string {
  const tokens = tokenizeWords(answer).filter((token) => {
    const normalized = token.toLowerCase();
    return (
      !SHORT_ANSWER_STOP_WORDS.has(normalized) &&
      !SHORT_ANSWER_INVALID_STARTS.has(normalized)
    );
  });

  if (tokens.length === 0) {
    return "";
  }

  return tokens.slice(0, SHORT_ANSWER_MAX_WORDS).join(" ");
}

function extractSourceAlignedShortTerm(context: string, sourceText: string): string {
  const contextTokens = tokenizeWords(context)
    .map((token) => token.toLowerCase())
    .filter((token) => !SHORT_ANSWER_STOP_WORDS.has(token));

  if (contextTokens.length === 0) {
    return "";
  }

  const sourceTokens = tokenizeWords(sourceText).slice(0, SHORT_ANSWER_MAX_SOURCE_TOKENS);
  if (sourceTokens.length === 0) {
    return "";
  }

  const contextSet = new Set(contextTokens);
  const seen = new Set<string>();
  let bestCandidate = "";
  let bestScore = 0;
  let bestWordCount = 0;

  for (let index = 0; index < sourceTokens.length; index += 1) {
    for (let size = SHORT_ANSWER_MAX_WORDS; size >= 1; size -= 1) {
      if (index + size > sourceTokens.length) {
        continue;
      }

      const candidateTokens = sourceTokens.slice(index, index + size);
      if (!isUsableShortTermTokens(candidateTokens)) {
        continue;
      }

      const candidate = candidateTokens.join(" ");
      const key = normalizeForDedup(candidate);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);

      const score = scoreShortTermCandidate(candidateTokens, contextSet);
      if (score <= 0) {
        continue;
      }

      if (score > bestScore || (score === bestScore && size > bestWordCount)) {
        bestCandidate = candidate;
        bestScore = score;
        bestWordCount = size;
      }
    }
  }

  return bestCandidate;
}

function isUsableShortTermTokens(tokens: string[]): boolean {
  if (tokens.length === 0 || tokens.length > SHORT_ANSWER_MAX_WORDS) {
    return false;
  }

  if (SHORT_ANSWER_LEADING_ARTICLES.has(tokens[0].toLowerCase())) {
    return false;
  }

  return tokens.some((token) => {
    const normalized = token.toLowerCase();
    return (
      !SHORT_ANSWER_STOP_WORDS.has(normalized) &&
      (normalized.length >= 3 || /^\d+$/.test(normalized))
    );
  });
}

function scoreShortTermCandidate(tokens: string[], contextSet: Set<string>): number {
  let overlapScore = 0;
  let stopWordPenalty = 0;

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (contextSet.has(normalized)) {
      overlapScore += 3;
    }
    if (SHORT_ANSWER_STOP_WORDS.has(normalized)) {
      stopWordPenalty += 1;
    }
  }

  if (overlapScore === 0) {
    return 0;
  }

  return overlapScore - stopWordPenalty;
}

function tokenizeWords(text: string): string[] {
  return normalizeInlineText(text).match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g) ?? [];
}

function normalizeMcqDistractors(
  distractors: string[],
  rightAnswer: string,
  sourceText: string,
): string[] {
  const normalizedRightAnswer = normalizeForDedup(rightAnswer);
  const used = new Set<string>([normalizedRightAnswer]);
  const cleanDistractors: string[] = [];

  for (const distractor of distractors) {
    const cleaned = normalizeInlineText(distractor);
    const key = normalizeForDedup(cleaned);
    if (!cleaned || !key || used.has(key)) {
      continue;
    }

    used.add(key);
    cleanDistractors.push(cleaned);

    if (cleanDistractors.length === 3) {
      break;
    }
  }

  if (cleanDistractors.length < 3) {
    const fallbackDistractors = extractFallbackDistractors(sourceText, used);
    for (const fallbackDistractor of fallbackDistractors) {
      cleanDistractors.push(fallbackDistractor);
      if (cleanDistractors.length === 3) {
        break;
      }
    }
  }

  while (cleanDistractors.length < 3) {
    cleanDistractors.push(`Alternative ${cleanDistractors.length + 1}`);
  }

  return cleanDistractors.slice(0, 3);
}

function extractFallbackDistractors(sourceText: string, used: Set<string>): string[] {
  const tokens = sourceText.match(/\b[A-Za-z][A-Za-z-]{3,}\b/g) ?? [];
  const fallbacks: string[] = [];

  for (const token of tokens) {
    const candidate = normalizeInlineText(token);
    const key = normalizeForDedup(candidate);
    if (!candidate || !key || used.has(key)) {
      continue;
    }

    used.add(key);
    if (!fallbacks.includes(candidate)) {
      fallbacks.push(candidate);
    }

    if (fallbacks.length >= 30) {
      break;
    }
  }

  return fallbacks;
}

function createLocalFallbackQuestions(
  questionType: ConcreteQuestionType,
  sourceText: string,
  questionCount: number,
): CandidateQuestion[] {
  const concepts = Array.from(
    new Set(
      (sourceText.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) ?? []).map((concept) =>
        normalizeInlineText(concept),
      ),
    ),
  ).filter(Boolean);

  const conceptPool = concepts.length > 0 ? concepts : ["key concept"];
  const output: CandidateQuestion[] = [];

  let cursor = 0;
  while (output.length < questionCount) {
    const concept = conceptPool[cursor % conceptPool.length];
    const id = output.length + 1;

    if (questionType === "mcq") {
      const alternativePool = conceptPool.filter(
        (candidate) => normalizeForDedup(candidate) !== normalizeForDedup(concept),
      );
      const distractor = alternativePool.slice(cursor, cursor + 3);
      while (distractor.length < 3) {
        distractor.push(`Related term ${id + distractor.length}`);
      }

      output.push({
        id,
        question: `Which concept from the material best matches "${concept}"?`,
        question_type: "mcq",
        right_answer: concept,
        distractor,
        difficulty: "easy",
      });
    } else if (questionType === "boolean") {
      output.push({
        id,
        question: `The document discusses ${concept} as part of the lesson.?`,
        question_type: "boolean",
        right_answer: "True",
        distractor: ["False"],
        difficulty: "easy",
      });
    } else {
      output.push({
        id,
        question: `What key term is associated with ${concept}?`,
        question_type: "short",
        right_answer: concept,
        distractor: [],
        difficulty: "easy",
      });
    }

    cursor += 1;
  }

  return output;
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function toWebRequest(req: NodeApiRequest): Promise<Request> {
  const method = (req.method ?? "GET").toUpperCase();
  const headers = toWebHeaders(req.headers);
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  const protocol = headers.get("x-forwarded-proto") ?? "https";
  const requestUrl = `${protocol}://${host}${req.url ?? "/"}`;

  if (method === "GET" || method === "HEAD") {
    return new Request(requestUrl, { method, headers });
  }

  const body = await readRawBody(req);
  const requestBody = body.byteLength > 0 ? new Uint8Array(body) : undefined;
  return new Request(requestUrl, { method, headers, body: requestBody });
}

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        webHeaders.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      webHeaders.set(key, value);
    }
  }

  return webHeaders;
}

async function readRawBody(req: NodeApiRequest): Promise<Buffer> {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }

    if (req.body instanceof Uint8Array) {
      return Buffer.from(req.body);
    }

    if (typeof req.body === "string") {
      return Buffer.from(req.body);
    }

    if (typeof req.body === "object") {
      return Buffer.from(JSON.stringify(req.body));
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function sendWebResponse(
  response: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

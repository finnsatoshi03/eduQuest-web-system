import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

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
const MAX_RETRY_PASSES = 3;

type SupportedQuestionType = "mcq" | "boolean" | "short";

interface GeneratedQuestion {
  question?: string;
  right_answer?: string;
  distractor?: string[];
}

interface LegacyQuestion {
  id: number;
  question: string;
  question_type: SupportedQuestionType;
  right_answer: string;
  distractor: string[];
}

interface BatchRequest {
  openai: OpenAI;
  sourceText: string;
  questionType: SupportedQuestionType;
  questionCount: number;
  settings: Record<string, string>;
  existingQuestions: string[];
  sourceLabel: string;
}

interface GenerationRequest {
  openai: OpenAI;
  chunks: string[];
  questionType: SupportedQuestionType;
  questionCount: number;
  settings: Record<string, string>;
}

const SYSTEM_PROMPT =
  "You create high-quality classroom quiz questions. Use only the provided source text, avoid duplicates, and output JSON only.";

export default async function handler(request: Request): Promise<Response> {
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

  const questionType = normalizeQuestionType(toStringValue(formData.get("question_type")));
  if (!questionType) {
    return jsonResponse(
      { error: "Invalid question_type. Use mcq, boolean, or short." },
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
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const parsedPdf = await parser.getText();
      extractedText = cleanExtractedText(parsedPdf.text ?? "");
    } finally {
      await parser.destroy();
    }
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
    const questions = await generateExactQuestions({
      openai,
      chunks,
      questionType,
      questionCount: requestedCount,
      settings,
    });
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

  if (["mcq", "multiple choice", "multiple-choice", "multiple_choice"].includes(normalized)) {
    return "mcq";
  }
  if (["boolean", "true/false", "true false", "true or false", "tf"].includes(normalized)) {
    return "boolean";
  }
  if (["short", "identification", "fill in the blank", "fill-in-the-blank"].includes(normalized)) {
    return "short";
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
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          settings[key] = String(value);
        }
      }
    } catch {
      settings.settings = nestedSettings;
    }
  }

  return settings;
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

  const initialBatchPromises = selectedIndexes.map((chunkIndex, index) =>
    generateBatchQuestions({
      openai,
      sourceText: chunks[chunkIndex],
      questionType,
      questionCount: chunkAllocations[index],
      settings,
      existingQuestions: [],
      sourceLabel: `chunk ${chunkIndex + 1} of ${chunks.length}`,
    }),
  );

  const initialBatches = await Promise.all(initialBatchPromises);
  for (const batch of initialBatches) {
    collectUniqueQuestions(batch, questionType, combinedSourceText, seenKeys, collected);
  }

  let retryPass = 0;
  while (collected.length < questionCount && retryPass < MAX_RETRY_PASSES) {
    const missingCount = questionCount - collected.length;
    const retryChunkIndex = (selectedIndexes.length + retryPass) % chunks.length;
    const retryBatch = await generateBatchQuestions({
      openai,
      sourceText: chunks[retryChunkIndex],
      questionType,
      questionCount: missingCount,
      settings,
      existingQuestions: collected.map((item) => item.question),
      sourceLabel: `retry chunk ${retryChunkIndex + 1} of ${chunks.length}`,
    });

    collectUniqueQuestions(retryBatch, questionType, combinedSourceText, seenKeys, collected);
    retryPass += 1;
  }

  if (collected.length < questionCount) {
    const missingCount = questionCount - collected.length;
    const fallbackSource = buildCompositeSource(chunks, Math.min(chunks.length, 3));
    const fallbackBatch = await generateBatchQuestions({
      openai,
      sourceText: fallbackSource,
      questionType,
      questionCount: missingCount,
      settings,
      existingQuestions: collected.map((item) => item.question),
      sourceLabel: "composite fallback source",
    });

    collectUniqueQuestions(fallbackBatch, questionType, combinedSourceText, seenKeys, collected);
  }

  if (collected.length < questionCount) {
    throw new Error(
      `Unable to produce enough unique questions: requested ${questionCount}, generated ${collected.length}.`,
    );
  }

  return collected.slice(0, questionCount).map((question, index) => ({
    id: index + 1,
    ...question,
  }));
}

function buildCompositeSource(chunks: string[], count: number): string {
  const indexes = pickEvenly(chunks.length, count);
  return indexes.map((index) => `[Chunk ${index + 1}] ${chunks[index]}`).join("\n\n");
}

async function generateBatchQuestions({
  openai,
  sourceText,
  questionType,
  questionCount,
  settings,
  existingQuestions,
  sourceLabel,
}: BatchRequest): Promise<GeneratedQuestion[]> {
  if (questionCount <= 0) {
    return [];
  }

  const schema = {
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
          required: ["question", "right_answer", "distractor"],
          properties: {
            question: { type: "string" },
            right_answer: { type: "string" },
            distractor: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  };

  const prompt = buildPrompt({
    questionType,
    questionCount,
    sourceText,
    settings,
    existingQuestions,
    sourceLabel,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_quiz_batch",
          strict: true,
          schema,
        },
      },
    });

    return extractQuestionsFromCompletion(completion.choices[0]?.message?.content);
  } catch {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    return extractQuestionsFromCompletion(completion.choices[0]?.message?.content);
  }
}

function buildPrompt({
  questionType,
  questionCount,
  sourceText,
  settings,
  existingQuestions,
  sourceLabel,
}: {
  questionType: SupportedQuestionType;
  questionCount: number;
  sourceText: string;
  settings: Record<string, string>;
  existingQuestions: string[];
  sourceLabel: string;
}): string {
  const settingsBlock =
    Object.keys(settings).length > 0
      ? Object.entries(settings)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join("\n")
      : "- none";

  const existingBlock =
    existingQuestions.length > 0
      ? existingQuestions
          .slice(0, 40)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")
      : "none";

  const questionTypeRules =
    questionType === "mcq"
      ? 'For each item: return a clear question, one correct "right_answer", and exactly 3 plausible but incorrect options in "distractor".'
      : questionType === "boolean"
        ? 'For each item: return a clear question, "right_answer" as exactly "True" or "False", and "distractor" with exactly one opposite value.'
        : 'For each item: return a clear question, one concise "right_answer", and an empty array for "distractor".';

  return [
    `Source label: ${sourceLabel}`,
    `Generate exactly ${questionCount} unique questions.`,
    `Question type code: ${questionType}.`,
    questionTypeRules,
    "Use only information present in the source excerpt.",
    "Do not repeat, paraphrase, or invert any question from the existing questions list.",
    "Avoid vague or generic wording.",
    "Quiz settings:",
    settingsBlock,
    "Existing questions to avoid:",
    existingBlock,
    'Return only valid JSON with top-level key "questions".',
    "Source excerpt:",
    "<<<",
    sourceText,
    ">>>",
  ].join("\n\n");
}

function extractQuestionsFromCompletion(content: string | null | undefined): GeneratedQuestion[] {
  if (!content) {
    return [];
  }

  const parsed = parseJson(content);
  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const questions = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .filter((item): item is GeneratedQuestion => typeof item === "object" && item !== null)
    .map((item) => ({
      question: typeof item.question === "string" ? item.question : "",
      right_answer: typeof item.right_answer === "string" ? item.right_answer : "",
      distractor: Array.isArray(item.distractor)
        ? item.distractor.filter((entry): entry is string => typeof entry === "string")
        : [],
    }));
}

function parseJson(content: string): unknown {
  const trimmed = content.trim();
  const fencePattern = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const fencedMatch = trimmed.match(fencePattern);
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

function collectUniqueQuestions(
  generatedQuestions: GeneratedQuestion[],
  questionType: SupportedQuestionType,
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
  question: GeneratedQuestion,
  questionType: SupportedQuestionType,
  sourceText: string,
): Omit<LegacyQuestion, "id"> | null {
  const questionText = ensureQuestionMark(normalizeInlineText(question.question ?? ""));
  const rightAnswer = normalizeInlineText(question.right_answer ?? "");

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
    };
  }

  if (questionType === "short") {
    return {
      question: questionText,
      question_type: "short",
      right_answer: rightAnswer,
      distractor: [],
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

    if (fallbacks.length >= 20) {
      break;
    }
  }

  return fallbacks;
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

import { matchesIdiom, wordCount, type Idiom } from "../idioms";
import { renderPrompt } from "../prompts";
import type { Learner } from "../auth";
import { systemPrompt } from "./context";
import { chatJson, TutorInvalidError, TutorOfflineError, type Validation } from "./ollama";

export const GRADING_SCHEMA = {
  type: "object",
  required: ["usageGrade", "grammarGrade", "isCorrect", "corrected", "explanation"],
  properties: {
    usageGrade: { type: "integer", minimum: 0, maximum: 100 },
    grammarGrade: { type: "integer", minimum: 0, maximum: 100 },
    isCorrect: { type: "boolean" },
    corrected: { type: "string" },
    explanation: { type: "string" },
  },
};

export interface Grade {
  usageGrade: number;
  grammarGrade: number;
  grade: number;
  isCorrect: boolean;
  corrected: string;
  explanation: string;
}

export type GradeResult = ({ status: "graded" } & Grade) | { status: "could_not_grade" };

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Coerce first (a small model often contradicts itself), then validate structure (research R10).
 */
export function coerceAndValidate(idiom: Idiom, sentence: string, raw: unknown): Validation<Grade> {
  const r = raw as Record<string, unknown>;
  if (
    !r ||
    typeof r.usageGrade !== "number" ||
    typeof r.grammarGrade !== "number" ||
    typeof r.isCorrect !== "boolean" ||
    typeof r.corrected !== "string" ||
    typeof r.explanation !== "string"
  ) {
    return { ok: false, reason: "include usageGrade, grammarGrade, isCorrect, corrected and explanation" };
  }
  const original = sentence.trim();
  let isCorrect = r.isCorrect;
  let corrected = r.corrected.trim();
  if (isCorrect) corrected = original;
  if (corrected === original) isCorrect = true;
  const explanation = r.explanation.trim();

  if (!corrected || !matchesIdiom(idiom, corrected)) {
    return { ok: false, reason: `the corrected sentence must still use the idiom "${idiom.phrase}"` };
  }
  if (!explanation) return { ok: false, reason: "the explanation must not be empty" };
  if (wordCount(explanation) > 40) return { ok: false, reason: "the explanation must be 40 words or fewer" };

  const usageGrade = clamp(r.usageGrade);
  const grammarGrade = clamp(r.grammarGrade);
  return {
    ok: true,
    value: {
      usageGrade,
      grammarGrade,
      grade: Math.round((usageGrade + grammarGrade) / 2),
      isCorrect,
      corrected,
      explanation,
    },
  };
}

/** Never returns an invented grade: on failure the sentence is "could not grade" (edge case). */
export async function gradeSentence(
  idiom: Idiom,
  sentence: string,
  learner: Pick<Learner, "level" | "difficulty_min" | "difficulty_max">,
): Promise<GradeResult> {
  try {
    const grade = await chatJson({
      system: systemPrompt(learner),
      user: renderPrompt("grading", { phrase: idiom.phrase, meaning: idiom.meaning, sentence: sentence.trim(), level: learner.level }),
      schema: GRADING_SCHEMA,
      validate: (raw) => coerceAndValidate(idiom, sentence, raw),
    });
    return { status: "graded", ...grade };
  } catch (e) {
    if (e instanceof TutorOfflineError || e instanceof TutorInvalidError) return { status: "could_not_grade" };
    throw e;
  }
}

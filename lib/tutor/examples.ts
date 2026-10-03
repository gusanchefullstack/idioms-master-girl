import { getSettings } from "../config";
import { matchesIdiom, wordCount, type Idiom } from "../idioms";
import { renderPrompt } from "../prompts";
import type { Learner } from "../auth";
import { systemPrompt } from "./context";
import { chatJson, TutorInvalidError, TutorOfflineError, type Validation } from "./ollama";

export const EXAMPLES_SCHEMA = {
  type: "object",
  required: ["examples"],
  properties: { examples: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } } },
};

export function validateExamples(idiom: Idiom, raw: unknown, maxWords: number): Validation<string[]> {
  const ex = (raw as { examples?: unknown })?.examples;
  if (!Array.isArray(ex) || ex.length !== 3 || ex.some((e) => typeof e !== "string" || !e.trim())) {
    return { ok: false, reason: "give exactly 3 example sentences" };
  }
  const list = (ex as string[]).map((e) => e.trim());
  if (new Set(list.map((e) => e.toLowerCase())).size !== 3) return { ok: false, reason: "the 3 examples must be different" };
  for (const e of list) {
    if (wordCount(e) > maxWords) return { ok: false, reason: `each example must have ${maxWords} words or fewer` };
    if (!matchesIdiom(idiom, e)) return { ok: false, reason: `every example must use the idiom "${idiom.phrase}"` };
  }
  return { ok: true, value: list };
}

export async function generateExamples(
  idiom: Idiom,
  learner: Pick<Learner, "level" | "difficulty_min" | "difficulty_max">,
): Promise<{ examples: string[]; source: "llm" | "curated_fallback" }> {
  const { exampleMaxWords } = getSettings().session;
  try {
    const examples = await chatJson({
      system: systemPrompt(learner),
      user: renderPrompt("examples", {
        phrase: idiom.phrase,
        spoken: idiom.spoken,
        meaning: idiom.meaning,
        whenToUse: idiom.whenToUse,
        literalNote: idiom.literalNote,
        sampleExample: idiom.fallbackExamples[0],
      }),
      schema: EXAMPLES_SCHEMA,
      validate: (raw) => validateExamples(idiom, raw, exampleMaxWords),
    });
    return { examples, source: "llm" };
  } catch (e) {
    if (e instanceof TutorOfflineError || e instanceof TutorInvalidError) {
      // Human-written examples from the curated list – never invented content.
      return { examples: idiom.fallbackExamples, source: "curated_fallback" };
    }
    throw e;
  }
}

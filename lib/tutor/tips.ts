import { loadPraiseLines, renderPrompt } from "../prompts";
import { wordCount } from "../idioms";
import type { Learner } from "../auth";
import type { ProblemWord } from "../scoring/problemWords";
import { systemPrompt } from "./context";
import { chatJson, TutorInvalidError, TutorOfflineError, type Validation } from "./ollama";

export interface Feedback {
  tips: string[];
  praise?: string;
  feedbackSource: "llm" | "template" | "praise";
}

export const HINTS_SCHEMA = {
  type: "object",
  required: ["hints"],
  properties: {
    hints: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        required: ["word", "hint"],
        properties: { word: { type: "string" }, hint: { type: "string" } },
      },
    },
  },
};

/** The factual part of a tip is written in code, so every tip names a real word (research R4). */
export function leadFor(pw: ProblemWord): string {
  switch (pw.type) {
    case "substituted":
      return `I heard “${pw.heard}” for “${pw.word}”.`;
    case "missing":
      return `I didn't hear “${pw.word}”.`;
    case "unclear":
      return `“${pw.word}” was a little unclear.`;
  }
}

export const fixedHint = (word: string) => `Say it slowly: ${word}.`;

/** Keep only well-formed hints for the words we sent; one per word. */
export function validateHints(raw: unknown, words: string[]): Validation<Map<string, string>> {
  const hints = (raw as { hints?: unknown })?.hints;
  if (!Array.isArray(hints)) return { ok: false, reason: 'answer with {"hints": [...]}' };
  const wanted = new Set(words.map((w) => w.toLowerCase()));
  const out = new Map<string, string>();
  for (const h of hints as { word?: unknown; hint?: unknown }[]) {
    if (typeof h?.word !== "string" || typeof h?.hint !== "string") continue;
    const word = h.word.trim().toLowerCase();
    const hint = h.hint.trim();
    if (!wanted.has(word) || out.has(word) || !hint || wordCount(hint) > 20) continue;
    out.set(word, hint);
  }
  if (out.size === 0) {
    return { ok: false, reason: `give one hint (20 words or fewer) for each of these words: ${words.join(", ")}` };
  }
  return { ok: true, value: out };
}

export function pickPraise(lines: string[] = loadPraiseLines()): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "Great job!";
}

export async function buildFeedback(args: {
  target: string;
  transcript: string;
  problemWords: ProblemWord[];
  phase: string;
  learner: Pick<Learner, "level" | "difficulty_min" | "difficulty_max">;
  maxTips?: number;
}): Promise<Feedback> {
  const { problemWords, maxTips = 3 } = args;
  // No problems → praise, and no LLM call, so nothing is invented (FR-012, scenario 2.3).
  if (problemWords.length === 0) return { tips: [], praise: pickPraise(), feedbackSource: "praise" };

  const focus = problemWords.slice(0, maxTips);
  let hints = new Map<string, string>();
  try {
    hints = await chatJson({
      system: systemPrompt(args.learner),
      user: renderPrompt("tips", {
        target: args.target,
        transcript: args.transcript || "(nothing)",
        problemWords: JSON.stringify(focus),
        phase: args.phase,
      }),
      schema: HINTS_SCHEMA,
      validate: (raw) => validateHints(raw, focus.map((p) => p.word)),
    });
  } catch (e) {
    if (!(e instanceof TutorOfflineError || e instanceof TutorInvalidError)) throw e;
  }
  let allFromModel = true;
  const tips = focus.map((pw) => {
    const hint = hints.get(pw.word.toLowerCase());
    if (!hint) allFromModel = false;
    return `${leadFor(pw)} ${hint ?? fixedHint(pw.word)}`;
  });
  return { tips, feedbackSource: allFromModel ? "llm" : "template" };
}

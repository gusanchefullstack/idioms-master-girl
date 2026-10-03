// Opt-in live-model quality checks (SC-005, SC-006). Run with Ollama up: npm run test:tutor
import { describe, expect, it } from "vitest";
import tipsCases from "./fixtures/tips-cases.json";
import gradingCases from "./fixtures/grading-cases.json";
import { buildFeedback } from "@/lib/tutor/tips";
import { gradeSentence } from "@/lib/tutor/grading";
import { getIdiom } from "@/lib/idioms";
import type { ProblemWord } from "@/lib/scoring/problemWords";

const learner = { level: "A2" as const, difficulty_min: 1, difficulty_max: 2 };
const DISCOURAGING = /\b(wrong|bad|terrible|awful|failed|fail|poor|stupid|mistake)\b/i;

describe("SC-005: speaking tips", () => {
  it("≥ 18/20 tips name a real problem word; none discouraging", async () => {
    let naming = 0;
    let fromModel = 0;
    const discouraging: string[] = [];
    for (const c of tipsCases) {
      const f = await buildFeedback({ ...c, problemWords: c.problemWords as ProblemWord[], phase: "try1", learner });
      if (f.feedbackSource === "llm") fromModel++;
      const words = c.problemWords.map((p) => p.word.toLowerCase());
      if (f.tips.length > 0 && f.tips.every((t) => words.some((w) => t.toLowerCase().includes(w)))) naming++;
      for (const t of f.tips) if (DISCOURAGING.test(t)) discouraging.push(t);
    }
    console.log(`tips naming a problem word: ${naming}/20 · fully model-written: ${fromModel}/20`);
    if (discouraging.length) console.log("discouraging:", discouraging);
    expect(naming).toBeGreaterThanOrEqual(18);
    expect(discouraging).toEqual([]);
  });
});

describe("SC-006: writing corrections", () => {
  it("≥ 13/15 corrections fix the error without changing her meaning", async () => {
    let good = 0;
    const misses: string[] = [];
    for (const c of gradingCases) {
      const idiom = getIdiom(c.idiom);
      const r = await gradeSentence(idiom, c.sentence, learner);
      const ok =
        r.status === "graded" &&
        (c.expectedFix === null
          ? r.isCorrect || r.corrected === c.sentence
          : r.corrected.toLowerCase().includes(c.expectedFix.toLowerCase()));
      if (ok) good++;
      else misses.push(`${c.sentence} → ${r.status === "graded" ? r.corrected : r.status}`);
    }
    console.log(`good corrections: ${good}/15`);
    if (misses.length) console.log("misses:\n  " + misses.join("\n  "));
    expect(good).toBeGreaterThanOrEqual(13);
  });
});

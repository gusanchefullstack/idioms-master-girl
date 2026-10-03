import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tutor/ollama", async (orig) => {
  const real = await orig<typeof import("@/lib/tutor/ollama")>();
  return { ...real, chatJson: vi.fn() };
});

import { chatJson, TutorInvalidError, TutorOfflineError } from "@/lib/tutor/ollama";
import { coerceAndValidate, gradeSentence } from "@/lib/tutor/grading";
import { getIdiom } from "@/lib/idioms";

const idiom = getIdiom("break-the-ice");
const learner = { level: "A2" as const, difficulty_min: 1, difficulty_max: 2 };
const mocked = vi.mocked(chatJson);
const base = { usageGrade: 90, grammarGrade: 70, isCorrect: false, explanation: "Use 'broke' for the past." };

beforeEach(() => {
  mocked.mockReset();
});

describe("coerceAndValidate", () => {
  it("isCorrect forces corrected = original", () => {
    const v = coerceAndValidate(idiom, " I broke the ice at work. ", { ...base, isCorrect: true, corrected: "Something else" });
    expect(v.ok && v.value.corrected).toBe("I broke the ice at work.");
  });

  it("identical corrected text forces isCorrect = true", () => {
    const v = coerceAndValidate(idiom, "I broke the ice.", { ...base, corrected: "I broke the ice." });
    expect(v.ok && v.value.isCorrect).toBe(true);
  });

  it("clamps grades and averages them", () => {
    const v = coerceAndValidate(idiom, "I break the ice yesterday.", {
      ...base,
      usageGrade: 140,
      grammarGrade: 61,
      corrected: "I broke the ice yesterday.",
    });
    expect(v.ok && [v.value.usageGrade, v.value.grammarGrade, v.value.grade]).toEqual([100, 61, 81]);
  });

  it("rejects a correction that drops the idiom", () => {
    expect(coerceAndValidate(idiom, "I break ice.", { ...base, corrected: "I was nice." }).ok).toBe(false);
  });

  it("rejects explanations over 40 words or missing fields", () => {
    const long = Array.from({ length: 41 }, () => "word").join(" ");
    expect(coerceAndValidate(idiom, "x", { ...base, corrected: "I broke the ice.", explanation: long }).ok).toBe(false);
    expect(coerceAndValidate(idiom, "x", { corrected: "I broke the ice." }).ok).toBe(false);
  });
});

describe("gradeSentence", () => {
  it("returns graded results from the model", async () => {
    mocked.mockImplementation(async ({ validate }) => {
      const v = validate({ ...base, corrected: "I broke the ice yesterday." });
      if (!v.ok) throw new Error(v.reason);
      return v.value;
    });
    const r = await gradeSentence(idiom, "I break the ice yesterday.", learner);
    expect(r).toMatchObject({ status: "graded", corrected: "I broke the ice yesterday.", grade: 80 });
  });

  it("never invents a grade when offline or invalid", async () => {
    mocked.mockRejectedValueOnce(new TutorOfflineError());
    expect(await gradeSentence(idiom, "x", learner)).toEqual({ status: "could_not_grade" });
    mocked.mockRejectedValueOnce(new TutorInvalidError("bad"));
    expect(await gradeSentence(idiom, "x", learner)).toEqual({ status: "could_not_grade" });
  });
});

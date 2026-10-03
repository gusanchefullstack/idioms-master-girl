import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tutor/ollama", async (orig) => {
  const real = await orig<typeof import("@/lib/tutor/ollama")>();
  return { ...real, chatJson: vi.fn() };
});

import { chatJson, TutorInvalidError, TutorOfflineError } from "@/lib/tutor/ollama";
import { buildFeedback, validateHints } from "@/lib/tutor/tips";
import type { ProblemWord } from "@/lib/scoring/problemWords";

const learner = { level: "A2" as const, difficulty_min: 1, difficulty_max: 2 };
const mocked = vi.mocked(chatJson);
const run = (problemWords: ProblemWord[]) =>
  buildFeedback({ target: "It was a piece of cake", transcript: "It was a piece of cape", problemWords, phase: "try1", learner });

beforeEach(() => {
  mocked.mockReset();
});

describe("buildFeedback", () => {
  it("gives praise and never calls the model when there are no problem words", async () => {
    const f = await run([]);
    expect(f.feedbackSource).toBe("praise");
    expect(f.tips).toEqual([]);
    expect(f.praise).toBeTruthy();
    expect(mocked).not.toHaveBeenCalled();
  });

  it("composes code-written leads with model hints; every tip names its word", async () => {
    mocked.mockImplementation(async ({ validate }) => {
      const v = validate({ hints: [{ word: "cake", hint: "End with a strong K sound." }] });
      if (!v.ok) throw new Error(v.reason);
      return v.value;
    });
    const f = await run([{ word: "cake", type: "substituted", heard: "cape" }]);
    expect(f.feedbackSource).toBe("llm");
    expect(f.tips).toEqual(["I heard “cape” for “cake”. End with a strong K sound."]);
  });

  it("falls back to a fixed hint for a word the model skipped", async () => {
    mocked.mockResolvedValue(new Map([["cake", "Stress the K at the end."]]));
    const f = await run([
      { word: "cake", type: "substituted", heard: "cape" },
      { word: "piece", type: "unclear", probability: 0.4 },
    ]);
    expect(f.feedbackSource).toBe("template");
    expect(f.tips[1]).toBe("“piece” was a little unclear. Say it slowly: piece.");
    for (const [i, w] of ["cake", "piece"].entries()) expect(f.tips[i]).toContain(w);
  });

  it("uses templates when the tutor is offline or invalid", async () => {
    mocked.mockRejectedValueOnce(new TutorOfflineError());
    expect((await run([{ word: "a", type: "missing" }])).tips).toEqual(["I didn't hear “a”. Say it slowly: a."]);
    mocked.mockRejectedValueOnce(new TutorInvalidError("bad"));
    expect((await run([{ word: "a", type: "missing" }])).feedbackSource).toBe("template");
  });

  it("never gives more than 3 tips", async () => {
    mocked.mockRejectedValue(new TutorOfflineError());
    const many = ["one", "two", "three", "four", "five"].map((word) => ({ word, type: "missing" as const }));
    expect((await run(many)).tips).toHaveLength(3);
  });
});

describe("validateHints", () => {
  it("drops hints for unknown words or over 20 words", () => {
    const long = Array.from({ length: 21 }, () => "word").join(" ");
    const v = validateHints(
      { hints: [{ word: "dog", hint: "x" }, { word: "cake", hint: long }, { word: "piece", hint: "Open your mouth." }] },
      ["cake", "piece"],
    );
    expect(v.ok && [...v.value.keys()]).toEqual(["piece"]);
  });

  it("fails when no hint survives", () => {
    expect(validateHints({ hints: [{ word: "dog", hint: "x" }] }, ["cake"]).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeWords } from "@/lib/scoring/normalize";
import { align } from "@/lib/scoring/align";
import { scoreAttempt, type SpokenWord } from "@/lib/scoring/score";

const scoring = { accuracyWeight: 0.7, clarityWeight: 0.3, lowConfidenceThreshold: 0.6, maxTips: 3 };
const words = (text: string, p = 0.9): SpokenWord[] => text.split(" ").map((word) => ({ word, probability: p }));

describe("normalizeWords", () => {
  it("lowercases, strips punctuation and expands contractions", () => {
    expect(normalizeWords("It's a piece of cake!")).toEqual(["it", "is", "a", "piece", "of", "cake"]);
    expect(normalizeWords("Don’t worry, I'm fine.")).toEqual(["do", "not", "worry", "i", "am", "fine"]);
  });

  it("splits hyphens and spells small numbers", () => {
    expect(normalizeWords("once-in-a-lifetime")).toEqual(["once", "in", "a", "lifetime"]);
    expect(normalizeWords("I have 3 kids")).toEqual(["i", "have", "three", "kids"]);
  });

  it("keeps possessive 's", () => {
    expect(normalizeWords("Sam's leg")).toEqual(["sam's", "leg"]);
  });
});

describe("align", () => {
  it("counts substitutions, deletions and insertions", () => {
    const a = align(["a", "piece", "of", "cake"], ["a", "piece", "cape", "really"]);
    expect(a.N).toBe(4);
    expect(a.S + a.D + a.I).toBe(2);
  });
});

describe("scoreAttempt", () => {
  it("gives 100 accuracy for a perfect match, clarity = mean probability", () => {
    const r = scoreAttempt("It was a piece of cake.", words("It was a piece of cake.", 0.9), scoring);
    expect(r.accuracy).toBe(100);
    expect(r.clarity).toBe(90);
    expect(r.combined).toBe(Math.round(0.7 * 100 + 0.3 * 90));
    expect(r.problemWords).toEqual([]);
  });

  it("finds a substituted word with what was heard", () => {
    const r = scoreAttempt("It was a piece of cake.", words("It was a piece of cape."), scoring);
    expect(r.problemWords).toEqual([{ word: "cake", type: "substituted", heard: "cape" }]);
    expect(r.accuracy).toBe(Math.round(100 * (1 - 1 / 6)));
  });

  it("labels a missing word", () => {
    const r = scoreAttempt("It was a piece of cake", words("It was piece of cake"), scoring);
    expect(r.problemWords).toEqual([{ word: "a", type: "missing" }]);
  });

  it("does not count contractions or punctuation as errors", () => {
    const r = scoreAttempt("It is a piece of cake.", words("it's a piece of cake"), scoring);
    expect(r.accuracy).toBe(100);
  });

  it("labels low-confidence matched words as unclear", () => {
    const spoken = words("It was a piece of cake");
    spoken[5].probability = 0.4;
    const r = scoreAttempt("It was a piece of cake", spoken, scoring);
    expect(r.accuracy).toBe(100);
    expect(r.problemWords).toEqual([{ word: "cake", type: "unclear", probability: 0.4 }]);
  });

  it("applies the 70/30 weighting", () => {
    const r = scoreAttempt("one two three four", words("one two three five", 0.5), scoring);
    expect(r.accuracy).toBe(75);
    expect(r.clarity).toBe(50);
    expect(r.combined).toBe(Math.round(0.7 * 75 + 0.3 * 50));
  });

  it("insertions lower accuracy but never below 0", () => {
    const r = scoreAttempt("cake", words("this is a very long different sentence"), scoring);
    expect(r.accuracy).toBe(0);
  });

  it("is deterministic", () => {
    const input = words("It was a piece of cape really");
    expect(scoreAttempt("It was a piece of cake", input, scoring)).toEqual(
      scoreAttempt("It was a piece of cake", input, scoring),
    );
  });

  it("gives 0 clarity when nothing was heard", () => {
    expect(scoreAttempt("cake", [], scoring).clarity).toBe(0);
  });
});

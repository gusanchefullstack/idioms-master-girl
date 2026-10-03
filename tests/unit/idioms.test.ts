import { describe, expect, it } from "vitest";
import { listIdioms, getIdiom, matchesIdiom, validateIdioms, wordCount } from "@/lib/idioms";

describe("content/idioms.json integrity", () => {
  const idioms = listIdioms();

  it("has about 100 entries and passes every content rule", () => {
    expect(idioms.length).toBeGreaterThanOrEqual(100);
    expect(validateIdioms(idioms)).toEqual([]);
  });

  it("uses unique kebab-case ids and allowed levels/difficulties", () => {
    expect(new Set(idioms.map((i) => i.id)).size).toBe(idioms.length);
    for (const i of idioms) {
      expect(i.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(["A2", "B1"]).toContain(i.level);
      expect([1, 2, 3]).toContain(i.difficulty);
    }
  });

  it("keeps meanings, notes and examples short", () => {
    for (const i of idioms) {
      expect(wordCount(i.meaning)).toBeLessThanOrEqual(20);
      expect(wordCount(i.whenToUse)).toBeLessThanOrEqual(25);
      expect(i.fallbackExamples).toHaveLength(3);
      for (const ex of i.fallbackExamples) {
        expect(wordCount(ex)).toBeLessThanOrEqual(15);
        expect(matchesIdiom(i, ex)).toBe(true);
      }
      expect(matchesIdiom(i, i.spoken)).toBe(true);
    }
  });
});

describe("matchesIdiom", () => {
  const ice = getIdiom("break-the-ice");

  it("accepts natural verb changes", () => {
    expect(matchesIdiom(ice, "She broke the ice with a joke")).toBe(true);
    expect(matchesIdiom(ice, "BREAKING THE ICE is hard")).toBe(true);
  });

  it("rejects sentences without the idiom", () => {
    expect(matchesIdiom(ice, "The ice broke")).toBe(false);
    expect(matchesIdiom(ice, "I like ice cream")).toBe(false);
  });

  it("accepts curly apostrophes and pronoun placeholders", () => {
    const leg = getIdiom("pull-someones-leg");
    expect(matchesIdiom(leg, "Are you pulling my leg?")).toBe(true);
    expect(matchesIdiom(leg, "He pulled Sam’s leg")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { computeDailyScore, computeStreak, getSeries } from "@/lib/progress";
import { addSession, memoryDb } from "./helpers";

describe("computeDailyScore", () => {
  it("is the rounded mean of Speak try 2, Write and Read", () => {
    expect(computeDailyScore({ speak_try1_score: 10, speak_try2_score: 80, write_score: 71, read_score: 90 })).toBe(80);
  });
  it("is null while a part is missing", () => {
    expect(computeDailyScore({ speak_try1_score: 1, speak_try2_score: 80, write_score: null, read_score: 90 })).toBeNull();
  });
});

describe("computeStreak", () => {
  it("counts consecutive completed days ending today", () => {
    const db = memoryDb();
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03"]) addSession(db, d, { completed: true, daily: 80 });
    expect(computeStreak(1, "2026-10-03", db)).toBe(3);
  });

  it("still shows the streak when today is not done but yesterday is", () => {
    const db = memoryDb();
    for (const d of ["2026-10-01", "2026-10-02"]) addSession(db, d, { completed: true });
    addSession(db, "2026-10-03");
    expect(computeStreak(1, "2026-10-03", db)).toBe(2);
  });

  it("restarts at 1 after a gap", () => {
    const db = memoryDb();
    addSession(db, "2026-09-29", { completed: true });
    addSession(db, "2026-10-01", { completed: true });
    addSession(db, "2026-10-03", { completed: true });
    expect(computeStreak(1, "2026-10-03", db)).toBe(1);
  });

  it("does not count incomplete days", () => {
    const db = memoryDb();
    addSession(db, "2026-10-02");
    expect(computeStreak(1, "2026-10-03", db)).toBe(0);
  });
});

describe("getSeries", () => {
  it("returns 30 entries with null for missing days", () => {
    const db = memoryDb();
    addSession(db, "2026-10-01", { completed: true, daily: 77 });
    addSession(db, "2026-10-02");
    const s = getSeries(1, 30, "2026-10-03", db);
    expect(s).toHaveLength(30);
    expect(s[29]).toEqual({ date: "2026-10-03", daily: null });
    expect(s[27]).toEqual({ date: "2026-10-01", daily: 77 });
    expect(s[28].daily).toBeNull();
    expect(s[0].date).toBe("2026-09-04");
  });
});

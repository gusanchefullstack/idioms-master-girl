import { describe, expect, it } from "vitest";
import { getOrCreateTodaySession, selectIdiom } from "@/lib/session";
import { addDays, localDate } from "@/lib/dates";
import { listIdioms, type Idiom } from "@/lib/idioms";
import { addSession, memoryDb } from "./helpers";

const learner = { id: 1, level: "A2" as const, difficulty_min: 1, difficulty_max: 2 };
const TODAY = "2026-10-03";
const pool = (ids: string[]): Idiom[] => listIdioms().filter((i) => ids.includes(i.id));

describe("selectIdiom", () => {
  it("is stable for the same date", () => {
    const db = memoryDb();
    expect(selectIdiom(learner, TODAY, db).id).toBe(selectIdiom(learner, TODAY, db).id);
  });

  it("excludes an idiom shown 59 days ago, allows one shown 61 days ago", () => {
    const two = pool(["piece-of-cake", "break-the-ice"]);
    const db = memoryDb();
    addSession(db, addDays(TODAY, -59), { idiom: "piece-of-cake" });
    addSession(db, addDays(TODAY, -61), { idiom: "break-the-ice" });
    for (let i = 0; i < 5; i++) expect(selectIdiom(learner, addDays(TODAY, 0), db, two).id).toBe("break-the-ice");
  });

  it("reuses the oldest-seen idiom when everything was used recently", () => {
    const two = pool(["piece-of-cake", "break-the-ice"]);
    const db = memoryDb();
    addSession(db, addDays(TODAY, -3), { idiom: "piece-of-cake" });
    addSession(db, addDays(TODAY, -10), { idiom: "break-the-ice" });
    expect(selectIdiom(learner, TODAY, db, two).id).toBe("break-the-ice");
  });

  it("respects level and difficulty (A2 learner gets A2–B1, difficulty 1–2)", () => {
    const db = memoryDb();
    const easyOnly = { ...learner, difficulty_max: 1 };
    for (let d = 0; d < 20; d++) {
      const i = selectIdiom(easyOnly, addDays(TODAY, d), db);
      expect(i.difficulty).toBe(1);
      expect(["A2", "B1"]).toContain(i.level);
    }
    const b2Only = listIdioms().map((i) => ({ ...i, level: "B1" as const }));
    const a1 = { ...learner, level: "A1" as const };
    // A1 learner allowed A1–A2 only; with no matches it falls back to the full list rather than crashing.
    expect(selectIdiom(a1, TODAY, db, b2Only)).toBeTruthy();
  });
});

describe("getOrCreateTodaySession – midnight rule", () => {
  const now = new Date(2026, 9, 3, 1, 0, 0); // 01:00 local on Oct 3
  const yesterday = localDate(new Date(2026, 9, 2, 12));

  it("continues yesterday's unfinished session active 2 hours ago", () => {
    const db = memoryDb();
    addSession(db, yesterday, { lastActivity: new Date(now.getTime() - 2 * 3600_000).toISOString() });
    expect(getOrCreateTodaySession(learner, now, db).date).toBe(yesterday);
  });

  it("starts a new session when yesterday's was last active 5 hours ago", () => {
    const db = memoryDb();
    addSession(db, yesterday, { lastActivity: new Date(now.getTime() - 5 * 3600_000).toISOString() });
    const s = getOrCreateTodaySession(learner, now, db);
    expect(s.date).toBe(localDate(now));
    const items = db.prepare("SELECT kind, position FROM practice_items WHERE session_id = ?").all(s.id);
    expect(items).toEqual([{ kind: "idiom", position: 0 }]);
  });

  it("returns the same session when called twice on the same day", () => {
    const db = memoryDb();
    expect(getOrCreateTodaySession(learner, now, db).id).toBe(getOrCreateTodaySession(learner, now, db).id);
  });
});

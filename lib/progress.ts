import { getDb, type Db } from "./db";
import { addDays, localDate } from "./dates";
import type { SessionRow } from "./session";

type Scores = Pick<SessionRow, "speak_try1_score" | "speak_try2_score" | "write_score" | "read_score">;

/** FR-018: mean of Speak try 2, Write and Read aloud. Null while any part is missing. */
export function computeDailyScore(s: Scores): number | null {
  const parts = [s.speak_try2_score, s.write_score, s.read_score];
  if (parts.some((p) => p == null)) return null;
  return Math.round((parts as number[]).reduce((a, b) => a + b, 0) / parts.length);
}

function completedDates(learnerId: number, db: Db): Set<string> {
  const rows = db
    .prepare("SELECT date FROM daily_sessions WHERE learner_id = ? AND completed_at IS NOT NULL")
    .all(learnerId) as { date: string }[];
  return new Set(rows.map((r) => r.date));
}

/**
 * Consecutive completed days ending today, or ending yesterday when today is not done yet
 * (so the streak still shows before she practices). A gap resets it (research R12).
 */
export function computeStreak(learnerId: number, today: string = localDate(), db: Db = getDb()): number {
  const done = completedDates(learnerId, db);
  let day = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** One entry per day for the last `days` days (oldest first); null when not completed. */
export function getSeries(learnerId: number, days = 30, today: string = localDate(), db: Db = getDb()) {
  const from = addDays(today, -(days - 1));
  const rows = db
    .prepare(
      "SELECT date, daily_score FROM daily_sessions WHERE learner_id = ? AND completed_at IS NOT NULL AND date >= ? AND date <= ?",
    )
    .all(learnerId, from, today) as { date: string; daily_score: number | null }[];
  const byDate = new Map(rows.map((r) => [r.date, r.daily_score]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, daily: byDate.get(date) ?? null };
  });
}

export function getTodaySummary(s: Scores & { daily_score: number | null }) {
  return {
    speakTry1: s.speak_try1_score,
    speakTry2: s.speak_try2_score,
    improvement:
      s.speak_try1_score != null && s.speak_try2_score != null ? s.speak_try2_score - s.speak_try1_score : null,
    write: s.write_score,
    read: s.read_score,
    daily: s.daily_score,
  };
}

import { getDb, nowIso, tx, type Db } from "./db";
import { addDays, daysBetween, localDate } from "./dates";
import { getIdiom, listIdioms, type Idiom } from "./idioms";
import { getSettings } from "./config";
import type { Learner } from "./auth";
import type { ItemKind, Phase, Step, StepFacts } from "./steps";

export interface SessionRow {
  id: number;
  learner_id: number;
  date: string;
  idiom_id: string;
  examples_json: string | null;
  examples_source: "llm" | "curated_fallback" | null;
  step: Step;
  speak_try1_score: number | null;
  speak_try2_score: number | null;
  write_score: number | null;
  read_score: number | null;
  daily_score: number | null;
  created_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

export interface ItemRow {
  id: number;
  session_id: number;
  kind: ItemKind;
  position: number;
  text: string;
  audio_key: string | null;
}

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
/** How long an unfinished session from yesterday keeps going after midnight (research R8). */
export const MIDNIGHT_GRACE_MS = 3 * 60 * 60 * 1000;

/** Learner level plus one level up: an A2 learner gets A2 and B1 idioms ("basic to medium"). */
export function allowedLevels(level: Learner["level"]): string[] {
  const i = LEVELS.indexOf(level);
  return LEVELS.slice(0, Math.min(i + 2, LEVELS.length));
}

// Small deterministic PRNG so the same date always gives the same pick.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick today's idiom (FR-004): level + difficulty filter, no repeat in the window, oldest if all used. */
export function selectIdiom(
  learner: Pick<Learner, "id" | "level" | "difficulty_min" | "difficulty_max">,
  date: string,
  db: Db = getDb(),
  idioms: Idiom[] = listIdioms(),
): Idiom {
  const { noRepeatDays } = getSettings().session;
  const levels = allowedLevels(learner.level);
  const pool = idioms.filter(
    (i) => levels.includes(i.level) && i.difficulty >= learner.difficulty_min && i.difficulty <= learner.difficulty_max,
  );
  const candidates = pool.length ? pool : idioms;
  const lastShown = new Map(
    (
      db
        .prepare("SELECT idiom_id, MAX(date) AS last FROM daily_sessions WHERE learner_id = ? AND date < ? GROUP BY idiom_id")
        .all(learner.id, date) as { idiom_id: string; last: string }[]
    ).map((r) => [r.idiom_id, r.last]),
  );
  const eligible = candidates.filter((i) => {
    const last = lastShown.get(i.id);
    return !last || daysBetween(last, date) > noRepeatDays;
  });
  if (eligible.length) {
    const rand = mulberry32(fnv1a(`${learner.id}:${date}`));
    return eligible[Math.floor(rand() * eligible.length)];
  }
  // Everything used recently: reuse the one seen longest ago.
  return [...candidates].sort((a, b) => (lastShown.get(a.id) ?? "").localeCompare(lastShown.get(b.id) ?? ""))[0];
}

export function getSession(id: number, db: Db = getDb()): SessionRow | undefined {
  return db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

/** Session owned by this learner, or undefined. */
export function getOwnedSession(id: number, learnerId: number, db: Db = getDb()): SessionRow | undefined {
  const s = getSession(id, db);
  return s && s.learner_id === learnerId ? s : undefined;
}

export function touchSession(sessionId: number, db: Db = getDb()) {
  db.prepare("UPDATE daily_sessions SET last_activity_at = ? WHERE id = ?").run(nowIso(), sessionId);
}

/** Today's session, or yesterday's unfinished one if it was active in the last 3 hours (midnight rule). */
export function getOrCreateTodaySession(
  learner: Pick<Learner, "id" | "level" | "difficulty_min" | "difficulty_max">,
  now: Date = new Date(),
  db: Db = getDb(),
): SessionRow {
  const today = localDate(now);
  const latest = db
    .prepare("SELECT * FROM daily_sessions WHERE learner_id = ? ORDER BY date DESC LIMIT 1")
    .get(learner.id) as SessionRow | undefined;
  if (latest) {
    if (latest.date === today) return latest;
    if (
      !latest.completed_at &&
      latest.date === addDays(today, -1) &&
      now.getTime() - Date.parse(latest.last_activity_at) <= MIDNIGHT_GRACE_MS
    ) {
      return latest;
    }
  }
  const idiom = selectIdiom(learner, today, db);
  return tx(db, () => {
    const ts = now.toISOString();
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO daily_sessions (learner_id, date, idiom_id, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(learner.id, today, idiom.id, ts, ts);
    db.prepare("INSERT INTO practice_items (session_id, kind, position, text) VALUES (?, 'idiom', 0, ?)").run(
      lastInsertRowid,
      idiom.spoken,
    );
    return getSession(Number(lastInsertRowid), db)!;
  });
}

export function listItems(sessionId: number, db: Db = getDb()): ItemRow[] {
  return db
    .prepare(
      "SELECT * FROM practice_items WHERE session_id = ? ORDER BY CASE kind WHEN 'idiom' THEN 0 WHEN 'example' THEN 1 ELSE 2 END, position",
    )
    .all(sessionId) as unknown as ItemRow[];
}

export function getOwnedItem(itemId: number, learnerId: number, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT pi.*, ds.learner_id, ds.idiom_id FROM practice_items pi
       JOIN daily_sessions ds ON ds.id = pi.session_id WHERE pi.id = ? AND ds.learner_id = ?`,
    )
    .get(itemId, learnerId) as (ItemRow & { learner_id: number; idiom_id: string }) | undefined;
}

export interface AttemptSummary {
  id: number;
  itemId: number;
  phase: Phase;
  accuracy: number;
  clarity: number;
  combined: number;
  transcript: string;
  problemWords: unknown[];
  tips: string[];
  praise?: string;
  feedbackSource: "llm" | "template" | "praise";
  previous?: { phase: "try1"; combined: number; delta: number };
}

interface AttemptRow {
  id: number;
  item_id: number;
  phase: Phase;
  transcript: string;
  accuracy: number;
  clarity: number;
  combined: number;
  problem_words_json: string;
  tips_json: string;
  feedback_source: "llm" | "template" | "praise";
}

export function toAttemptSummary(a: AttemptRow, previousCombined?: number | null): AttemptSummary {
  const tipsData = JSON.parse(a.tips_json || "[]") as string[] | { praise: string };
  const summary: AttemptSummary = {
    id: a.id,
    itemId: a.item_id,
    phase: a.phase,
    accuracy: a.accuracy,
    clarity: a.clarity,
    combined: a.combined,
    transcript: a.transcript,
    problemWords: JSON.parse(a.problem_words_json || "[]"),
    tips: Array.isArray(tipsData) ? tipsData : [],
    feedbackSource: a.feedback_source,
  };
  if (!Array.isArray(tipsData)) summary.praise = tipsData.praise;
  if (a.phase === "try2" && previousCombined != null) {
    summary.previous = { phase: "try1", combined: previousCombined, delta: a.combined - previousCombined };
  }
  return summary;
}

export function countedAttempts(sessionId: number, db: Db = getDb()): AttemptRow[] {
  return db
    .prepare(
      `SELECT sa.* FROM speaking_attempts sa JOIN practice_items pi ON pi.id = sa.item_id
       WHERE pi.session_id = ? AND sa.counted = 1`,
    )
    .all(sessionId) as unknown as AttemptRow[];
}

export interface SentenceRow {
  id: number;
  session_id: number;
  position: number;
  original: string;
  status: "pending" | "graded" | "could_not_grade";
  corrected: string | null;
  is_correct: number | null;
  usage_grade: number | null;
  grammar_grade: number | null;
  grade: number | null;
  explanation: string | null;
}

export function listSentences(sessionId: number, db: Db = getDb()): SentenceRow[] {
  return db
    .prepare("SELECT * FROM written_sentences WHERE session_id = ? ORDER BY position")
    .all(sessionId) as unknown as SentenceRow[];
}

export function toSentencePayload(s: SentenceRow, items: ItemRow[]) {
  const item = items.find((i) => i.kind === "corrected" && i.position === s.position);
  return {
    id: s.id,
    position: s.position,
    original: s.original,
    status: s.status,
    corrected: s.corrected,
    isCorrect: s.is_correct == null ? null : s.is_correct === 1,
    usageGrade: s.usage_grade,
    grammarGrade: s.grammar_grade,
    grade: s.grade,
    explanation: s.explanation,
    itemId: s.status === "graded" ? (item?.id ?? null) : null,
  };
}

export function stepFacts(session: SessionRow, db: Db = getDb()): StepFacts {
  const counted = { try1: 0, try2: 0, read: 0 };
  for (const a of countedAttempts(session.id, db)) counted[a.phase]++;
  const graded = listSentences(session.id, db).filter((s) => s.status === "graded").length;
  return { step: session.step, hasExamples: session.examples_json != null, counted, gradedSentences: graded };
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Recompute the per-phase scores from counted attempts (mean of combined). */
export function recomputePhaseScores(sessionId: number, db: Db = getDb()) {
  const by: Record<Phase, number[]> = { try1: [], try2: [], read: [] };
  for (const a of countedAttempts(sessionId, db)) by[a.phase].push(a.combined);
  db.prepare("UPDATE daily_sessions SET speak_try1_score = ?, speak_try2_score = ?, read_score = ? WHERE id = ?").run(
    mean(by.try1),
    mean(by.try2),
    mean(by.read),
    sessionId,
  );
}

export function toPayload(session: SessionRow, tutorOnline = true, db: Db = getDb()) {
  const idiom = getIdiom(session.idiom_id);
  const items = listItems(session.id, db);
  const attempts: Record<number, Partial<Record<Phase, AttemptSummary>>> = {};
  const counted = countedAttempts(session.id, db);
  const try1ByItem = new Map(counted.filter((a) => a.phase === "try1").map((a) => [a.item_id, a.combined]));
  for (const a of counted) {
    (attempts[a.item_id] ??= {})[a.phase] = toAttemptSummary(a, try1ByItem.get(a.item_id));
  }
  return {
    id: session.id,
    date: session.date,
    step: session.step,
    idiom: {
      id: idiom.id,
      phrase: idiom.phrase,
      spoken: idiom.spoken,
      meaning: idiom.meaning,
      whenToUse: idiom.whenToUse,
      register: idiom.register,
      region: idiom.region,
      literalNote: idiom.literalNote,
    },
    examplesStatus: session.examples_json ? "ready" : "pending",
    examplesSource: session.examples_source,
    items: items.map((i) => ({ id: i.id, kind: i.kind, position: i.position, text: i.text, hasAudio: !!i.audio_key })),
    attempts,
    sentences: listSentences(session.id, db).map((s) => toSentencePayload(s, items)),
    scores: {
      speakTry1: session.speak_try1_score,
      speakTry2: session.speak_try2_score,
      write: session.write_score,
      read: session.read_score,
      daily: session.daily_score,
    },
    tutorOnline,
  };
}

export type SessionPayload = ReturnType<typeof toPayload>;

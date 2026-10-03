// SQLite via Node's built-in `node:sqlite` (research R6). No native addon to build.
// T010 (2026-10-03): verified inside a Next 16.3 route handler (next build + next start) with no
// serverExternalPackages entry needed; SQLite 3.51.3.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config";

export type Db = DatabaseSync;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE learners (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 32 AND username = lower(username) AND username NOT GLOB '*[^a-z0-9_.-]*'),
    email TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%_@_%._%'),
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL CHECK (password_hash LIKE 'scrypt$%$%'),
    level TEXT NOT NULL DEFAULT 'A2' CHECK (level IN ('A1','A2','B1','B2')),
    difficulty_min INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_min BETWEEN 1 AND 3),
    difficulty_max INTEGER NOT NULL DEFAULT 2 CHECK (difficulty_max BETWEEN 1 AND 3),
    voice_pref TEXT NOT NULL DEFAULT 'en-US',
    external_voice_enabled INTEGER NOT NULL DEFAULT 0 CHECK (external_voice_enabled IN (0,1)),
    created_at TEXT NOT NULL,
    CHECK (difficulty_min <= difficulty_max)
  );

  CREATE TABLE auth_sessions (
    token_hash TEXT PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE audio_clips (
    key TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('elevenlabs')),
    voice_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    text TEXT NOT NULL,
    file_path TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE daily_sessions (
    id INTEGER PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    idiom_id TEXT NOT NULL,
    examples_json TEXT NULL,
    examples_source TEXT NULL CHECK (examples_source IN ('llm','curated_fallback')),
    step TEXT NOT NULL DEFAULT 'learn' CHECK (step IN ('learn','speak_try1','speak_try2','write','read_aloud','done')),
    speak_try1_score INTEGER NULL CHECK (speak_try1_score BETWEEN 0 AND 100),
    speak_try2_score INTEGER NULL CHECK (speak_try2_score BETWEEN 0 AND 100),
    write_score INTEGER NULL CHECK (write_score BETWEEN 0 AND 100),
    read_score INTEGER NULL CHECK (read_score BETWEEN 0 AND 100),
    daily_score INTEGER NULL CHECK (daily_score BETWEEN 0 AND 100),
    created_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    completed_at TEXT NULL,
    UNIQUE (learner_id, date)
  );

  CREATE TABLE practice_items (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('idiom','example','corrected')),
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
    text TEXT NOT NULL,
    audio_key TEXT NULL REFERENCES audio_clips(key),
    UNIQUE (session_id, kind, position)
  );

  CREATE TABLE speaking_attempts (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES practice_items(id) ON DELETE CASCADE,
    phase TEXT NOT NULL CHECK (phase IN ('try1','try2','read')),
    status TEXT NOT NULL CHECK (status IN ('scored','rejected')),
    reject_reason TEXT NULL CHECK (reject_reason IN ('too_short','no_speech','unreadable')),
    speech_seconds REAL NULL,
    transcript TEXT NULL,
    words_json TEXT NULL,
    accuracy INTEGER NULL CHECK (accuracy BETWEEN 0 AND 100),
    clarity INTEGER NULL CHECK (clarity BETWEEN 0 AND 100),
    combined INTEGER NULL CHECK (combined BETWEEN 0 AND 100),
    problem_words_json TEXT NULL,
    tips_json TEXT NULL,
    feedback_source TEXT NULL CHECK (feedback_source IN ('llm','template','praise')),
    counted INTEGER NOT NULL DEFAULT 0 CHECK (counted IN (0,1)),
    created_at TEXT NOT NULL,
    CHECK (counted = 0 OR status = 'scored')
  );
  -- exactly one counted scored attempt per (item, phase)
  CREATE UNIQUE INDEX one_counted_attempt ON speaking_attempts(item_id, phase) WHERE counted = 1;

  CREATE TABLE written_sentences (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
    original TEXT NOT NULL CHECK (length(trim(original)) > 0),
    status TEXT NOT NULL CHECK (status IN ('pending','graded','could_not_grade')),
    corrected TEXT NULL,
    is_correct INTEGER NULL,
    usage_grade INTEGER NULL CHECK (usage_grade BETWEEN 0 AND 100),
    grammar_grade INTEGER NULL CHECK (grammar_grade BETWEEN 0 AND 100),
    grade INTEGER NULL CHECK (grade BETWEEN 0 AND 100),
    explanation TEXT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (session_id, position)
  );
  `,
];

export function migrate(db: Db) {
  db.exec("PRAGMA foreign_keys = ON");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

/** Open a database (file path or ":memory:") and apply migrations. Used directly by tests. */
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 3000");
  migrate(db);
  return db;
}

export const DATA_DIR = path.join(ROOT, "data");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");

const g = globalThis as unknown as { __idiomsDb?: Db };

export function getDb(): Db {
  if (!g.__idiomsDb) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    g.__idiomsDb = openDb(process.env.IDIOMS_DB ?? path.join(DATA_DIR, "app.db"));
  }
  return g.__idiomsDb;
}

/** Test hook: replace the singleton (e.g. with an in-memory DB). */
export function setDb(db: Db) {
  g.__idiomsDb = db;
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();

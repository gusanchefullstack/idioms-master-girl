import { openDb, type Db } from "@/lib/db";

export function memoryDb(): Db {
  const db = openDb(":memory:");
  db.prepare(
    `INSERT INTO learners (id, username, email, display_name, password_hash, created_at)
     VALUES (1, 'eugenia', 'eugenia@example.com', 'Eugenia', 'scrypt$00$00', '2026-01-01T00:00:00Z')`,
  ).run();
  return db;
}

export function addSession(
  db: Db,
  date: string,
  opts: { idiom?: string; completed?: boolean; daily?: number; lastActivity?: string } = {},
) {
  const ts = opts.lastActivity ?? `${date}T12:00:00.000Z`;
  db.prepare(
    `INSERT INTO daily_sessions (learner_id, date, idiom_id, examples_json, examples_source, step, daily_score,
       created_at, last_activity_at, completed_at)
     VALUES (1, ?, ?, '[]', 'llm', ?, ?, ?, ?, ?)`,
  ).run(
    date,
    opts.idiom ?? "piece-of-cake",
    opts.completed ? "done" : "learn",
    opts.daily ?? null,
    ts,
    ts,
    opts.completed ? ts : null,
  );
}

// Dev-only: simulate past days for streak/chart checks (quickstart scenarios 14–15).
//   npm run seed:days -- --completed 2026-09-30,2026-10-01
//   npm run seed:days -- --clear-today
import { getDb, tx } from "../lib/db";
import { localDate } from "../lib/dates";
import { listIdioms } from "../lib/idioms";

if (process.env.NODE_ENV === "production") {
  console.error("seed-days is a development tool and refuses to run in production.");
  process.exit(1);
}

const args = process.argv.slice(2);
const db = getDb();
const learner = db.prepare("SELECT id FROM learners LIMIT 1").get() as { id: number } | undefined;
if (!learner) {
  console.error("No learner yet – run npm run setup first.");
  process.exit(1);
}
const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

const completedIdx = args.indexOf("--completed");
if (completedIdx >= 0) {
  const dates = (args[completedIdx + 1] ?? "").split(",").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const idioms = listIdioms();
  tx(db, () => {
    for (const date of dates) {
      const t1 = rand(55, 80);
      const t2 = Math.min(100, t1 + rand(0, 15));
      const w = rand(65, 95);
      const r = rand(65, 95);
      const daily = Math.round((t2 + w + r) / 3);
      const ts = `${date}T19:00:00.000Z`;
      const idiom = idioms[rand(0, idioms.length - 1)];
      db.prepare("DELETE FROM daily_sessions WHERE learner_id = ? AND date = ?").run(learner.id, date);
      db.prepare(
        `INSERT INTO daily_sessions (learner_id, date, idiom_id, examples_json, examples_source, step, speak_try1_score,
           speak_try2_score, write_score, read_score, daily_score, created_at, last_activity_at, completed_at)
         VALUES (?, ?, ?, ?, 'curated_fallback', 'done', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(learner.id, date, idiom.id, JSON.stringify(idiom.fallbackExamples), t1, t2, w, r, daily, ts, ts, ts);
      console.log(`seeded ${date}: ${idiom.phrase} → ${daily}`);
    }
  });
}

if (args.includes("--clear-today")) {
  const r = db.prepare("DELETE FROM daily_sessions WHERE learner_id = ? AND date = ?").run(learner.id, localDate());
  console.log(r.changes ? "Today's session cleared." : "No session today.");
}

if (completedIdx < 0 && !args.includes("--clear-today")) {
  console.log("Usage: npm run seed:days -- --completed YYYY-MM-DD,YYYY-MM-DD | --clear-today");
}

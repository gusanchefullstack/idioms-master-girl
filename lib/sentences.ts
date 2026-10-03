import { getDb, nowIso, tx, type Db } from "./db";
import { getIdiom } from "./idioms";
import { listItems, listSentences, toSentencePayload, touchSession, type SentenceRow } from "./session";
import { gradeSentence } from "./tutor/grading";
import type { Learner } from "./auth";

/** Grade one stored sentence and keep its "corrected" practice item in sync. */
export async function gradeAndStore(row: SentenceRow, idiomId: string, learner: Learner, db: Db = getDb()) {
  const result = await gradeSentence(getIdiom(idiomId), row.original, learner);
  tx(db, () => {
    if (result.status === "graded") {
      db.prepare(
        `UPDATE written_sentences SET status = 'graded', corrected = ?, is_correct = ?, usage_grade = ?, grammar_grade = ?,
           grade = ?, explanation = ?, updated_at = ? WHERE id = ?`,
      ).run(
        result.corrected,
        result.isCorrect ? 1 : 0,
        result.usageGrade,
        result.grammarGrade,
        result.grade,
        result.explanation,
        nowIso(),
        row.id,
      );
      // Upsert the read-aloud item; drop its old counted attempts if the text changed.
      const existing = db
        .prepare("SELECT id, text FROM practice_items WHERE session_id = ? AND kind = 'corrected' AND position = ?")
        .get(row.session_id, row.position) as { id: number; text: string } | undefined;
      if (!existing) {
        db.prepare("INSERT INTO practice_items (session_id, kind, position, text) VALUES (?, 'corrected', ?, ?)").run(
          row.session_id,
          row.position,
          result.corrected,
        );
      } else if (existing.text !== result.corrected) {
        db.prepare("UPDATE practice_items SET text = ?, audio_key = NULL WHERE id = ?").run(result.corrected, existing.id);
        db.prepare("UPDATE speaking_attempts SET counted = 0 WHERE item_id = ?").run(existing.id);
      }
    } else {
      db.prepare(
        `UPDATE written_sentences SET status = 'could_not_grade', corrected = NULL, is_correct = NULL, usage_grade = NULL,
           grammar_grade = NULL, grade = NULL, explanation = NULL, updated_at = ? WHERE id = ?`,
      ).run(nowIso(), row.id);
    }
    updateWriteScore(row.session_id, db);
    touchSession(row.session_id, db);
  });
}

/** Write score = mean of the 3 sentence grades, only when all 3 are graded. */
export function updateWriteScore(sessionId: number, db: Db = getDb()) {
  const rows = listSentences(sessionId, db);
  const graded = rows.filter((r) => r.status === "graded" && r.grade != null);
  const score = graded.length === 3 ? Math.round(graded.reduce((a, r) => a + r.grade!, 0) / 3) : null;
  db.prepare("UPDATE daily_sessions SET write_score = ? WHERE id = ?").run(score, sessionId);
  return score;
}

export function sentencesPayload(sessionId: number, db: Db = getDb()) {
  const items = listItems(sessionId, db);
  const rows = listSentences(sessionId, db);
  const graded = rows.filter((r) => r.status === "graded").length;
  const { write_score } = db.prepare("SELECT write_score FROM daily_sessions WHERE id = ?").get(sessionId) as {
    write_score: number | null;
  };
  return { sentences: rows.map((r) => toSentencePayload(r, items)), writeScore: graded === 3 ? write_score : null };
}

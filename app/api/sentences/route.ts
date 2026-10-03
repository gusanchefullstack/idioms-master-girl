import { errorResponse, HttpError, requireLearner } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { getIdiom, matchesIdiom } from "@/lib/idioms";
import { getOwnedSession, listSentences } from "@/lib/session";
import { gradeAndStore, sentencesPayload } from "@/lib/sentences";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const learner = await requireLearner();
    const body = (await req.json().catch(() => ({}))) as { sessionId?: unknown; sentences?: unknown };
    const session = getOwnedSession(Number(body.sessionId), learner.id);
    if (!session) throw new HttpError(404, { error: "not_found", message: "I can't find that session." });
    const raw = Array.isArray(body.sentences) ? body.sentences : [];
    const sentences = [0, 1, 2].map((i) => (typeof raw[i] === "string" ? (raw[i] as string).trim() : ""));

    // FR-015: check before grading – nothing is graded if any sentence is missing or lacks the idiom.
    const missing = sentences.flatMap((s, i) => (s ? [] : [i + 1]));
    if (missing.length) {
      throw new HttpError(400, {
        error: "missing_sentences",
        positions: missing,
        message: `Please write sentence ${missing.join(" and ")} too.`,
      });
    }
    const idiom = getIdiom(session.idiom_id);
    const noIdiom = sentences.flatMap((s, i) => (matchesIdiom(idiom, s) ? [] : [i + 1]));
    if (noIdiom.length) {
      throw new HttpError(400, {
        error: "idiom_missing",
        positions: noIdiom,
        message: `Sentence ${noIdiom.join(" and ")} doesn't use "${idiom.phrase}" yet – try adding it!`,
      });
    }

    const db = getDb();
    const existing = new Map(listSentences(session.id, db).map((r) => [r.position, r]));
    const upsert = db.prepare(
      `INSERT INTO written_sentences (session_id, position, original, status, updated_at) VALUES (?, ?, ?, 'pending', ?)
       ON CONFLICT (session_id, position) DO UPDATE SET original = excluded.original, status = 'pending', updated_at = excluded.updated_at`,
    );
    for (const [i, text] of sentences.entries()) {
      const prev = existing.get(i + 1);
      if (prev && prev.original === text && prev.status === "graded") continue; // unchanged: keep grade
      upsert.run(session.id, i + 1, text, nowIso());
    }
    for (const row of listSentences(session.id, db)) {
      if (row.status !== "graded") await gradeAndStore(row, session.idiom_id, learner, db);
    }
    return Response.json(sentencesPayload(session.id, db));
  } catch (e) {
    return errorResponse(e);
  }
}

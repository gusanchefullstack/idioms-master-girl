import { errorResponse, HttpError, requireLearner } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOwnedSession, listItems, toSentencePayload, type SentenceRow } from "@/lib/session";
import { gradeAndStore } from "@/lib/sentences";
import { pingOllama } from "@/lib/tutor/ollama";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const learner = await requireLearner();
    const { id } = await ctx.params;
    const db = getDb();
    const row = db.prepare("SELECT * FROM written_sentences WHERE id = ?").get(Number(id)) as SentenceRow | undefined;
    const session = row ? getOwnedSession(row.session_id, learner.id, db) : undefined;
    if (!row || !session) throw new HttpError(404, { error: "not_found", message: "I can't find that sentence." });
    if (!(await pingOllama())) {
      throw new HttpError(503, { error: "tutor_offline", message: "The tutor is offline – start Ollama and try again." });
    }
    await gradeAndStore(row, session.idiom_id, learner, db);
    const fresh = db.prepare("SELECT * FROM written_sentences WHERE id = ?").get(row.id) as unknown as SentenceRow;
    return Response.json(toSentencePayload(fresh, listItems(session.id, db)));
  } catch (e) {
    return errorResponse(e);
  }
}

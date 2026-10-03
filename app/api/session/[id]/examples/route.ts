import { errorResponse, HttpError, requireLearner, type Learner } from "@/lib/auth";
import { getDb, tx } from "@/lib/db";
import { getIdiom } from "@/lib/idioms";
import { getOwnedSession, getSession, toPayload, type SessionRow } from "@/lib/session";
import { generateExamples } from "@/lib/tutor/examples";

export const runtime = "nodejs";

// Concurrent calls for the same session share one generation.
const inflight = new Map<number, Promise<void>>();

async function ensureExamples(session: SessionRow, learner: Learner) {
  if (session.examples_json) return;
  let p = inflight.get(session.id);
  if (!p) {
    p = (async () => {
      const { examples, source } = await generateExamples(getIdiom(session.idiom_id), learner);
      const db = getDb();
      tx(db, () => {
        const fresh = getSession(session.id, db)!;
        if (fresh.examples_json) return;
        db.prepare("UPDATE daily_sessions SET examples_json = ?, examples_source = ? WHERE id = ?").run(
          JSON.stringify(examples),
          source,
          session.id,
        );
        const insert = db.prepare(
          "INSERT INTO practice_items (session_id, kind, position, text) VALUES (?, 'example', ?, ?)",
        );
        examples.forEach((text, i) => insert.run(session.id, i + 1, text));
      });
    })().finally(() => inflight.delete(session.id));
    inflight.set(session.id, p);
  }
  await p;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const learner = await requireLearner();
    const { id } = await ctx.params;
    const session = getOwnedSession(Number(id), learner.id);
    if (!session) throw new HttpError(404, { error: "not_found", message: "I can't find that session." });
    await ensureExamples(session, learner);
    const fresh = getSession(session.id)!;
    return Response.json(toPayload(fresh, fresh.examples_source === "llm"));
  } catch (e) {
    return errorResponse(e);
  }
}

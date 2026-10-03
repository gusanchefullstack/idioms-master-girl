import { errorResponse, HttpError, requireLearner } from "@/lib/auth";
import { getDb, nowIso, tx } from "@/lib/db";
import { computeDailyScore } from "@/lib/progress";
import { getOwnedSession, getSession, stepFacts, toPayload } from "@/lib/session";
import { canAdvance, isStep } from "@/lib/steps";
import { pingOllama } from "@/lib/tutor/ollama";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const learner = await requireLearner();
    const { id } = await ctx.params;
    const session = getOwnedSession(Number(id), learner.id);
    if (!session) throw new HttpError(404, { error: "not_found", message: "I can't find that session." });

    const body = (await req.json().catch(() => ({}))) as { to?: unknown };
    if (!isStep(body.to)) throw new HttpError(400, { error: "bad_step", message: "Unknown step." });
    const to = body.to;

    const db = getDb();
    const check = canAdvance(stepFacts(session, db), to);
    if (!check.ok) throw new HttpError(409, { error: "step_guard", message: check.message });

    tx(db, () => {
      const now = nowIso();
      db.prepare("UPDATE daily_sessions SET step = ?, last_activity_at = ? WHERE id = ?").run(to, now, session.id);
      if (to === "done") {
        const fresh = getSession(session.id, db)!;
        db.prepare("UPDATE daily_sessions SET daily_score = ?, completed_at = ? WHERE id = ?").run(
          computeDailyScore(fresh),
          now,
          session.id,
        );
      }
    });
    return Response.json(toPayload(getSession(session.id, db)!, await pingOllama()));
  } catch (e) {
    return errorResponse(e);
  }
}

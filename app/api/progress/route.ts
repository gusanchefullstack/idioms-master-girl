import { errorResponse, requireLearner } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { localDate } from "@/lib/dates";
import { computeStreak, getSeries, getTodaySummary } from "@/lib/progress";
import type { SessionRow } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const learner = await requireLearner();
    const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
    const today = localDate();
    const latest = getDb()
      .prepare("SELECT * FROM daily_sessions WHERE learner_id = ? ORDER BY date DESC LIMIT 1")
      .get(learner.id) as SessionRow | undefined;
    return Response.json(
      {
        streak: computeStreak(learner.id, today),
        series: getSeries(learner.id, days, today),
        today: latest ? getTodaySummary(latest) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

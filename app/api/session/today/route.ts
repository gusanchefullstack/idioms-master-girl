import { errorResponse, requireLearner } from "@/lib/auth";
import { getOrCreateTodaySession, toPayload } from "@/lib/session";
import { pingOllama } from "@/lib/tutor/ollama";

export const runtime = "nodejs";

/** Returns at once with curated content; examples come from POST /session/{id}/examples. */
export async function GET() {
  try {
    const learner = await requireLearner();
    const session = getOrCreateTodaySession(learner);
    return Response.json(toPayload(session, await pingOllama()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

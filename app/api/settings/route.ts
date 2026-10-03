import { errorResponse, getLearner, HttpError, requireLearner, type Learner } from "@/lib/auth";
import { getElevenLabsKey, getSettings } from "@/lib/config";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const LEVELS = ["A1", "A2", "B1", "B2"];

function payload(l: Learner) {
  return {
    displayName: l.display_name,
    level: l.level,
    difficultyMin: l.difficulty_min,
    difficultyMax: l.difficulty_max,
    externalVoiceEnabled: l.external_voice_enabled === 1,
    externalVoiceAvailable: getElevenLabsKey() !== null,
    privacyNote: getSettings().voice.privacyNote,
  };
}

export async function GET() {
  try {
    return Response.json(payload(await requireLearner()));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const learner = await requireLearner();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const next = {
      display_name: typeof b.displayName === "string" && b.displayName.trim() ? b.displayName.trim().slice(0, 40) : learner.display_name,
      level: typeof b.level === "string" && LEVELS.includes(b.level) ? b.level : learner.level,
      difficulty_min: Number.isInteger(b.difficultyMin) ? (b.difficultyMin as number) : learner.difficulty_min,
      difficulty_max: Number.isInteger(b.difficultyMax) ? (b.difficultyMax as number) : learner.difficulty_max,
      external_voice_enabled:
        typeof b.externalVoiceEnabled === "boolean" ? (b.externalVoiceEnabled ? 1 : 0) : learner.external_voice_enabled,
    };
    if (
      next.difficulty_min < 1 ||
      next.difficulty_max > 3 ||
      next.difficulty_min > next.difficulty_max
    ) {
      throw new HttpError(400, { error: "bad_difficulty", message: "Pick an easiest level that is not harder than the hardest level." });
    }
    if (next.external_voice_enabled === 1 && !getElevenLabsKey()) {
      throw new HttpError(400, { error: "no_key", message: "No ElevenLabs key configured." });
    }
    getDb()
      .prepare(
        "UPDATE learners SET display_name = ?, level = ?, difficulty_min = ?, difficulty_max = ?, external_voice_enabled = ? WHERE id = ?",
      )
      .run(next.display_name, next.level, next.difficulty_min, next.difficulty_max, next.external_voice_enabled, learner.id);
    return Response.json(payload(getLearner(learner.id)));
  } catch (e) {
    return errorResponse(e);
  }
}

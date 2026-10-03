import { errorResponse, HttpError, requireLearner } from "@/lib/auth";
import { getSettings } from "@/lib/config";
import { getDb, nowIso, tx } from "@/lib/db";
import { scoreAttempt } from "@/lib/scoring/score";
import { getOwnedItem, recomputePhaseScores, toAttemptSummary, touchSession } from "@/lib/session";
import { isPhaseAllowed, type Phase } from "@/lib/steps";
import { SttOfflineError, transcribe } from "@/lib/stt";
import { buildFeedback } from "@/lib/tutor/tips";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const PHASES: Phase[] = ["try1", "try2", "read"];

const REJECT_MESSAGES = {
  too_short: "I couldn't hear enough – please try again, a little louder and a little longer.",
  no_speech: "I couldn't hear any words – please check your microphone and try again.",
  unreadable: "That recording didn't work – please record it once more.",
} as const;

export async function POST(req: Request) {
  try {
    const learner = await requireLearner();
    const form = await req.formData().catch(() => null);
    if (!form) throw new HttpError(400, { error: "bad_request", message: "Please send a recording." });

    const itemId = Number(form.get("itemId"));
    const phase = form.get("phase") as Phase;
    const audio = form.get("audio");
    if (!PHASES.includes(phase)) throw new HttpError(400, { error: "bad_phase", message: "Unknown step." });
    if (!(audio instanceof Blob) || audio.size === 0) {
      throw new HttpError(400, { error: "bad_request", message: "Please send a recording." });
    }
    if (audio.size > MAX_BYTES) {
      throw new HttpError(413, { error: "too_large", message: "That recording is too long – keep it under 30 seconds." });
    }
    const item = Number.isInteger(itemId) ? getOwnedItem(itemId, learner.id) : undefined;
    if (!item) throw new HttpError(404, { error: "not_found", message: "I can't find that sentence." });
    if (!isPhaseAllowed(item.kind, phase)) {
      throw new HttpError(400, { error: "bad_phase", message: "This sentence is not part of that step." });
    }

    const settings = getSettings();
    const db = getDb();
    let stt;
    try {
      // Audio goes only to the localhost sidecar and is never written to disk here.
      stt = await transcribe(audio);
    } catch (e) {
      if (e instanceof SttOfflineError) {
        throw new HttpError(503, {
          error: "stt_offline",
          message: "The listening helper is not running. Start it and try again.",
        });
      }
      throw e;
    }

    const reason =
      "rejected" in stt
        ? "unreadable"
        : stt.words.length === 0
          ? "no_speech"
          : stt.speechSeconds < settings.stt.minSpeechSeconds
            ? "too_short"
            : null;
    if (reason) {
      db.prepare(
        `INSERT INTO speaking_attempts (item_id, phase, status, reject_reason, speech_seconds, transcript, counted, created_at)
         VALUES (?, ?, 'rejected', ?, ?, ?, 0, ?)`,
      ).run(item.id, phase, reason, "rejected" in stt ? null : stt.speechSeconds, "rejected" in stt ? null : stt.text, nowIso());
      touchSession(item.session_id, db);
      return Response.json(
        { error: "recording_rejected", reason, message: REJECT_MESSAGES[reason] },
        { status: 422 },
      );
    }
    if ("rejected" in stt) throw new Error("unreachable");

    const score = scoreAttempt(item.text, stt.words, settings.scoring);
    const feedback = await buildFeedback({
      target: item.text,
      transcript: stt.text,
      problemWords: score.problemWords,
      phase,
      learner,
      maxTips: settings.scoring.maxTips,
    });

    const attemptId = tx(db, () => {
      db.prepare("UPDATE speaking_attempts SET counted = 0 WHERE item_id = ? AND phase = ? AND counted = 1").run(
        item.id,
        phase,
      );
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO speaking_attempts
             (item_id, phase, status, speech_seconds, transcript, words_json, accuracy, clarity, combined,
              problem_words_json, tips_json, feedback_source, counted, created_at)
           VALUES (?, ?, 'scored', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .run(
          item.id,
          phase,
          stt.speechSeconds,
          stt.text,
          JSON.stringify(stt.words),
          score.accuracy,
          score.clarity,
          score.combined,
          JSON.stringify(score.problemWords),
          JSON.stringify(feedback.praise ? { praise: feedback.praise } : feedback.tips),
          feedback.feedbackSource,
          nowIso(),
        );
      recomputePhaseScores(item.session_id, db);
      touchSession(item.session_id, db);
      return Number(lastInsertRowid);
    });

    const row = db.prepare("SELECT * FROM speaking_attempts WHERE id = ?").get(attemptId) as unknown as Parameters<
      typeof toAttemptSummary
    >[0];
    const try1 =
      phase === "try2"
        ? (db
            .prepare("SELECT combined FROM speaking_attempts WHERE item_id = ? AND phase = 'try1' AND counted = 1")
            .get(item.id) as { combined: number } | undefined)
        : undefined;
    return Response.json(toAttemptSummary(row, try1?.combined));
  } catch (e) {
    return errorResponse(e);
  }
}

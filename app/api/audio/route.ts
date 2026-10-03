import fs from "node:fs";
import { errorResponse, HttpError, requireLearner } from "@/lib/auth";
import { getOwnedItem } from "@/lib/session";
import { findCachedClip, getOrCreateClip, isExternalVoiceActive } from "@/lib/tts";

export const runtime = "nodejs";

function mp3(file: string) {
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

const fallback = () => new Response(null, { status: 204, headers: { "X-Voice-Fallback": "local" } });

export async function GET(req: Request) {
  try {
    const learner = await requireLearner();
    const itemId = Number(new URL(req.url).searchParams.get("itemId"));
    const item = Number.isInteger(itemId) ? getOwnedItem(itemId, learner.id) : undefined;
    if (!item) throw new HttpError(404, { error: "not_found", message: "I can't find that sentence." });

    // Saved audio always plays – even offline or with the natural voice turned off.
    if (findCachedClip(item.text)) return mp3(await getOrCreateClip(item)); // cache hit: no network

    if (!isExternalVoiceActive(learner)) return fallback();
    try {
      return mp3(await getOrCreateClip(item));
    } catch {
      return fallback();
    }
  } catch (e) {
    return errorResponse(e);
  }
}

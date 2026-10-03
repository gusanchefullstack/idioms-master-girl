import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getElevenLabsKey, getSettings } from "./config";
import { AUDIO_DIR, getDb, nowIso } from "./db";
import type { Learner } from "./auth";

export class VoiceUnavailableError extends Error {}

const normalizeText = (t: string) => t.trim().replace(/\s+/g, " ");

export function audioKey(provider: string, voiceId: string, modelId: string, text: string): string {
  return crypto.createHash("sha256").update(`${provider}|${voiceId}|${modelId}|${normalizeText(text)}`).digest("hex");
}

/** External voice only when she opted in AND a key is configured (research R14). */
export function isExternalVoiceActive(learner: Pick<Learner, "external_voice_enabled">): boolean {
  return learner.external_voice_enabled === 1 && getElevenLabsKey() !== null;
}

interface ClipRow {
  key: string;
  file_path: string;
}

/** Cached clip for this exact text + voice, if the file is still there. */
export function findCachedClip(text: string): string | null {
  const { voiceId, modelId, provider } = getSettings().voice.external;
  const key = audioKey(provider, voiceId, modelId, text);
  const row = getDb().prepare("SELECT key, file_path FROM audio_clips WHERE key = ?").get(key) as ClipRow | undefined;
  return row && fs.existsSync(row.file_path) ? row.file_path : null;
}

const inflight = new Map<string, Promise<string>>();

/**
 * Generate (once) and cache the ElevenLabs clip for a practice item's text.
 * Only practice_items.text is ever sent – never client-provided text.
 */
export function getOrCreateClip(item: { id: number; text: string }): Promise<string> {
  const { voiceId, modelId, provider } = getSettings().voice.external;
  const key = audioKey(provider, voiceId, modelId, item.text);
  const db = getDb();
  const existing = db.prepare("SELECT key, file_path FROM audio_clips WHERE key = ?").get(key) as ClipRow | undefined;
  if (existing && fs.existsSync(existing.file_path)) {
    db.prepare("UPDATE practice_items SET audio_key = ? WHERE id = ?").run(key, item.id);
    return Promise.resolve(existing.file_path);
  }
  let p = inflight.get(key);
  if (!p) {
    p = generate(key, item.text, voiceId, modelId).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p.then((file) => {
    db.prepare("UPDATE practice_items SET audio_key = ? WHERE id = ?").run(key, item.id);
    return file;
  });
}

async function generate(key: string, text: string, voiceId: string, modelId: string): Promise<string> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new VoiceUnavailableError("No ElevenLabs key configured");
  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: normalizeText(text), model_id: modelId }),
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch (e) {
    throw new VoiceUnavailableError(`ElevenLabs unreachable: ${(e as Error).name}`);
  }
  if (!res.ok) throw new VoiceUnavailableError(`ElevenLabs HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const file = path.join(AUDIO_DIR, `${key}.mp3`);
  fs.writeFileSync(file, bytes);
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO audio_clips (key, provider, voice_id, model_id, text, file_path, bytes, created_at)
       VALUES (?, 'elevenlabs', ?, ?, ?, ?, ?, ?)`,
    )
    .run(key, voiceId, modelId, normalizeText(text), file, bytes.length, nowIso());
  return file;
}

/** Quick reachability check for /api/health (no key needed, no data sent). */
export async function pingElevenLabs(): Promise<boolean> {
  try {
    await fetch("https://api.elevenlabs.io", { method: "HEAD", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

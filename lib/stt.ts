import { getSettings } from "./config";

export class SttOfflineError extends Error {
  constructor(cause?: unknown) {
    super("The local speech helper is not reachable");
    this.cause = cause;
  }
}

export interface SttWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface SttResult {
  text: string;
  words: SttWord[];
  speechSeconds: number;
  durationSeconds: number;
}

/** Send audio to the localhost sidecar only (FR-024). Returns {rejected} for undecodable audio. */
export async function transcribe(audio: Blob): Promise<SttResult | { rejected: "unreadable" }> {
  const { stt } = getSettings();
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  let res: Response;
  try {
    res = await fetch(`${stt.baseUrl}/transcribe`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new SttOfflineError(e);
  }
  if (res.status === 400) return { rejected: "unreadable" };
  if (res.status === 503) throw new SttOfflineError(new Error("model still loading"));
  if (!res.ok) throw new SttOfflineError(new Error(`STT HTTP ${res.status}`));
  return (await res.json()) as SttResult;
}

export async function pingStt(): Promise<boolean> {
  const { stt } = getSettings();
  try {
    const res = await fetch(`${stt.baseUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

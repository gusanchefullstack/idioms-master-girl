import fs from "node:fs";
import path from "node:path";

export interface Settings {
  llm: { baseUrl: string; model: string; temperature: number; timeoutMs: number; keepAlive: number | string };
  stt: { baseUrl: string; model: string; minSpeechSeconds: number };
  scoring: { accuracyWeight: number; clarityWeight: number; lowConfidenceThreshold: number; maxTips: number };
  session: { noRepeatDays: number; exampleMaxWords: number };
  tutor: { personality: string };
  voice: {
    external: { provider: "elevenlabs"; voiceId: string; modelId: string };
    localFallback: { lang: string; preferredName: string };
    privacyNote: string;
  };
}

export const ROOT = process.cwd();
const SETTINGS_PATH = path.join(ROOT, "config", "settings.json");

export function validateSettings(s: Settings): Settings {
  const { accuracyWeight, clarityWeight, lowConfidenceThreshold } = s.scoring;
  if (Math.abs(accuracyWeight + clarityWeight - 1) > 0.001) {
    throw new Error("config/settings.json: scoring.accuracyWeight + scoring.clarityWeight must equal 1");
  }
  if (!(lowConfidenceThreshold > 0 && lowConfidenceThreshold < 1)) {
    throw new Error("config/settings.json: scoring.lowConfidenceThreshold must be between 0 and 1");
  }
  if (!(s.session.noRepeatDays >= 1)) {
    throw new Error("config/settings.json: session.noRepeatDays must be at least 1");
  }
  return s;
}

/** Read on every call so edits apply without a restart (FR-023). */
export function getSettings(): Settings {
  return validateSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Settings);
}

let envLoaded = false;

/** Next.js loads .env.local itself; scripts run outside Next, so load it here too. */
function loadEnvLocal() {
  if (envLoaded) return;
  envLoaded = true;
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Never log the returned value. */
export function getElevenLabsKey(): string | null {
  loadEnvLocal();
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  return key ? key : null;
}

// Client-side shapes of the API payloads (contracts/http-api.md).
export type Step = "learn" | "speak_try1" | "speak_try2" | "write" | "read_aloud" | "done";
export type Phase = "try1" | "try2" | "read";

export interface ProblemWord {
  word: string;
  type: "missing" | "substituted" | "unclear";
  heard?: string;
  probability?: number;
}

export interface AttemptSummary {
  id: number;
  itemId: number;
  phase: Phase;
  accuracy: number;
  clarity: number;
  combined: number;
  transcript: string;
  problemWords: ProblemWord[];
  tips: string[];
  praise?: string;
  feedbackSource: "llm" | "template" | "praise";
  previous?: { phase: "try1"; combined: number; delta: number };
}

export interface Item {
  id: number;
  kind: "idiom" | "example" | "corrected";
  position: number;
  text: string;
  hasAudio: boolean;
}

export interface Sentence {
  id: number;
  position: number;
  original: string;
  status: "pending" | "graded" | "could_not_grade";
  corrected: string | null;
  isCorrect: boolean | null;
  usageGrade: number | null;
  grammarGrade: number | null;
  grade: number | null;
  explanation: string | null;
  itemId: number | null;
}

export interface SessionPayload {
  id: number;
  date: string;
  step: Step;
  idiom: {
    id: string;
    phrase: string;
    spoken: string;
    meaning: string;
    whenToUse: string;
    register: string;
    region: string;
    literalNote: string;
  };
  examplesStatus: "ready" | "pending";
  examplesSource: "llm" | "curated_fallback" | null;
  items: Item[];
  attempts: Record<string, Partial<Record<Phase, AttemptSummary>>>;
  sentences: Sentence[];
  scores: { speakTry1: number | null; speakTry2: number | null; write: number | null; read: number | null; daily: number | null };
  tutorOnline: boolean;
}

export async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

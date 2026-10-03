import type { Settings } from "../config";
import { align } from "./align";
import { normalizeWords } from "./normalize";
import { findProblemWords, type ProblemWord } from "./problemWords";

export interface SpokenWord {
  word: string;
  probability: number;
}

export interface AttemptScore {
  accuracy: number;
  clarity: number;
  combined: number;
  problemWords: ProblemWord[];
}

/**
 * FR-010/011. Each STT word may normalize to several tokens ("it's" → "it is");
 * every token keeps the word's probability.
 */
export function scoreAttempt(target: string, spoken: SpokenWord[], scoring: Settings["scoring"]): AttemptScore {
  const heard: string[] = [];
  const probs: number[] = [];
  for (const w of spoken) {
    for (const tok of normalizeWords(w.word)) {
      heard.push(tok);
      probs.push(w.probability);
    }
  }
  const targetWords = normalizeWords(target);
  const a = align(targetWords, heard);
  const wer = a.N ? (a.S + a.D + a.I) / a.N : 1;
  const accuracy = Math.round(100 * Math.max(0, 1 - wer));
  const clarity = spoken.length
    ? Math.round((100 * spoken.reduce((s, w) => s + w.probability, 0)) / spoken.length)
    : 0;
  const combined = Math.round(scoring.accuracyWeight * accuracy + scoring.clarityWeight * clarity);
  return {
    accuracy,
    clarity,
    combined,
    problemWords: findProblemWords(a.ops, probs, scoring.lowConfidenceThreshold),
  };
}

import type { AlignOp } from "./align";

export interface ProblemWord {
  word: string;
  type: "missing" | "substituted" | "unclear";
  heard?: string;
  probability?: number;
}

/** FR-011: missing/replaced target words, plus matched words below the confidence threshold. */
export function findProblemWords(ops: AlignOp[], heardProbs: number[], threshold: number): ProblemWord[] {
  const out: ProblemWord[] = [];
  const seen = new Set<string>();
  for (const op of ops) {
    let pw: ProblemWord | null = null;
    if (op.op === "missing") pw = { word: op.target, type: "missing" };
    else if (op.op === "substituted") pw = { word: op.target, type: "substituted", heard: op.heard };
    else if (op.op === "ok" && heardProbs[op.heardIndex] < threshold) {
      pw = { word: op.target, type: "unclear", probability: heardProbs[op.heardIndex] };
    }
    if (pw && !seen.has(pw.word)) {
      seen.add(pw.word);
      out.push(pw);
    }
  }
  return out;
}

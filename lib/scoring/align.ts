// Word-level Levenshtein alignment with backtrace (research R3 step 2).

export type AlignOp =
  | { op: "ok"; target: string; targetIndex: number; heardIndex: number }
  | { op: "substituted"; target: string; heard: string; targetIndex: number; heardIndex: number }
  | { op: "missing"; target: string; targetIndex: number }
  | { op: "inserted"; heard: string; heardIndex: number };

export interface Alignment {
  ops: AlignOp[];
  S: number;
  D: number;
  I: number;
  N: number;
}

export function align(target: string[], heard: string[]): Alignment {
  const n = target.length;
  const m = heard.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = target[i - 1] === heard[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  // Backtrace, preferring match/substitution, then deletion, then insertion (stable output).
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  let S = 0;
  let D = 0;
  let I = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (target[i - 1] === heard[j - 1] ? 0 : 1)) {
      if (target[i - 1] === heard[j - 1]) {
        ops.push({ op: "ok", target: target[i - 1], targetIndex: i - 1, heardIndex: j - 1 });
      } else {
        S++;
        ops.push({ op: "substituted", target: target[i - 1], heard: heard[j - 1], targetIndex: i - 1, heardIndex: j - 1 });
      }
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      D++;
      ops.push({ op: "missing", target: target[i - 1], targetIndex: i - 1 });
      i--;
    } else {
      I++;
      ops.push({ op: "inserted", heard: heard[j - 1], heardIndex: j - 1 });
      j--;
    }
  }
  ops.reverse();
  return { ops, S, D, I, N: n };
}

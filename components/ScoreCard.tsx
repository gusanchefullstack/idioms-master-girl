import type { AttemptSummary } from "./types";

export function Delta({ value }: { value: number }) {
  const cls = value > 0 ? "up" : value < 0 ? "down" : "same";
  const pts = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;
  const text = value > 0 ? `+${pts(value)}` : value < 0 ? `−${pts(Math.abs(value))}` : "same score";
  return <span className={`delta ${cls}`}>{text}</span>;
}

export default function ScoreCard({ attempt, title }: { attempt: AttemptSummary; title?: string }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="score">
        <span className="big" aria-label={`Score ${attempt.combined} out of 100`}>
          {attempt.combined}
        </span>
        <span className="parts">
          {title ? `${title} · ` : ""}Accuracy {attempt.accuracy} · Clarity {attempt.clarity}
        </span>
        {attempt.previous && <Delta value={attempt.previous.delta} />}
      </div>
      {attempt.problemWords.length > 0 && (
        <div className="row" aria-label="Words to practice">
          {attempt.problemWords.map((p) => (
            <span key={p.word} className={`chip ${p.type === "unclear" ? "warn" : "bad"}`}>
              {p.type === "substituted" ? `${p.word} → ${p.heard}` : p.type === "missing" ? `${p.word} (missed)` : `${p.word} (unclear)`}
            </span>
          ))}
        </div>
      )}
      <p className="muted small">I heard: “{attempt.transcript}”</p>
    </div>
  );
}

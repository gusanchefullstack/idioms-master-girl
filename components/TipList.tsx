import type { AttemptSummary } from "./types";

export default function TipList({ attempt }: { attempt: AttemptSummary }) {
  if (attempt.feedbackSource === "praise" || attempt.tips.length === 0) {
    return <p className="chip good">🎉 {attempt.praise ?? "Great job!"}</p>;
  }
  return (
    <div>
      {attempt.feedbackSource === "template" && <span className="chip small">quick tip</span>}
      <ul className="tips">
        {attempt.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

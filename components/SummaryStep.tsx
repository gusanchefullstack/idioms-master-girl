"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Delta } from "./ScoreCard";
import type { StepProps } from "./LearnStep";

export default function SummaryStep({ session }: StepProps) {
  const [streak, setStreak] = useState<number | null>(null);
  const { scores } = session;

  useEffect(() => {
    fetch("/api/progress?days=30")
      .then((r) => r.json())
      .then((d) => setStreak(d.streak))
      .catch(() => setStreak(null));
  }, []);

  return (
    <div className="stack">
      <section className="card stack" style={{ textAlign: "center" }}>
        <p className="eyebrow">Today&apos;s score</p>
        <p className="daily-score" aria-label={`Daily score ${scores.daily} out of 100`}>
          {scores.daily ?? "–"}
        </p>
        <p>
          You practiced <strong>“{session.idiom.phrase}”</strong> today. Amazing work! 🌟
        </p>
        {streak != null && streak > 0 && (
          <p className="chip good" style={{ alignSelf: "center" }}>
            🔥 {streak} {streak === 1 ? "day" : "days"} in a row
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>How you did</h2>
        <div className="grid-3">
          <div className="stat">
            <div className="label">Speak</div>
            <div className="value">{scores.speakTry2 ?? "–"}</div>
            <div className="small muted">
              Try 1: {scores.speakTry1 ?? "–"}{" "}
              {scores.speakTry1 != null && scores.speakTry2 != null && <Delta value={scores.speakTry2 - scores.speakTry1} />}
            </div>
          </div>
          <div className="stat">
            <div className="label">Write</div>
            <div className="value">{scores.write ?? "–"}</div>
          </div>
          <div className="stat">
            <div className="label">Read aloud</div>
            <div className="value">{scores.read ?? "–"}</div>
          </div>
        </div>
        <p className="small muted">Your daily score is the average of Speak (try 2), Write and Read aloud.</p>
      </section>

      <div className="row">
        <Link href="/progress" className="btn primary">
          See my progress →
        </Link>
      </div>
    </div>
  );
}

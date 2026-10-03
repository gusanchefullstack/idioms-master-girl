"use client";

import { useEffect, useState } from "react";
import ProgressChart from "@/components/ProgressChart";

interface Progress {
  streak: number;
  series: { date: string; daily: number | null }[];
}

export default function ProgressPage() {
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/progress?days=30", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="error">I couldn&apos;t load your progress. Please try again.</p>;
  if (!data) return <div className="card"><div className="skeleton" /></div>;

  const done = data.series.filter((p) => p.daily != null);
  const avg = done.length ? Math.round(done.reduce((a, p) => a + (p.daily ?? 0), 0) / done.length) : null;

  return (
    <main className="stack">
      <h1>My progress</h1>
      <div className="grid-3">
        <div className="stat">
          <div className="label">Streak</div>
          <div className="value">🔥 {data.streak}</div>
          <div className="small muted">{data.streak === 1 ? "day" : "days"} in a row</div>
        </div>
        <div className="stat">
          <div className="label">Days practiced</div>
          <div className="value">{done.length}</div>
          <div className="small muted">in the last 30 days</div>
        </div>
        <div className="stat">
          <div className="label">Average score</div>
          <div className="value">{avg ?? "–"}</div>
          <div className="small muted">last 30 days</div>
        </div>
      </div>
      <section className="card stack">
        <h2>Daily scores – last 30 days</h2>
        {done.length ? (
          <ProgressChart series={data.series} />
        ) : (
          <p className="muted">Finish your first session to start your chart!</p>
        )}
      </section>
    </main>
  );
}

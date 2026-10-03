"use client";

import { useState } from "react";
import WordDiff from "./WordDiff";
import { postJson, type SessionPayload, type Sentence } from "./types";
import type { StepProps } from "./LearnStep";

export default function WriteStep({ session, setSession, advance }: StepProps) {
  const [texts, setTexts] = useState<string[]>(() =>
    [1, 2, 3].map((p) => session.sentences.find((s) => s.position === p)?.original ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; positions: number[] } | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  async function refresh() {
    const res = await fetch("/api/session/today", { cache: "no-store" });
    if (res.ok) setSession((await res.json()) as SessionPayload);
  }

  async function grade() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ message?: string; positions?: number[] }>("/api/sentences", {
        sessionId: session.id,
        sentences: texts,
      });
      if (!res.ok) {
        setMessage({ text: res.data.message ?? "Please check your sentences.", positions: res.data.positions ?? [] });
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function regrade(s: Sentence) {
    setRetrying(s.id);
    try {
      const res = await postJson<{ message?: string }>(`/api/sentences/${s.id}/regrade`, {});
      if (!res.ok) setMessage({ text: res.data.message ?? "Could not grade, try again.", positions: [s.position] });
      await refresh();
    } finally {
      setRetrying(null);
    }
  }

  const graded = session.sentences.filter((s) => s.status === "graded").length;
  const changed = texts.some((t, i) => (session.sentences.find((s) => s.position === i + 1)?.original ?? "") !== t.trim());

  return (
    <div className="stack">
      <section className="card stack">
        <p className="eyebrow">Write</p>
        <h1>Your turn to write</h1>
        <p className="muted">
          Write 3 sentences of your own using <strong>“{session.idiom.phrase}”</strong>. Talk about your day, your
          family, your work – anything!
        </p>
        {[0, 1, 2].map((i) => (
          <label className="field" key={i}>
            <span>Sentence {i + 1}</span>
            <textarea
              value={texts[i]}
              aria-invalid={message?.positions.includes(i + 1) || undefined}
              onChange={(e) => setTexts(texts.map((t, j) => (j === i ? e.target.value : t)))}
              maxLength={300}
            />
          </label>
        ))}
        {message && (
          <p className="error" role="alert">
            {message.text}
          </p>
        )}
        <div className="row">
          <button className="btn primary" onClick={grade} disabled={busy || (!changed && graded === 3)}>
            {busy ? "Your tutor is reading…" : graded ? "Check again" : "Check my sentences"}
          </button>
        </div>
      </section>

      {session.sentences.map((s) => (
        <section className="card stack" key={s.id}>
          <p className="eyebrow">Sentence {s.position}</p>
          {s.status === "graded" ? (
            <>
              <div className="row">
                <span className="chip">Idiom use {s.usageGrade}</span>
                <span className="chip">Grammar {s.grammarGrade}</span>
                {s.isCorrect && <span className="chip good">Correct! 🎉</span>}
              </div>
              <p className="muted small">You wrote: “{s.original}”</p>
              {!s.isCorrect && s.corrected && (
                <p>
                  <strong>Better: </strong>
                  <WordDiff original={s.original} corrected={s.corrected} />
                </p>
              )}
              <p>{s.explanation}</p>
            </>
          ) : s.status === "could_not_grade" ? (
            <div className="row">
              <p className="error">Could not grade, try again.</p>
              <button className="btn small" onClick={() => regrade(s)} disabled={retrying === s.id}>
                {retrying === s.id ? "Trying…" : "Retry"}
              </button>
            </div>
          ) : (
            <p className="muted">Waiting to be graded…</p>
          )}
        </section>
      ))}

      <div className="row">
        <button className="btn primary" disabled={graded < 3} onClick={() => advance("read_aloud")}>
          Next: read aloud →
        </button>
      </div>
    </div>
  );
}

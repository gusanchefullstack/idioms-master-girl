"use client";

import PlayButton from "./PlayButton";
import type { SessionPayload, Step } from "./types";

export interface StepProps {
  session: SessionPayload;
  setSession: (s: SessionPayload) => void;
  advance: (to: Step) => Promise<void>;
}

export default function LearnStep({ session, advance }: StepProps) {
  const { idiom } = session;
  const idiomItem = session.items.find((i) => i.kind === "idiom");
  const examples = session.items.filter((i) => i.kind === "example");
  const pending = session.examplesStatus === "pending";

  return (
    <div className="stack">
      <section className="card stack">
        <p className="eyebrow">Today&apos;s idiom</p>
        <div className="line">
          {idiomItem && <PlayButton itemId={idiomItem.id} text={idiomItem.text} />}
          <h1 className="idiom-hero">{idiom.phrase}</h1>
        </div>
        <p>
          <strong>Meaning:</strong> {idiom.meaning}
        </p>
        <p>
          <strong>When to use it:</strong> {idiom.whenToUse}
        </p>
        <div className="row">
          <span className="chip">{idiom.register}</span>
          <span className="chip">{idiom.region}</span>
        </div>
        <p className="notice small">💡 {idiom.literalNote}</p>
      </section>

      <section className="card stack">
        <div className="spread">
          <h2>Examples</h2>
          {session.examplesSource === "curated_fallback" && (
            <span className="chip warn">Examples from our idiom book</span>
          )}
        </div>
        {pending ? (
          <div className="stack" aria-busy>
            <p className="muted small">Your tutor is writing today&apos;s examples…</p>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : (
          examples.map((ex) => (
            <div className="line" key={ex.id}>
              <PlayButton itemId={ex.id} text={ex.text} />
              <p>{ex.text}</p>
            </div>
          ))
        )}
      </section>

      <div className="row">
        <button className="btn primary" disabled={pending} onClick={() => advance("speak_try1")}>
          Start speaking 🎤
        </button>
      </div>
    </div>
  );
}

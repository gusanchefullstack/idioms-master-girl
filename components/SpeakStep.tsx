"use client";

import PlayButton from "./PlayButton";
import Recorder from "./Recorder";
import ScoreCard, { Delta } from "./ScoreCard";
import TipList from "./TipList";
import { useAttempt } from "./useAttempt";
import type { StepProps } from "./LearnStep";

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export default function SpeakStep({ session, setSession, advance }: StepProps) {
  const phase = session.step === "speak_try1" ? "try1" : "try2";
  const items = session.items.filter((i) => i.kind === "idiom" || i.kind === "example");
  const { submit, busyItem, messages } = useAttempt(session, setSession);
  const done = items.filter((i) => session.attempts[i.id]?.[phase]).length;
  const allDone = done === items.length && items.length === 4;

  const try1Scores = items.map((i) => session.attempts[i.id]?.try1?.combined).filter((x): x is number => x != null);
  const try2Scores = items.map((i) => session.attempts[i.id]?.try2?.combined).filter((x): x is number => x != null);

  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">{phase === "try1" ? "Speak – try 1" : "Speak – try 2"}</p>
        <h1>{phase === "try1" ? "Say it out loud" : "Once more – let's beat your score!"}</h1>
        <p className="muted">
          Listen first if you like, then record yourself saying each line. You can listen to your recording and
          re-record before you submit.
        </p>
        <p className="small muted">
          {done} of {items.length} done
        </p>
      </section>

      {items.map((item) => {
        const attempt = session.attempts[item.id]?.[phase];
        const before = session.attempts[item.id]?.try1;
        return (
          <section className="card item-card" key={item.id}>
            <div className="line">
              <PlayButton itemId={item.id} text={item.text} />
              <p>
                <strong>{item.text}</strong>
              </p>
            </div>
            {phase === "try2" && before && !attempt && <p className="muted small">Try 1 score: {before.combined}</p>}
            <Recorder
              busy={busyItem === item.id}
              label={attempt ? "Record again" : "Record"}
              onSubmit={(blob) => submit(item.id, phase, blob)}
            />
            {messages[item.id] && (
              <p className="error small" role="alert">
                {messages[item.id]}
              </p>
            )}
            {attempt && (
              <>
                <ScoreCard attempt={attempt} title={phase === "try2" && before ? `Try 1: ${before.combined}` : undefined} />
                <TipList attempt={attempt} />
              </>
            )}
          </section>
        );
      })}

      {phase === "try2" && try2Scores.length === items.length && try1Scores.length === items.length && (
        <section className="card spread">
          <div>
            <p className="eyebrow">Overall</p>
            <p>
              Try 1: <strong>{mean(try1Scores)}</strong> → Try 2: <strong>{mean(try2Scores)}</strong>
            </p>
          </div>
          <Delta value={mean(try2Scores) - mean(try1Scores)} />
        </section>
      )}

      <div className="row">
        <button className="btn primary" disabled={!allDone} onClick={() => advance(phase === "try1" ? "speak_try2" : "write")}>
          {phase === "try1" ? "Next: try 2 →" : "Next: write →"}
        </button>
      </div>
    </div>
  );
}

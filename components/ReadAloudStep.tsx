"use client";

import PlayButton from "./PlayButton";
import Recorder from "./Recorder";
import ScoreCard from "./ScoreCard";
import TipList from "./TipList";
import { useAttempt } from "./useAttempt";
import type { StepProps } from "./LearnStep";

export default function ReadAloudStep({ session, setSession, advance }: StepProps) {
  const items = session.items.filter((i) => i.kind === "corrected");
  const { submit, busyItem, messages } = useAttempt(session, setSession);
  const done = items.filter((i) => session.attempts[i.id]?.read).length;

  return (
    <div className="stack">
      <section className="card">
        <p className="eyebrow">Read aloud</p>
        <h1>Your sentences, said beautifully</h1>
        <p className="muted">Listen to each corrected sentence, then read it out loud.</p>
        <p className="small muted">
          {done} of {items.length} done
        </p>
      </section>

      {items.map((item) => {
        const attempt = session.attempts[item.id]?.read;
        return (
          <section className="card item-card" key={item.id}>
            <div className="line">
              <PlayButton itemId={item.id} text={item.text} />
              <p>
                <strong>{item.text}</strong>
              </p>
            </div>
            <Recorder
              busy={busyItem === item.id}
              label={attempt ? "Record again" : "Record"}
              onSubmit={(blob) => submit(item.id, "read", blob)}
            />
            {messages[item.id] && (
              <p className="error small" role="alert">
                {messages[item.id]}
              </p>
            )}
            {attempt && (
              <>
                <ScoreCard attempt={attempt} />
                <TipList attempt={attempt} />
              </>
            )}
          </section>
        );
      })}

      <div className="row">
        <button className="btn primary" disabled={done < 3 || items.length < 3} onClick={() => advance("done")}>
          Finish and see my score 🎉
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import LearnStep from "@/components/LearnStep";
import SpeakStep from "@/components/SpeakStep";
import WriteStep from "@/components/WriteStep";
import ReadAloudStep from "@/components/ReadAloudStep";
import SummaryStep from "@/components/SummaryStep";
import StatusBanner from "@/components/StatusBanner";
import { postJson, type SessionPayload, type Step } from "@/components/types";

const STEP_LABELS: [Step, string][] = [
  ["learn", "Learn"],
  ["speak_try1", "Speak 1"],
  ["speak_try2", "Speak 2"],
  ["write", "Write"],
  ["read_aloud", "Read aloud"],
  ["done", "Score"],
];

export default function SessionPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/session/today", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json()) as SessionPayload;
      if (!res.ok) throw new Error((data as unknown as { message?: string }).message);
      setSession(data);
      if (data.examplesStatus === "pending") {
        const ex = await postJson<SessionPayload>(`/api/session/${data.id}/examples`, {});
        if (ex.ok) setSession(ex.data);
        else setError("I couldn't prepare today's examples. Please try again.");
      }
    } catch (e) {
      setError((e as Error).message || "I couldn't load today's session.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(to: Step) {
    if (!session) return;
    setStepError(null);
    const res = await postJson<SessionPayload & { message?: string }>(`/api/session/${session.id}/step`, { to });
    if (res.ok) {
      setSession(res.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setStepError(res.data.message ?? "Please finish this step first.");
    }
  }

  if (error) {
    return (
      <div className="card stack">
        <p className="error">{error}</p>
        <button className="btn" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="card stack" aria-busy>
        <div className="skeleton" style={{ width: "40%" }} />
        <div className="skeleton" style={{ width: "80%", height: "2.4em" }} />
        <div className="skeleton" />
      </div>
    );
  }

  const current = STEP_LABELS.findIndex(([s]) => s === session.step);
  const common = { session, setSession, advance };

  return (
    <main>
      <ol className="stepper" aria-label="Today's steps">
        {STEP_LABELS.map(([s, label], i) => (
          <li key={s} className={i === current ? "current" : i < current ? "done" : ""} aria-current={i === current ? "step" : undefined}>
            {i < current ? "✓ " : ""}
            {label}
          </li>
        ))}
      </ol>
      <StatusBanner need={session.step.startsWith("speak") || session.step === "read_aloud" ? ["ollama", "stt"] : ["ollama"]} />
      {stepError && (
        <p className="error" role="alert">
          {stepError}
        </p>
      )}
      {session.step === "learn" && <LearnStep {...common} />}
      {(session.step === "speak_try1" || session.step === "speak_try2") && <SpeakStep {...common} key={session.step} />}
      {session.step === "write" && <WriteStep {...common} />}
      {session.step === "read_aloud" && <ReadAloudStep {...common} />}
      {session.step === "done" && <SummaryStep {...common} />}
    </main>
  );
}

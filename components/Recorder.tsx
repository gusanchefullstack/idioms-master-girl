"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 30;
const MIME = "audio/webm;codecs=opus";

type State = "idle" | "recording" | "recorded" | "denied" | "unsupported";

/** Record → listen → re-record or submit (FR-009). Audio stays in the browser until submitted. */
export default function Recorder({
  onSubmit,
  busy,
  label = "Record",
}: {
  onSubmit: (blob: Blob) => Promise<void>;
  busy: boolean;
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (!navigator.mediaDevices || typeof MediaRecorder === "undefined")) {
      setState("unsupported");
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("denied");
      return;
    }
    const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported(MIME) ? { mimeType: MIME } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const b = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setState("recorded");
    };
    recRef.current = rec;
    rec.start();
    setSeconds(0);
    setState("recording");
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  function reset() {
    setBlob(null);
    setUrl(null);
    setState("idle");
  }

  async function submit() {
    if (!blob) return;
    await onSubmit(blob);
    reset();
  }

  if (state === "unsupported") {
    return <p className="error small">This browser can&apos;t record audio. Please use Chrome.</p>;
  }
  if (state === "denied") {
    return (
      <div className="notice small stack" role="alert">
        <p>
          <strong>I need your microphone to listen.</strong> Click the lock icon next to the address bar →
          Microphone → Allow, then reload the page.
        </p>
        <p className="muted">You can still use Learn and Write without it.</p>
        <button type="button" className="btn small" onClick={() => setState("idle")}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="row">
      {state === "idle" && (
        <button type="button" className="btn record" onClick={start} disabled={busy}>
          🎤 {label}
        </button>
      )}
      {state === "recording" && (
        <>
          <button type="button" className="btn record" onClick={stop}>
            ■ Stop
          </button>
          <span className="muted small" aria-live="polite">
            Recording… {seconds}s
          </span>
        </>
      )}
      {state === "recorded" && url && (
        <>
          <audio src={url} controls style={{ height: 36, maxWidth: "100%" }} />
          <button type="button" className="btn small" onClick={reset} disabled={busy}>
            ↺ Re-record
          </button>
          <button type="button" className="btn primary small" onClick={submit} disabled={busy}>
            {busy ? "Listening…" : "Submit"}
          </button>
        </>
      )}
    </div>
  );
}

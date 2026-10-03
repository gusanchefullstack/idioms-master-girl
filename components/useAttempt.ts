"use client";

import { useState } from "react";
import type { AttemptSummary, Phase, SessionPayload } from "./types";

/** Submits one recording and merges the scored attempt into the session state. */
export function useAttempt(session: SessionPayload, setSession: (s: SessionPayload) => void) {
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});

  async function submit(itemId: number, phase: Phase, blob: Blob) {
    setBusyItem(itemId);
    setMessages((m) => ({ ...m, [itemId]: "" }));
    try {
      const form = new FormData();
      form.append("itemId", String(itemId));
      form.append("phase", phase);
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/attempts", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => ({ ...m, [itemId]: data.message ?? "Something went wrong – please try again." }));
        return;
      }
      const attempt = data as AttemptSummary;
      setSession({
        ...session,
        attempts: { ...session.attempts, [itemId]: { ...session.attempts[itemId], [phase]: attempt } },
      });
    } catch {
      setMessages((m) => ({ ...m, [itemId]: "I can't reach the app right now. Is it running?" }));
    } finally {
      setBusyItem(null);
    }
  }

  return { submit, busyItem, messages };
}

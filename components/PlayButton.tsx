"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "playing" | "unavailable";

const LOCAL_LANG = "en-US";
const PREFERRED = "Samantha";

/** On-device voices only – Chrome's "Google US English" voices go over the network (research R5). */
function pickLocalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.localService && v.lang === LOCAL_LANG);
  return voices.find((v) => v.name.startsWith(PREFERRED)) ?? voices[0] ?? null;
}

export default function PlayButton({ itemId, text }: { itemId: number; text: string }) {
  const [state, setState] = useState<State>("idle");
  const urlRef = useRef<string | null>(null);
  const localRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Voices load asynchronously in Chrome.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  function speakLocally() {
    const voice = pickLocalVoice();
    if (!voice) {
      setState("unavailable");
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = LOCAL_LANG;
    u.rate = 0.92;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    window.speechSynthesis.cancel();
    setState("playing");
    window.speechSynthesis.speak(u);
  }

  function playUrl(url: string) {
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = url;
    audio.onended = () => setState("idle");
    audio.onerror = () => setState("idle");
    setState("playing");
    audio.play().catch(() => setState("idle"));
  }

  async function onClick() {
    if (state === "playing") {
      audioRef.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setState("idle");
      return;
    }
    if (urlRef.current) return playUrl(urlRef.current); // instant replay
    if (localRef.current) return speakLocally();
    setState("loading");
    try {
      const res = await fetch(`/api/audio?itemId=${itemId}`);
      if (res.status === 200) {
        urlRef.current = URL.createObjectURL(await res.blob());
        return playUrl(urlRef.current);
      }
      localRef.current = true;
      speakLocally();
    } catch {
      localRef.current = true;
      speakLocally();
    }
  }

  const label =
    state === "unavailable" ? "Audio unavailable" : state === "playing" ? `Stop: ${text}` : `Play: ${text}`;
  return (
    <button
      type="button"
      className={`icon-btn${state === "playing" ? " playing" : ""}`}
      onClick={onClick}
      disabled={state === "loading" || state === "unavailable"}
      aria-label={label}
      title={state === "unavailable" ? "Audio unavailable" : "Play"}
    >
      {state === "loading" ? "…" : state === "playing" ? "■" : state === "unavailable" ? "🔇" : "▶"}
    </button>
  );
}

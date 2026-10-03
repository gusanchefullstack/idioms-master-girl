"use client";

import { useEffect, useState } from "react";

interface Health {
  ollama: "up" | "down";
  stt: "up" | "down";
  externalVoice: "on" | "off" | "unreachable";
}

/** Friendly banners instead of crashes when a local helper is down. */
export default function StatusBanner({ need = ["ollama"] }: { need?: ("ollama" | "stt")[] }) {
  const [health, setHealth] = useState<Health | null>(null);

  async function check() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth(await res.json());
    } catch {
      setHealth(null);
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (!health) return null;
  const msgs: string[] = [];
  if (need.includes("ollama") && health.ollama === "down") {
    msgs.push("Tutor is offline – start Ollama and press retry.");
  }
  if (need.includes("stt") && health.stt === "down") {
    msgs.push("The listening helper is not running. Start it with npm run dev and press retry.");
  }
  if (!msgs.length) return null;
  return (
    <div className="banner" role="status">
      <div>
        {msgs.map((m) => (
          <p key={m}>{m}</p>
        ))}
      </div>
      <button type="button" className="btn small" onClick={check}>
        Retry
      </button>
    </div>
  );
}

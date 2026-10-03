"use client";

import { useEffect, useState } from "react";

interface SettingsData {
  displayName: string;
  level: string;
  difficultyMin: number;
  difficultyMax: number;
  externalVoiceEnabled: boolean;
  externalVoiceAvailable: boolean;
  privacyNote: string;
}

const DIFFICULTY = ["", "Basic", "Medium", "Advanced"];

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setData);
  }, []);

  async function save(patch: Partial<SettingsData>) {
    setStatus(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (res.ok) {
      setData(body);
      setStatus("Saved ✓");
    } else setStatus(body.message ?? "Could not save.");
  }

  if (!data) return <div className="card"><div className="skeleton" /></div>;

  return (
    <main className="stack">
      <h1>Settings</h1>
      <section className="card stack">
        <h2>Profile</h2>
        <label className="field">
          <span>Name</span>
          <input defaultValue={data.displayName} onBlur={(e) => e.target.value !== data.displayName && save({ displayName: e.target.value })} />
        </label>
        <label className="field">
          <span>English level</span>
          <select value={data.level} onChange={(e) => save({ level: e.target.value })}>
            {["A1", "A2", "B1", "B2"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <label className="field">
            <span>Easiest idioms</span>
            <select value={data.difficultyMin} onChange={(e) => save({ difficultyMin: Number(e.target.value) })}>
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Hardest idioms</span>
            <select value={data.difficultyMax} onChange={(e) => save({ difficultyMax: Number(e.target.value) })}>
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="small muted">Changes apply from tomorrow&apos;s idiom.</p>
      </section>

      <section className="card stack">
        <h2>Voice</h2>
        <label className="row" style={{ fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={data.externalVoiceEnabled}
            disabled={!data.externalVoiceAvailable}
            onChange={(e) => save({ externalVoiceEnabled: e.target.checked })}
            style={{ width: 20, height: 20 }}
          />
          Use the natural American voice (ElevenLabs)
        </label>
        {!data.externalVoiceAvailable && <p className="small muted">No ElevenLabs key configured.</p>}
        <p className="notice small">🔒 {data.privacyNote}</p>
        <p className="small muted">
          When it is off (or the internet is down), this laptop&apos;s own voice reads the sentences. Audio you already
          played is saved and keeps working offline.
        </p>
      </section>
      {status && <p role="status">{status}</p>}
    </main>
  );
}

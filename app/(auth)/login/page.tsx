"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        router.replace("/session");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Username/email or password is not right.");
    } catch {
      setError("I can't reach the app right now. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="card login-card">
        <p className="eyebrow">IdiomsMasterGirl</p>
        <h1>Welcome back! 👋</h1>
        <p className="muted">One idiom a day, out loud and in your own words.</p>
        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span>Username or email</span>
            <input
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

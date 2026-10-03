// Loads Gemma into memory at `npm run dev` so the first session of the day is fast (research R1).
// Always exits 0: a missing Ollama must not stop the app from starting.
import { getSettings } from "../lib/config";

async function main() {
  const { llm } = getSettings();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${llm.baseUrl}/api/version`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  try {
    const t = Date.now();
    const res = await fetch(`${llm.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: llm.model,
        stream: false,
        think: false,
        keep_alive: llm.keepAlive,
        messages: [{ role: "user", content: "Say OK." }],
        options: { num_predict: 2 },
      }),
    });
    console.log(res.ok ? `Tutor model ${llm.model} is warm (${Date.now() - t} ms).` : `Warm-up failed: HTTP ${res.status}`);
  } catch {
    console.log("Ollama is not running – the tutor will show as offline until you start it.");
  }
}

main().finally(() => process.exit(0));

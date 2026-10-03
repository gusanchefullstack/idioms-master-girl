// `npm run setup` – one-time setup (research R15). Safe to run again.
import { execSync, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Writable } from "node:stream";
import { getElevenLabsKey, getSettings } from "../lib/config";
import { getDb } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { listIdioms } from "../lib/idioms";

const ok = (m: string) => console.log(`✓ ${m}`);
const step = (m: string) => console.log(`\n→ ${m}`);

async function promptHidden(question: string): Promise<string> {
  let muted = false;
  const out = new Writable({
    write(chunk, enc, cb) {
      if (!muted) output.write(chunk, enc as BufferEncoding);
      cb();
    },
  });
  const rl = readline.createInterface({ input, output: out, terminal: true });
  const p = rl.question(question);
  muted = true;
  const answer = await p;
  rl.close();
  output.write("\n");
  return answer;
}

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 26) throw new Error(`Node 26+ is required (found ${process.versions.node}). Run: nvm use`);
  ok(`Node ${process.versions.node}`);

  const { llm } = getSettings();
  step("Checking Ollama");
  try {
    const res = await fetch(`${llm.baseUrl}/api/tags`);
    const { models } = (await res.json()) as { models: { name: string }[] };
    if (models.some((m) => m.name === llm.model || m.name === `${llm.model}:latest`)) ok(`${llm.model} is installed`);
    else {
      console.log(`Pulling ${llm.model} (this can take a while)…`);
      execSync(`ollama pull ${llm.model}`, { stdio: "inherit" });
    }
  } catch {
    console.log(`⚠ Ollama is not reachable at ${llm.baseUrl}. Install it from https://ollama.com, start it, then run: ollama pull ${llm.model}`);
  }

  step("Installing the speech helper (Python, via uv)");
  if (spawnSync("uv", ["sync", "--project", "stt"], { stdio: "inherit" }).status !== 0) throw new Error("uv sync failed");
  if (spawnSync("bash", ["scripts/fetch-models.sh"], { stdio: "inherit" }).status !== 0) throw new Error("Whisper download failed");
  ok("Speech helper ready");

  step("Preparing the database");
  const db = getDb();
  ok(`data/app.db ready · ${listIdioms().length} curated idioms loaded`);

  const rl = readline.createInterface({ input, output });
  const existing = db.prepare("SELECT id, display_name FROM learners LIMIT 1").get() as { id: number; display_name: string } | undefined;
  let learnerId = existing?.id;
  if (existing) {
    ok(`Account for ${existing.display_name} already exists`);
  } else {
    step("Creating the learner account");
    const displayName = (await rl.question("Her name (e.g. Eugenia): ")).trim() || "Eugenia";
    let username = "";
    while (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      username = (await rl.question("Username (3–32 letters, numbers, . _ -): ")).trim().toLowerCase();
    }
    let email = "";
    while (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) email = (await rl.question("Email: ")).trim().toLowerCase();
    rl.pause();
    let password = "";
    for (;;) {
      password = await promptHidden("Password (8+ characters): ");
      const again = await promptHidden("Password again: ");
      if (password.length >= 8 && password === again) break;
      console.log("Passwords must match and have at least 8 characters.");
    }
    rl.resume();
    const res = db
      .prepare(
        "INSERT INTO learners (username, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(username, email, displayName, hashPassword(password), new Date().toISOString());
    learnerId = Number(res.lastInsertRowid);
    ok(`Account created for ${displayName}`);
  }

  step("Natural voice (optional)");
  if (!getElevenLabsKey()) {
    console.log("No ELEVENLABS_API_KEY in .env.local – the laptop's own voice will be used.");
    db.prepare("UPDATE learners SET external_voice_enabled = 0 WHERE id = ?").run(learnerId!);
  } else {
    const answer = (
      await rl.question("Use the natural ElevenLabs voice? Only the sentence text is sent to ElevenLabs. (y/N) ")
    )
      .trim()
      .toLowerCase();
    const on = answer === "y" || answer === "yes";
    db.prepare("UPDATE learners SET external_voice_enabled = ? WHERE id = ?").run(on ? 1 : 0, learnerId!);
    ok(on ? "Natural voice ON (change it any time in Settings)" : "Natural voice OFF");
  }
  rl.close();

  console.log("\nAll set! Start the app with:  npm run dev   →  http://localhost:3000");
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});

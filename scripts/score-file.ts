// `npm run score:file -- <audio> "<target>"` – scores a file exactly like the app (SC-004 check).
import fs from "node:fs";
import { getSettings } from "../lib/config";
import { scoreAttempt } from "../lib/scoring/score";
import { transcribe } from "../lib/stt";

async function main() {
  const [file, target] = process.argv.slice(2);
  if (!file || !target) {
    console.error('Usage: npm run score:file -- <audioFile> "<target sentence>"');
    process.exit(2);
  }
  const stt = await transcribe(new Blob([fs.readFileSync(file)]));
  if ("rejected" in stt) {
    console.log(JSON.stringify({ rejected: stt.rejected }));
    return;
  }
  const score = scoreAttempt(target, stt.words, getSettings().scoring);
  console.log(JSON.stringify({ transcript: stt.text, speechSeconds: stt.speechSeconds, ...score }, null, 2));
}

main().catch((e) => {
  console.error((e as Error).message, "– is the speech helper running? (npm run dev)");
  process.exit(1);
});

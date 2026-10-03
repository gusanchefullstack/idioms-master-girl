# Quickstart & Validation: IdiomsMasterGirl

This guide covers how to run the app and how to prove each user story works. Behavior
details are in [contracts/](./contracts/) and [data-model.md](./data-model.md).

## Prerequisites (one-time, needs internet)

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 26.x (`.nvmrc`) | `node --version` |
| uv | any recent | `uv --version` (installs Python 3.12 for `stt/`) |
| Ollama | ≥ 0.30.9 | `ollama --version`, with the app running |
| Chrome | current | needed for MediaRecorder and the mic on `localhost` |
| ElevenLabs key | optional | put `ELEVENLABS_API_KEY=…` in `.env.local` |

No system ffmpeg is needed, because PyAV ships its own decoders.

## Setup

```bash
nvm use                      # Node 26
npm install
npm run setup                # pulls gemma4:e2b if missing, uv sync in stt/,
                             # pre-downloads Whisper small.en, creates data/app.db,
                             # asks for username / email / password
npm run dev                  # starts the STT sidecar (127.0.0.1:8765) and Next.js (127.0.0.1:3000)
```

Health check: `curl -s localhost:3000/api/health` should show
`{"ollama":"up","stt":"up",…}`. `npm run dev` also warms Gemma, so the first session of the
day gets its examples quickly.

During setup, the natural ElevenLabs voice is **opt-in** (default No). It can be changed
later in Settings.

## Automated checks

```bash
npm test                     # Vitest: normalize/align/WER, scores, problem words, variants,
                             # idiom selection (60-day window), streak, daily score, validators,
                             # idioms.json integrity
uv run --project stt pytest  # sidecar: /health and transcribing the bundled clip (offline)
npm run test:tutor           # opt-in, live local model: tips (SC-005) and grading (SC-006)
```

Expected: everything passes, and `test:tutor` reports ≥ 18/20 tips and ≥ 13/15 corrections.

## Manual validation scenarios

Open `http://localhost:3000` in Chrome and allow the microphone.

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| 1 | US1 | Sign in with the username, then sign out and sign in with the email. Use a wrong password once. | Lands on today's session. The wrong password shows the same generic message for either field. |
| 2 | US1 | Look at Learn. | One idiom, its meaning, a "when to use it" note, and exactly 3 short examples (≤ 15 words) that use the idiom figuratively. Shown within 10 s (SC-002). |
| 3 | US1 | Reload the page. | Same idiom and examples. The step is unchanged. |
| 4 | US1 | Press play on the idiom, then press it again. | It plays an American voice. The second play starts in ≤ 1 s, and a file exists in `data/audio/`. |
| 5 | US2 | Speak try 1: record all 4 items, saying one example wrong on purpose (e.g. "cape" for "cake"). | Each item shows accuracy, clarity, combined and problem words within 8 s (SC-003). The wrong one gets 1–3 tips naming "cake" and "cape". A clean one gets praise and no tips. |
| 6 | US2 | Record about 0.3 s, or silence. | "Please try again" message. Not counted, and the step does not advance. |
| 7 | US2 | Speak try 2: record all 4 again, correctly. | Try-2 scores appear with "+N points" for each item and overall. |
| 8 | US2 | `npm run score:file -- stt/tests/fixtures/clip.webm "Finishing the homework was a piece of cake for me."` twice (dev script: sidecar transcription → the same scorer as the app). Optionally record your own clear take to a file and repeat. | Combined scores are within ±5 (SC-004); in the spike they were identical. |
| 9 | US3 | Write: leave one sentence empty, then one without the idiom. | Asks for the missing sentence, then a gentle reminder to use the idiom. Nothing is graded. |
| 10 | US3 | Submit 1 correct sentence, 1 with a grammar error and 1 with the idiom used wrongly. | Each shows a usage grade, a grammar grade, a corrected version and a 1–2 line explanation. The correct one is unchanged and labeled correct. |
| 11 | US4 | Read aloud: play each corrected sentence, then record it. | Audio plays. Each reading is scored like Speak, with tips. |
| 12 | US5 | Finish. | Summary shows the daily score and the Speak try-2, Write and Read scores. Progress shows today on the chart, and the streak is ≥ 1. |
| 13 | US5 | Leave mid-step, then come back the same day. | Resumes at the same step with earlier results kept. |
| 14 | US5 | Streak simulation: `npm run seed:days -- --completed 2026-09-30,2026-10-01,2026-10-02` (dev-only script), then reload Progress. | Streak is 4 after today. With a gap, the streak resets to 1. |
| 15 | Edge | Quit Ollama, then start a new day (`npm run seed:days -- --clear-today`). | Curated fallback examples and a "tutor is offline" banner. Speak still scores, with "quick tip" template tips. Write shows "could not grade, try again". No crash. |
| 16 | Edge | Stop the sidecar. | Speak shows "listening helper is not running". Learn and Write still work. |
| 17 | Edge | Block the mic in Chrome. | Help message on how to allow it. Learn and Write still work. |

## Offline run (required before submission — Constitution, SC-009)

1. Do one online session first, so today's audio is cached.
2. Turn off Wi-Fi (or turn networking off), restart `npm run dev`, and keep Ollama running.
3. Complete a full session (scenarios 2–12). Expected:
   - cached clips play;
   - uncached sentences use the macOS local voice (e.g. Samantha);
   - every step completes;
   - `/api/health` shows `externalVoice: "unreachable"` or `"off"`.
4. Settings → turn off the natural voice. All audio then uses the local voice, and no
   request to `api.elevenlabs.io` happens (check Chrome DevTools → Network and the server
   log).

## Timing check (SC-001)

Time one full session as Eugenia would do it. The target is ≤ 20 minutes.

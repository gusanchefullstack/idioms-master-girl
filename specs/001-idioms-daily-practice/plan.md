# Implementation Plan: IdiomsMasterGirl – Daily Idiom Practice

**Branch**: `001-idioms-daily-practice` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-idioms-daily-practice/spec.md`

## Summary

A single-user, local-first web app that runs one daily idiom session for Eugenia (A2 ESL):
Learn → Speak try 1 → Speak try 2 → Write → Read aloud → Daily score. The idiom comes from
a curated, versioned JSON list. Gemma (open weights) running in Ollama writes the examples,
speaking tips and writing grades, with JSON-schema-constrained output. A small Python
sidecar runs faster-whisper locally to give per-word transcripts and confidences. Scoring
(WER-based accuracy, confidence-based clarity, 70/30 combination, problem words) is
deterministic TypeScript. ElevenLabs is an optional, opt-in voice; when it is off or
unreachable, the browser's on-device voice is used. Next.js (TypeScript) serves the UI and
API routes, and data lives in a local SQLite file through Node's built-in `node:sqlite`.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 26 (pinned in `.nvmrc` and `engines`);
Python 3.12 (managed by `uv`) for the speech sidecar only.

**Primary Dependencies**: Next.js 16 (App Router, route handlers on the Node runtime), React
19; Ollama ≥ 0.30.9 with `gemma4:e2b` (4.6B, Q4_K_M) as the default model;
faster-whisper 1.2.x + PyAV < 17 + FastAPI/uvicorn in the sidecar; ElevenLabs TTS REST API
(optional); `concurrently` to start both processes with one command.

**Storage**: SQLite file `data/app.db` via built-in `node:sqlite` (no native addon);
audio cache as files under `data/audio/`; curated idioms in `content/idioms.json`; prompts
in `prompts/*.md`; settings in `config/settings.json`.

**Testing**: Vitest for pure logic (alignment/WER, scoring, problem words, idiom-variant
match, idiom selection, streak, daily score) and the LLM output validators; pytest smoke test
for the sidecar (`/health`, transcribe a bundled clip); a manual end-to-end script with
networking off (see [quickstart.md](./quickstart.md)).

**Target Platform**: The couple's MacBook (Apple M4, 24 GB RAM), used in desktop Chrome at
`http://localhost:3000`; layouts also work at phone width.

**Project Type**: Local web app (Next.js UI + API) with one local Python helper service.

**Performance Goals**: Measured in the spikes ([research.md](./research.md) R1–R2): warm
Gemma call ≈ 2 s, cold call (model load included) 11.9–13.4 s, `small.en` transcription of
a 3 s clip ≈ 1.1 s. SC-003 (≤ 8 s) fits with a warm model. SC-002 (≤ 10 s) is met because
`npm run dev` warms Gemma at start and keeps it loaded (`keep_alive: -1`). The Learn page
also shows the curated idiom, meaning and note at once, and loads the examples in a second
request. A truly cold first open can take about 13 s for the examples only; this is a
documented limitation.

**Constraints**: Offline after setup (except new ElevenLabs audio); no audio leaves the
device; zero running cost; default model ≤ 8B; servers bound to `127.0.0.1`; repeatable
scores (±5, SC-004).

**Scale/Scope**: 1 user, about 1 session a day, about 100 curated idioms, about 6 screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan complies |
|-----------|--------|-----------------------|
| I. Open-Source AI at the Core | ✅ PASS | All tutor text comes from Gemma 4 E2B (open weights, Apache 2.0, confirmed via `ollama show --license`) via Ollama (MIT). Speech recognition uses faster-whisper (MIT) with Whisper weights (MIT). The model name, endpoint and Whisper size are in `config/settings.json`. Prompts are versioned in `prompts/`. With no ElevenLabs key, every step works. |
| II. Built for One Real Person | ✅ PASS | Every feature traces to Eugenia's A2 practice loop. Her level, difficulty, voice, tutor personality and score weights live in the profile and settings, not in code. There is no sign-up flow and no multi-user code. |
| III. Local-First & Private | ✅ PASS | SQLite, audio and recordings stay on the laptop. There is no telemetry. Recordings go only to the localhost sidecar. ElevenLabs is **opt-in**: `npm run setup` asks an explicit y/n question ("Use the natural voice? Only the sentence text is sent to ElevenLabs"), and it stays off unless she says yes **and** a key is set. She can turn it off in Settings at any time. Only the text to speak is sent, never her data. |
| IV. Patient, Trustworthy Partner | ✅ PASS | Idioms come from the curated `content/idioms.json`, which holds meaning, usage note, register, region and literal-vs-figurative notes. Tips must name real problem words, or validation rejects them. Grading explains *why* and gives a corrected version. Native-language explanations are deferred by the spec ("not used in v1"); this is a documented deferral, not a violation. |
| V. Weekend-Sized Simplicity | ✅ PASS (with justified exception) | One Next.js app, raw SQL, built-in SQLite, an inline-SVG chart and no auth library. The second runtime (Python) is justified below. Setup is `uv sync`, `npm i`, `npm run setup`, `npm run dev`. |
| Tech constraints | ⚠️ JUSTIFIED EXCEPTION | Default model is 4.6B Q4 (≤ 8B). `gemma4:26b` is listed only as an optional upgrade. Cost is $0 (ElevenLabs uses the free tier or sponsor credit). The README will list the models, their licenses and the runtimes. **Exception**: ElevenLabs is an optional cloud component that is not open-weight, against the clause "optional cloud components must use open-weight models". This is outside Principles I/III, so it does not block shipping, and it is justified in Complexity Tracking. |
| Workflow | ✅ PASS | Offline smoke checks are defined in the quickstart, and there is a networking-off run before submission. |

**Gate result (pre-research)**: PASS. Principles I–V are met. There are two justified
exceptions (the non-open-weight optional TTS under Tech constraints, and the second runtime
under V), both in Complexity Tracking.
**Gate result (post-design, re-checked after Phase 1)**: PASS. The contracts keep ElevenLabs
behind `profile.externalVoiceEnabled && ELEVENLABS_API_KEY` (opt-in, default off). The STT contract is localhost-only.
No new dependencies were added in design.

## Project Structure

### Documentation (this feature)

```text
specs/001-idioms-daily-practice/
├── plan.md              # This file
├── research.md          # Phase 0: decisions + spike results
├── data-model.md        # Phase 1: entities, tables, state machine
├── quickstart.md        # Phase 1: setup + validation scenarios
├── contracts/
│   ├── http-api.md      # Next.js route handlers (UI ↔ server)
│   ├── stt-service.md   # Python sidecar (server ↔ faster-whisper)
│   ├── tutor-llm.md     # Ollama prompts + JSON schemas + validators
│   └── content-config.md# idioms.json + settings.json schemas
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
app/                         # Next.js App Router
├── (auth)/login/page.tsx
├── session/page.tsx         # step-driven daily session UI
├── progress/page.tsx        # chart + streak
├── settings/page.tsx        # profile, voice toggle + privacy note
└── api/                     # route handlers (runtime = 'nodejs')
    ├── auth/{login,logout}/route.ts
    ├── session/today/route.ts
    ├── session/[id]/step/route.ts
    ├── attempts/route.ts
    ├── sentences/route.ts
    ├── audio/route.ts
    ├── progress/route.ts
    └── health/route.ts
components/                  # Recorder, PlayButton, ScoreCard, TipList, ProgressChart (SVG)
lib/
├── db.ts                    # node:sqlite connection + migrations
├── auth.ts                  # scrypt hashing, session cookie
├── config.ts                # loads config/settings.json + env
├── idioms.ts                # curated list, daily selection, variant matching
├── scoring/                 # normalize.ts, align.ts (WER), score.ts, problemWords.ts
├── tutor/                   # ollama.ts, examples.ts, tips.ts, grading.ts, validate.ts
├── stt.ts                   # client for the sidecar
├── tts.ts                   # ElevenLabs client + audio cache
└── progress.ts              # daily score, streak
content/idioms.json          # curated ~100 A2–B1 idioms (versioned)
prompts/                     # system.md, examples.md, tips.md, grading.md
config/settings.json         # model, thresholds, weights, personality, voice
scripts/                     # setup.ts (create DB + account), fetch-models.sh,
                             # warmup.ts (load Gemma at dev start), seed-days.ts and
                             # score-file.ts (dev-only: streak simulation, SC-004 repeatability)
stt/                         # Python sidecar (uv project)
├── pyproject.toml
├── app.py                   # FastAPI: /health, /transcribe
└── tests/test_smoke.py
tests/unit/                  # Vitest (pure logic + validators)
tests/tutor/                 # opt-in live-model checks (SC-005, SC-006) + fixtures
data/                        # gitignored: app.db, audio/
```

**Structure Decision**: One Next.js project at the repo root, plus the `stt/` Python
sidecar. A separate frontend/backend split is not needed for one user. All business logic
is in `lib/`, which keeps it unit-testable without the UI.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Proprietary, non-open-weight cloud TTS (ElevenLabs), against the Tech-Constraints clause "optional cloud components must use open-weight models" (Principle III itself is satisfied by the explicit opt-in) | The user accepted it in the spec as the one non-local piece, for natural American pronunciation, which is what she imitates. Only the text to speak is sent. It is off unless she opts in during setup or in Settings **and** a key is configured. The fallback is the on-device macOS voice, so the core loop never depends on it. | Local open TTS (e.g. Piper, Kokoro) would add a third runtime and model download for a weekend build, and its quality is lower for pronunciation modeling. It is listed as a future swap in research R5. The browser voice alone is the fallback, not the default, because its prosody is noticeably less natural. |
| Two runtimes (Node + Python sidecar), against Principle V's "simplest stack" | faster-whisper (CTranslate2) is the only practical local engine in the user's stack that gives **per-word probabilities**, and FR-010/011 need them for clarity and problem words. | whisper.cpp in Node bindings has weaker word-confidence support and needs native builds on Node 26. Spawning Python per request reloads the model (0.9–18 s), which breaks SC-003. |

---

description: "Task list for IdiomsMasterGirl – Daily Idiom Practice"
---

# Tasks: IdiomsMasterGirl – Daily Idiom Practice

**Input**: Design documents from `/specs/001-idioms-daily-practice/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: The spec does not ask for TDD. The constitution, though, requires a smoke-level
check for every core feature that works offline, and plan.md and quickstart.md define the
Vitest and pytest suites. So the test tasks below cover pure logic, validators and the
sidecar smoke test. They are not written test-first.

**Organization**: Tasks are grouped by user story (US1–US5 from spec.md), so each story can
be built and checked on its own.

**Secrets**: `ELEVENLABS_API_KEY` is already in `.env.local`. That file is gitignored, has
mode 600, and the key was checked with a TTS call on 2026-10-03. **Never** copy the key into
code, docs, `config/settings.json`, test fixtures or logs. The key only has text-to-speech
permission (`voices_read` and `user_read` return 401), so the code must not call
`/v1/voices` or `/v1/user`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1–US5)
- Paths are relative to the repo root (`idiom-expert-girl/`). This is one Next.js project
  at the root plus a `stt/` Python sidecar (see plan.md → Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling.

- [X] T001 Initialize the Next.js 16 + React 19 + TypeScript (strict) project at the repo root.
  - Create `package.json` with `"engines": {"node": ">=26"}`, `.nvmrc` containing `26`, `tsconfig.json` (path alias `@/*` → `./*`) and `next.config.ts`. Add `serverExternalPackages: []` as a placeholder for research R6.
  - Create `app/layout.tsx` and `app/globals.css` using a **system font stack only**. Do not use `next/font/google` or any CDN asset (research R13).
  - Add the dev dependencies `typescript`, `@types/node`, `@types/react`, `vitest`, `tsx` and `concurrently`.
- [X] T002 [P] Create the Python sidecar project in `stt/pyproject.toml`, managed by `uv`.
  - Pin `requires-python = ">=3.12,<3.13"`.
  - Dependencies: `faster-whisper~=1.2`, `av<17` (PyAV 19 breaks `decode_audio`, see research R2), `fastapi`, `uvicorn`, `python-multipart`.
  - Dev dependency: `pytest`, `httpx`.
  - Run `uv sync --project stt` to create `stt/.venv`.
- [X] T003 [P] Create `vitest.config.ts`.
  - Environment `node`, include `tests/unit/**/*.test.ts`, exclude `tests/tutor/**`.
  - Add the npm scripts `"test": "vitest run"` and `"test:tutor": "vitest run --dir tests/tutor"` to `package.json`.
- [X] T004 [P] Create `config/settings.json` exactly as in `contracts/content-config.md`, with these values:
  - `voice.external.voiceId` = `"21m00Tcm4TlvDq8ikWAM"` (Rachel, American English, verified working with the key);
  - `modelId` = `"eleven_flash_v2_5"`;
  - `llm.keepAlive` = `-1`.
  - Add **no** on/off flag for the external voice; that switch lives in the learner profile (research R14).
- [X] T005 [P] Create `.env.example` containing `ELEVENLABS_API_KEY=` (empty).
  - Confirm `.gitignore` contains `.env*.local`, `.env`, `data/`, `node_modules/`, `.next/`, `stt/.venv/` and `__pycache__/`. It already exists; add any missing lines.
- [X] T006 [P] Write the tutor prompt templates in `prompts/`. Use `{{var}}` placeholders only, and keep all text simple, warm English. Follow `contracts/tutor-llm.md`.
  - `prompts/system.md`: tutor persona with `{{personality}}`, `{{level}}` and `{{difficultyLabel}}`.
  - `prompts/examples.md`: inputs `{{phrase}}`, `{{spoken}}`, `{{meaning}}`, `{{whenToUse}}`, `{{literalNote}}`, `{{sampleExample}}`. Ask for 3 figurative examples of at most 15 words each, using everyday A2 vocabulary.
  - `prompts/tips.md`: inputs `{{target}}`, `{{transcript}}`, `{{problemWords}}`, `{{phase}}`. Ask for one physical coaching hint of at most 20 words for each word, as `{hints:[{word,hint}]}`, with no other idioms.
  - `prompts/grading.md`: inputs `{{phrase}}`, `{{meaning}}`, `{{sentence}}`, `{{level}}`. Ask for minimal changes that keep her meaning and explain *why* in at most 40 words.
  - `prompts/praise.md`: 12 short positive lines, one per line.
- [X] T007 Add the npm scripts to `package.json`. *(Uses `--kill-others-on-fail`, because `-k` stopped all servers when the warm-up script exited.)* `predev` must not block if Ollama is down.
  - `"dev"`: `concurrently -n stt,web "HF_HUB_OFFLINE=1 STT_MODEL=small.en uv run --project stt uvicorn app:app --app-dir stt --host 127.0.0.1 --port 8765" "next dev -H 127.0.0.1 -p 3000" "tsx scripts/warmup.ts"`
  - `"setup": "tsx scripts/setup.ts"`
  - `"seed:days": "tsx scripts/seed-days.ts"`
  - `"score:file": "tsx scripts/score-file.ts"`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, DB, auth, tutor client, curated content and the step machine, which
every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Implement `lib/config.ts`.
  - `getSettings()` reads and parses `config/settings.json` **on every call**, so edits apply without a restart (FR-023).
  - Validate it: `accuracyWeight + clarityWeight === 1` (±0.001), `0 < lowConfidenceThreshold < 1`, `noRepeatDays >= 1`. On failure, throw a clear error.
  - `getElevenLabsKey()` returns `process.env.ELEVENLABS_API_KEY ?? null`. Never log it.
- [X] T009 Implement `lib/db.ts` using `DatabaseSync` from `node:sqlite`.
  - The database file is `data/app.db`; create `data/` and `data/audio/` if missing. Enable `PRAGMA foreign_keys=ON`.
  - Keep migrations as an ordered array tracked through `PRAGMA user_version`.
  - Create every table in `data-model.md` with these constraints, quoted verbatim:
    - `learners`: username "3–32 chars, `[a-z0-9_.-]`, stored lowercase" UNIQUE; email UNIQUE "stored lowercase"; password_hash "`scrypt$<saltHex>$<hashHex>`"; level DEFAULT 'A2' "One of `A1, A2, B1, B2`"; difficulty_min/max DEFAULT 1/2 "min ≤ max"; voice_pref DEFAULT 'en-US'; external_voice_enabled "INTEGER NOT NULL DEFAULT 0".
    - `auth_sessions`: token_hash PK "sha256 of the cookie token"; expires "created + 365 days".
    - `daily_sessions`: "UNIQUE(learner_id, date)"; examples_json "TEXT NULL … NULL while pending"; examples_source `llm`|`curated_fallback`; step DEFAULT 'learn'; score columns "INTEGER NULL" 0–100; last_activity_at NOT NULL; completed_at NULL.
    - `practice_items`: kind `idiom`|`example`|`corrected`; "UNIQUE(session_id, kind, position)"; audio_key NULL FK → audio_clips.
    - `speaking_attempts`: phase `try1`|`try2`|`read`; status `scored`|`rejected`; reject_reason `too_short`|`no_speech`|`unreadable`; counted DEFAULT 0, with "exactly one counted scored attempt per (item, phase)".
    - `written_sentences`: position 1–3 "UNIQUE(session_id, position)"; status `pending`|`graded`|`could_not_grade`.
    - `audio_clips`: key PK.
  - Use CHECK constraints for the enums and ranges.
  - Export `getDb()` as a singleton.
- [X] T010 Verify that `node:sqlite` works inside a Next 16 route handler (research R6: only verified in plain Node so far).
  - Create a temporary `app/api/health/route.ts` with `export const runtime = 'nodejs'` that runs `SELECT 1` through `getDb()`.
  - Run `next dev` and `next build`, then call the route.
  - If the bundler fails to resolve `node:sqlite`, add `"node:sqlite"` to `serverExternalPackages` in `next.config.ts`.
  - If it still fails, switch `lib/db.ts` to `better-sqlite3`, which has the same synchronous API.
  - Record the outcome in a comment at the top of `lib/db.ts`.
- [X] T011 [P] Implement `lib/dates.ts`.
  - `localDate(d = new Date())` returns `YYYY-MM-DD` in the laptop's local timezone.
  - `addDays(date, n)` and `daysBetween(a, b)` work on date strings (no UTC drift).
- [X] T012 [P] Implement `lib/auth.ts` (research R7).
  - `hashPassword` / `verifyPassword` use `crypto.scrypt`, a 16-byte random salt, the `scrypt$<saltHex>$<hashHex>` format and `timingSafeEqual`.
  - `createSession(learnerId)` makes a 32 random byte token, stores its sha256 in `auth_sessions` with expiry +365 days, and sets the `session` cookie (`HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`).
  - `destroySession()`.
  - `requireLearner(req)` returns the learner or throws a 401 `{error:"unauthorized"}`.
  - `findLearnerByIdentifier(identifier)` matches username OR email, case-insensitive.
- [X] T013 Implement `app/api/auth/login/route.ts` and `app/api/auth/logout/route.ts` per `contracts/http-api.md`.
  - Login always returns `401 {"error":"bad_credentials","message":"Username/email or password is not right."}` on any failure; the response is identical whichever field was wrong.
  - Logout returns `204`.
  - Both use `runtime = 'nodejs'`.
- [X] T014 Implement the sign-in UI and route protection. *(Done as `proxy.ts`: Next 16 renamed `middleware.ts`.)*
  - `app/(auth)/login/page.tsx` has one "Username or email" field, a password field and a submit button, and redirects to `/session` on success.
  - `middleware.ts` redirects requests without a `session` cookie to `/login`. It skips `/login`, `/api/auth/login`, `/api/health` and static assets.
- [X] T015 [P] Implement `lib/prompts.ts`.
  - `renderPrompt(name, vars)` loads `prompts/<name>.md` and replaces `{{key}}`.
  - It throws if a placeholder has no value or an unknown placeholder remains.
  - `loadPraiseLines()` returns the non-empty lines of `prompts/praise.md`.
- [X] T016 [P] Implement `lib/tutor/ollama.ts`, the shared tutor client.
  - `chatJson<T>({system, user, schema, validate})` posts to `${llm.baseUrl}/api/chat` with `stream:false`, `think:false`, `keep_alive: llm.keepAlive`, `options.temperature`, `format: schema` and an `AbortController` timeout of `llm.timeoutMs`.
  - It parses the JSON and calls `validate` (which returns `{ok, value}` or `{ok:false, reason}`). On failure it retries **once**, appending "Your last answer broke this rule: <reason>. Follow the JSON schema exactly." Then it throws `TutorInvalidError`.
  - Throw `TutorOfflineError` on connection refused or timeout.
  - Add `pingOllama()` for health checks.
- [X] T017 [P] Implement `lib/idioms.ts`.
  - Load `content/idioms.json` once and validate it against the rules in `contracts/content-config.md`.
  - Export `getIdiom(id)`, `listIdioms()` and `matchesIdiom(idiom, text)`. `matchesIdiom` tests each `variants[]` regex case-insensitively, after normalizing curly quotes to straight quotes.
- [X] T018 Create `content/idioms.json` with **100** curated, common American idioms (`"version": "1.0.0"`). Follow the schema in `contracts/content-config.md`.
  - Content mix: about 60 entries with `level: "A2"` and `difficulty: 1`, and about 40 with `level: "B1"` and `difficulty: 2`. Use only well-known everyday idioms (e.g. piece of cake, break the ice, hit the books, under the weather, cost an arm and a leg, call it a day).
  - Fields per entry:
    - `spoken`: a concrete form with no placeholders, e.g. "break her heart" for "break someone's heart".
    - `variants`: word-bounded regexes that cover the verb forms. Write placeholders as `\b\w+(?:'s)?\b`.
    - `meaning`: at most 20 words.
    - `whenToUse`: at most 25 words.
    - `register`, `region`, `literalNote`.
    - `fallbackExamples`: exactly 3 human-quality figurative examples of at most 15 words each.
- [X] T019 [P] Write `tests/unit/idioms.test.ts`, which checks the integrity of `content/idioms.json`:
  - unique kebab-case ids;
  - `level ∈ {A2,B1}` and `difficulty ∈ {1,2,3}`;
  - every variant compiles;
  - `spoken` and every fallback example match a variant;
  - exactly 3 fallbacks, each ≤ 15 words;
  - `meaning` ≤ 20 words and `whenToUse` ≤ 25 words;
  - `matchesIdiom` accepts "She broke the ice" and rejects "The ice broke".
- [X] T020 [P] Implement `lib/steps.ts`, the session state machine from `data-model.md`.
  - The order is `learn → speak_try1 → speak_try2 → write → read_aloud → done`.
  - `canAdvance(session, to)` only allows moving forward by exactly one step, with these guards:
    - learn → speak_try1 needs `examples_json` set;
    - speak_try1 → speak_try2 needs 4 counted `try1` attempts;
    - speak_try2 → write needs 4 counted `try2` attempts;
    - write → read_aloud needs 3 sentences with `status = graded`;
    - read_aloud → done needs 3 counted `read` attempts.
  - It returns a friendly message on failure, e.g. "Please finish all 4 recordings first."
- [X] T021 [P] Write `tests/unit/steps.test.ts` covering every guard and the rejection of skipping or going backward.
- [X] T022 Implement `app/api/session/[id]/step/route.ts` per the contract.
  - It checks that the session belongs to the learner, calls `canAdvance`, updates `step` and `last_activity_at`, and returns the session payload (it can use `lib/session.ts` `toPayload()` once T025 exists).
  - On failure it returns `409 {"error":"step_guard", message}`.
  - Leave a `// on 'done': computeDailyScore` hook point for T057.
- [X] T023 Implement the app shell.
  - `app/layout.tsx` has a header nav (Today `/session`, Progress `/progress`, Settings `/settings`, Sign out).
  - `app/globals.css` defines color tokens on `:root` with a dark-mode variant, a 16px side gutter, and a layout that works at phone width.
  - `components/StatusBanner.tsx` shows the friendly banners "Tutor is offline – start Ollama and press retry" and "Listening helper is not running" from `/api/health`.
- [X] T024 Implement the full `app/api/health/route.ts` (no auth), replacing T010's stub.
  - It returns `{ollama:"up"|"down", model, stt:"up"|"down", externalVoice:"on"|"off"|"unreachable"}`.
  - `externalVoice` is `"off"` if there is no key or the profile switch is off. It is `"unreachable"` if a HEAD/GET to `https://api.elevenlabs.io` fails within 2 s.
  - Add `scripts/warmup.ts`: wait up to 60 s for Ollama, then send one tiny `/api/chat` with `keep_alive: -1` so Gemma is loaded (research R1). Exit 0 even if Ollama is down.

**Checkpoint**: Sign-in works, the DB and config load, the tutor client and idiom list are
ready, and the step machine is tested.

---

## Phase 3: User Story 1 – Learn today's idiom (Priority: P1) 🎯 MVP

**Goal**: After signing in, Eugenia sees one A2-level idiom a day with its meaning, a "when to
use it" note, 3 examples and play buttons in an American voice, with cached replays.

**Independent Test**: Sign in, open `/session` and check one idiom with its meaning, usage
note and 3 examples (each ≤ 15 words). Reload and see the same content. Press play twice:
the second play starts in ≤ 1 s and `data/audio/` contains the mp3. These are quickstart
scenarios 1–4.

- [X] T025 [US1] Implement `lib/session.ts`. *(Level filter allows the learner's level plus one above, so an A2 learner gets A2–B1 idioms as the spec describes; "≤ her level" would have excluded all 40 B1 idioms.)*
  - `selectIdiom(learner, date)` (research R8):
    - keep idioms with `level` ≤ the learner's level and `difficulty` within `[difficulty_min, difficulty_max]`;
    - exclude idioms shown in the last `noRepeatDays` (from `MAX(date) FROM daily_sessions`);
    - pick with a PRNG seeded from the date string (e.g. mulberry32 of an FNV hash);
    - if none are eligible, pick the idiom with the oldest last-shown date.
  - `getOrCreateTodaySession(learner)` applies the **midnight rule**: if the latest session is incomplete, dated yesterday, and has `last_activity_at` within 3 h, return it. Otherwise get or create the session for `localDate()` and insert the `idiom` practice item (position 0, text = `spoken`).
  - `toPayload(session)` builds the `GET /session/today` response shape from `contracts/http-api.md`, including `examplesStatus`, items with `hasAudio`, attempts grouped by item and phase, sentences, scores and `tutorOnline`.
- [X] T026 [P] [US1] Write `tests/unit/selection.test.ts` using an in-memory DB.
  - The same date gives the same idiom.
  - An idiom shown 59 days ago is excluded, and one shown 61 days ago is allowed.
  - When every idiom is used, the oldest is reused.
  - The level and difficulty filter is respected.
  - Midnight rule: a session from yesterday active 2 h ago is returned; one active 5 h ago gives a new session.
- [X] T027 [US1] Implement `lib/tutor/examples.ts`.
  - `generateExamples(idiom, learner)` calls `chatJson` with the schema from `contracts/tutor-llm.md` §1.
  - Validate: exactly 3, unique, each ≤ `exampleMaxWords` (15) words, each `matchesIdiom`.
  - On `TutorOfflineError` or `TutorInvalidError`, return `{examples: idiom.fallbackExamples, source: "curated_fallback"}`.
- [X] T028 [US1] Implement `app/api/session/today/route.ts` (GET) and `app/api/session/[id]/examples/route.ts` (POST).
  - `today` returns immediately with curated content, and with `examplesStatus:"pending"` when `examples_json` is NULL.
  - `examples` is idempotent and keeps a module-level `Map<sessionId, Promise>` so concurrent calls share one generation. It stores `examples_json` and `examples_source`, inserts 3 `example` practice items (positions 1–3), and returns the payload.
  - Both use `runtime = 'nodejs'` and `requireLearner`.
- [X] T029 [US1] Implement `lib/tts.ts` (research R5).
  - `audioKey(provider, voiceId, modelId, text)` is the sha256 of `provider|voiceId|modelId|normalizedText`, where normalizedText is trimmed and whitespace-collapsed.
  - `getOrCreateClip(item)`:
    - return the cached file from `audio_clips` if present;
    - otherwise POST `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128` with the `xi-api-key` header and the body `{text, model_id}`, using an 8 s timeout;
    - write `data/audio/<key>.mp3`, insert the `audio_clips` row and set `practice_items.audio_key`;
    - deduplicate concurrent requests with a `Map<key, Promise>`.
  - `isExternalVoiceActive(learner)` returns `learner.external_voice_enabled === 1 && getElevenLabsKey() !== null`.
  - Only `practice_items.text` may ever be sent, never client text.
- [X] T030 [US1] Implement `app/api/audio/route.ts` (`GET ?itemId=`).
  - Check that the item belongs to the learner.
  - If a cached clip exists, stream it as `200 audio/mpeg` with `Cache-Control: private, max-age=31536000, immutable`, even when the external voice is off or the laptop is offline.
  - Otherwise, if the external voice is active, generate the clip and stream it.
  - Otherwise, or on any ElevenLabs error or timeout, return `204` with `X-Voice-Fallback: local`.
- [X] T031 [P] [US1] Implement `components/PlayButton.tsx` (client), taking `itemId` and `text`.
  - Fetch `/api/audio?itemId=`. On 200, play the blob through an `Audio` element and keep the object URL for instant replay.
  - On 204, use `speechSynthesis` with **only** voices where `localService === true` and `lang === "en-US"`, preferring `voice.localFallback.preferredName` ("Samantha"). **Never** use the network "Google US English" voices.
  - If no local voice is available, show a disabled "audio unavailable" state.
  - Show loading and playing states, with an accessible label "Play: <text>".
- [X] T032 [US1] Implement `app/session/page.tsx` and `components/LearnStep.tsx`.
  - The page loads `GET /api/session/today`. If `examplesStatus === "pending"`, it shows a skeleton and calls `POST /api/session/{id}/examples`.
  - `LearnStep` shows the phrase (large) with a PlayButton, the meaning, the "When to use it" note, register/region chips and the literal note, then the 3 examples, each with a PlayButton.
  - Show `StatusBanner` when `tutorOnline` is false, with the label "Examples from our idiom book".
  - A "Start speaking" button POSTs the step `speak_try1`.
  - The page renders the component for the stored `step`, so resume works (FR-022).
- [X] T033 [US1] Implement `app/api/settings/route.ts` (GET/PATCH) and `app/settings/page.tsx`.
  - Fields: `displayName`, `level` (A1–B2), `difficultyMin`/`difficultyMax` ("min ≤ max", 1–3) and the toggle `externalVoiceEnabled`.
  - GET also returns `externalVoiceAvailable` (key present) and the `voice.privacyNote` text, which is shown under the toggle (FR-025).
  - The toggle is disabled with the hint "No ElevenLabs key configured" when no key is present.
- [X] T034 [US1] Implement `scripts/setup.ts` (`npm run setup`) and `scripts/fetch-models.sh` (research R15). Setup does the following, in order:
  1. checks `node --version` ≥ 26;
  2. checks that Ollama is reachable, and runs `ollama pull <llm.model>` if the model is missing from `ollama list`;
  3. runs `uv sync --project stt`;
  4. runs `fetch-models.sh`, which pre-downloads the Whisper model with `uv run --project stt python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')"`;
  5. runs the DB migrations;
  6. if no learner exists, prompts for display name, username, email and password (asked twice, hidden input) and inserts the learner;
  7. asks "Use the natural ElevenLabs voice? Only the sentence text is sent to ElevenLabs. (y/N)" and stores `external_voice_enabled`. If there is no key in `.env.local`, it says so and stores 0.

**Checkpoint**: US1 is fully usable on its own. This is the MVP.

---

## Phase 4: User Story 2 – Speak and improve (tries 1 and 2) (Priority: P1)

**Goal**: She records the idiom and 3 examples twice. Each recording gets accuracy, clarity,
a combined score, problem words and warm tips that name real words. Try 2 shows the change
from try 1.

**Independent Test**: Quickstart scenarios 5–8. Say "cape" for "cake" and get tips naming
both words. A clean take gets praise and no tips. A 0.3 s take is rejected. Try 2 shows
"+N points". `npm run score:file` gives the same score twice.

- [X] T035 [P] [US2] Implement the sidecar `stt/app.py` per `contracts/stt-service.md`.
  - At startup, load `WhisperModel(os.environ.get("STT_MODEL","small.en"), device="cpu", compute_type="int8")` once. `/health` returns `503` while loading, then `{"status":"ok","model",...}`.
  - `POST /transcribe` takes `audio` (multipart; return 413 if over 2 MB). It decodes the audio from a BytesIO in memory, **with no disk write and no logging of the audio**.
  - Call `model.transcribe(..., language="en", temperature=0.0, beam_size=5, condition_on_previous_text=False, word_timestamps=True, vad_filter=True)`.
  - Return `{text, words:[{word(stripped), start, end, probability(3 dp)}], speechSeconds: info.duration_after_vad, durationSeconds: info.duration}`.
  - Return `400 {"error":"unreadable"}` on a decode error.
- [X] T036 [P] [US2] Create the sidecar smoke test.
  - `stt/tests/make_fixture.py` uses macOS `say -v Samantha` and PyAV to produce `stt/tests/fixtures/clip.webm` (libopus, 48 kHz) of "Finishing the homework was a piece of cake for me." Commit the generated fixture.
  - `stt/tests/test_smoke.py` uses FastAPI's TestClient to check:
    - `/health` is ok;
    - transcribing the fixture returns ≥ 9 words, including "cake" with probability > 0.6;
    - `speechSeconds` > 0.5;
    - two runs give identical words and probabilities (SC-004);
    - garbage bytes give 400.
- [X] T037 [P] [US2] Implement `lib/scoring/normalize.ts` (research R3 step 1).
  - Steps: lowercase, NFKC, curly → straight quotes, expand contractions (`it's→it is`, `i'm→i am`, `don't→do not`, `can't→cannot`, `won't→will not`, `n't→ not`, `'re→ are`, `'ll→ will`, `'ve→ have`, `'d→ would`), hyphens → spaces, strip other punctuation, digits 0–20 → words, collapse whitespace.
  - Export `normalizeWords(text): string[]`.
- [X] T038 [P] [US2] Implement `lib/scoring/align.ts`.
  - Word-level Levenshtein (substitution, insertion and deletion each cost 1) with a backtrace.
  - It returns the operations: target words labeled `ok | substituted(heard) | missing`, extra words labeled `inserted`, and `{S, D, I, N}`.
- [X] T039 [US2] Implement `lib/scoring/score.ts` and `lib/scoring/problemWords.ts`.
  - `scoreAttempt(target, sttWords, settings)` maps STT words to normalized tokens, keeping each word's probability, then aligns them. It computes:
    - accuracy = `round(100 × max(0, 1 − (S+D+I)/N))`;
    - clarity = `round(100 × mean(prob))` (0 if there are no words);
    - combined = `round(w_acc·accuracy + w_clar·clarity)`.
  - It returns `{accuracy, clarity, combined, problemWords}`. Problem words are the `missing` and `substituted` target words (with `heard`) plus aligned `ok` words with probability < `lowConfidenceThreshold`, labeled `unclear`. They are deduplicated and kept in sentence order.
- [X] T040 [P] [US2] Write `tests/unit/scoring.test.ts`.
  - A perfect match gives 100/100 accuracy and clarity equal to the mean probability.
  - "cape" for "cake" gives one substituted word with `heard:"cape"`.
  - A missing word is labeled missing.
  - Contractions ("it's" vs "it is") and punctuation do not count as errors.
  - A word with probability 0.4 is labeled unclear.
  - The 70/30 weighting is applied.
  - Insertions lower accuracy, but never below 0.
  - The same input always gives the same output.
- [X] T041 [P] [US2] Implement `lib/stt.ts`.
  - `transcribe(blob)` POSTs multipart to `${stt.baseUrl}/transcribe` with a 15 s timeout.
  - It maps connection failure to `SttOfflineError` and a 400 response to `{rejected:"unreadable"}`.
  - Add `pingStt()`.
- [X] T042 [US2] Implement `lib/tutor/tips.ts` (research R4, `contracts/tutor-llm.md` §2).
  - With no problem words, return one random praise line (`feedbackSource:"praise"`, tips `[]` plus the praise message).
  - Otherwise take the first 3 problem words and call `chatJson` with the hints schema. Validate: each `word` is in the sent list, each hint is non-empty and ≤ 20 words, one hint per word.
  - Compose each tip as lead + " " + hint, with these code-written leads:
    - substituted: `I heard “{heard}” for “{word}”.`
    - missing: `I didn't hear “{word}”.`
    - unclear: `“{word}” was a little unclear.`
  - If a hint is missing or invalid after the retry, or the tutor is offline, use the fixed hint `Say it slowly: {word}.`.
  - `feedbackSource` is `"llm"` only if every hint came from the model; otherwise `"template"`.
- [X] T043 [P] [US2] Write `tests/unit/tips.test.ts` with `chatJson` mocked.
  - Every composed tip contains its problem word.
  - Zero problem words means no LLM call and the praise source.
  - An invalid hint (wrong word, over 20 words) falls back to the template.
  - Offline gives `feedbackSource:"template"`.
  - There are never more than 3 tips.
- [X] T044 [US2] Implement `app/api/attempts/route.ts` (POST multipart: `itemId`, `phase`, `audio`), per `contracts/http-api.md`.
  - Check ownership. The phase must be valid for the item kind: `try1`/`try2` only for `idiom`/`example`, and `read` only for `corrected`. Otherwise return 400. Reject audio over 2 MB.
  - Call `transcribe`. If `speechSeconds < stt.minSpeechSeconds` (0.5), there are no words, or the audio is unreadable, insert a `rejected` attempt (`counted=0`) and return `422 recording_rejected` with the kind message.
  - Otherwise score the attempt, build the tips, and in one transaction set `counted=0` on any earlier counted attempt for (item, phase) and insert the new attempt with `counted=1`.
  - For `try2`, include `previous:{phase:"try1", combined, delta}`.
  - Update `last_activity_at` and recompute `speak_try1_score`/`speak_try2_score`/`read_score` as the rounded mean of the counted attempts for that phase.
  - Map `SttOfflineError` to `503 stt_offline`.
  - **Never write the audio to disk.**
- [X] T045 [P] [US2] Implement `components/Recorder.tsx` (client).
  - Request mic access with `getUserMedia({audio:true})`. If permission is denied, show help text: "Click the lock icon next to the address bar → Microphone → Allow, then reload".
  - Record with `MediaRecorder` using `audio/webm;codecs=opus`, with a Record/Stop toggle, an elapsed-time display and an automatic stop at 30 s.
  - Allow playback of the take and **Re-record** before **Submit** (FR-009).
  - `onSubmit(blob)` reports a busy state.
- [X] T046 [P] [US2] Implement `components/ScoreCard.tsx` and `components/TipList.tsx`.
  - `ScoreCard` shows combined (large), accuracy and clarity (0–100), plus an optional delta badge ("+12 points" or "−3 points").
  - It shows the problem words as chips (missing, substituted "cake → cape", unclear).
  - `TipList` shows 1–3 tips, or the praise line. A `template` source gets a subtle "quick tip" label.
- [X] T047 [US2] Implement `components/SpeakStep.tsx` and wire it into `app/session/page.tsx` for steps `speak_try1` and `speak_try2`.
  - Show one card per item (the idiom and the 3 examples): the text, a PlayButton, the Recorder, and the ScoreCard + TipList after scoring. On 422, show the kind retry message.
  - In try 2, show the try-1 score next to each item and the overall try-1 → try-2 change.
  - The "Next" button POSTs the step transition and is enabled only when all 4 items have a counted attempt.
  - On 503, show `StatusBanner` and keep Learn reachable.
- [X] T048 [US2] Implement `scripts/score-file.ts` (`npm run score:file -- <audioPath> "<target>"`).
  - It sends the file to the running sidecar, runs `scoreAttempt` and prints the JSON scores and problem words.
  - It is used for the SC-004 repeatability check in quickstart scenario 8.

**Checkpoint**: US1 + US2 together make the full P1 speaking loop.

---

## Phase 5: User Story 3 – Write my own sentences (Priority: P2)

**Goal**: She writes 3 sentences with the idiom and gets usage and grammar grades, a
corrected version and a short, friendly explanation.

**Independent Test**: Quickstart scenarios 9–10. An empty sentence or one without the
idiom is blocked before grading. A correct sentence comes back unchanged and labeled
correct. Grammar and usage errors are fixed with an explanation.

- [X] T049 [US3] Implement `lib/tutor/grading.ts` (research R10, `contracts/tutor-llm.md` §3).
  - `gradeSentence(idiom, sentence, learner)` calls `chatJson` with the grading schema.
  - **Coerce first**: if `isCorrect`, set `corrected = sentence`; if `corrected.trim() === sentence.trim()`, set `isCorrect = true`; clamp the grades to 0–100 and round them.
  - Then validate: all fields are present, `corrected` passes `matchesIdiom`, and `explanation` is non-empty and ≤ 40 words.
  - Return `{status:"graded", usageGrade, grammarGrade, grade: round((usage+grammar)/2), corrected, isCorrect, explanation}`, or `{status:"could_not_grade"}` on `TutorInvalidError`/`TutorOfflineError`. Never return an invented grade.
- [X] T050 [P] [US3] Write `tests/unit/grading.test.ts` with `chatJson` mocked.
  - The coercion rules work both ways.
  - A grade of 140 is clamped to 100.
  - A `corrected` value without the idiom gives `could_not_grade`.
  - An explanation over 40 words gives `could_not_grade`.
  - Offline gives `could_not_grade`.
  - The grade is the rounded mean.
- [X] T051 [US3] Implement `app/api/sentences/route.ts` (POST) and `app/api/sentences/[id]/regrade/route.ts` (POST).
  - **Validate before grading** (FR-015):
    - empty positions → `400 {"error":"missing_sentences","positions":[…]}`;
    - sentences without the idiom (`matchesIdiom`) → `400 {"error":"idiom_missing","positions":[…],"message":"Sentence N doesn't use \"<phrase>\" yet – try adding it!"}`.
  - Upsert `written_sentences` (positions 1–3). Skip regrading positions whose text is unchanged and already graded.
  - Grade the sentences in sequence. For each graded sentence, upsert a `corrected` practice item (position = sentence position, text = corrected) and return its `itemId`.
  - Set `write_score` to the mean of the 3 grades **only when all 3 are graded**; otherwise it is null.
  - `regrade` re-runs one `could_not_grade` sentence and returns `503 tutor_offline` when Ollama is down.
  - Update `last_activity_at`.
- [X] T052 [US3] Implement `components/WriteStep.tsx` and wire it for step `write`.
  - Show today's idiom as a reminder, 3 textareas, and inline messages for `missing_sentences` and `idiom_missing`, keeping her text for editing.
  - After grading, each sentence shows usage and grammar grades, her original vs. the corrected version (changed words highlighted), a "Correct! 🎉" label when `isCorrect`, and the explanation. A `could_not_grade` sentence shows "Could not grade, try again" with a Retry button.
  - "Next" (→ `read_aloud`) is enabled only when all 3 are graded.

**Checkpoint**: US3 works on its own after US1 (it needs today's idiom).

---

## Phase 6: User Story 4 – Read my corrected sentences aloud (Priority: P2)

**Goal**: She plays each corrected sentence in the American voice, records herself reading
it, and gets the same scoring and tips as in Speak.

**Independent Test**: Quickstart scenario 11. With 3 corrected sentences, each one plays and
each recording is scored with tips.

- [X] T053 [US4] Implement `components/ReadAloudStep.tsx` and wire it for step `read_aloud`.
  - Show one card per `corrected` practice item (positions 1–3): the text, a PlayButton (it reuses `/api/audio`; the clip is generated on the first play and cached), the Recorder, and ScoreCard + TipList from `POST /api/attempts` with `phase:"read"`.
  - "Finish" POSTs `to:"done"` and is enabled only when all 3 items have a counted `read` attempt.
- [X] T054 [US4] Add a test case to `tests/unit/steps.test.ts`: `read_aloud → done` is blocked with 2 counted `read` attempts and allowed with 3. Also check that a `read` attempt on an `example` item is rejected by the phase/kind rule used in `app/api/attempts/route.ts` (extract that rule to `lib/steps.ts` `isPhaseAllowed(kind, phase)`).

**Checkpoint**: All 5 practice steps work end to end.

---

## Phase 7: User Story 5 – Daily score, progress and streak (Priority: P3)

**Goal**: A summary with the daily score and each part, a 30-day chart, a streak that
counts consecutive completed days, and resuming mid-session.

**Independent Test**: Quickstart scenarios 12–14. Finish a session and see the summary.
Seed past days with `npm run seed:days` and check that the streak and chart are right, and
that a gap resets the streak.

- [X] T055 [US5] Implement `lib/progress.ts`.
  - `computeDailyScore(session)` returns `round(mean(speak_try2_score, write_score, read_score))` (FR-018).
  - `computeStreak(learnerId, today)`: the number of consecutive dates with `completed_at` set, ending today, or ending yesterday if today is not completed. A gap resets the count (research R12).
  - `getSeries(learnerId, days=30)` returns one entry for each of the last `days` dates as `{date, daily|null}`.
  - `getToday(session)` returns `{speakTry1, speakTry2, improvement: speakTry2 − speakTry1, write, read, daily}`.
- [X] T056 [P] [US5] Write `tests/unit/progress.test.ts`.
  - Daily score = the rounded mean of the 3 parts.
  - The streak is 3 for 3 consecutive days ending today, and still 3 when today is not done but yesterday is.
  - A gap gives a streak of 1 after completing today.
  - An incomplete day does not count.
  - The series has 30 entries, with null for missing days.
- [X] T057 [US5] Fill in the `done` hook in `app/api/session/[id]/step/route.ts`: on the transition to `done`, set `daily_score = computeDailyScore(session)` and `completed_at = now` in one transaction.
- [X] T058 [US5] Implement `app/api/progress/route.ts` (`GET ?days=30`), returning `{streak, series, today}` per `contracts/http-api.md`.
- [X] T059 [P] [US5] Implement `components/ProgressChart.tsx`, an inline SVG line chart with no chart library.
  - The y axis runs 0–100 with gridlines at 0/50/100. The x axis shows the last 30 dates with sparse labels.
  - Missing days are gaps (the line breaks), and completed days are dots with a `<title>` tooltip showing the date and score.
  - It uses the CSS color tokens, works in light and dark mode, and is responsive (`viewBox` + `width:100%`).
- [X] T060 [US5] Implement `components/SummaryStep.tsx` (step `done` in `app/session/page.tsx`) and `app/progress/page.tsx`.
  - The summary shows the daily score (large), Speak try 1 → try 2 with the change, the Write score, the Read score, the streak ("🔥 4 days in a row") and a link to Progress.
  - The Progress page shows the streak and the `ProgressChart`.
- [X] T061 [US5] Implement `scripts/seed-days.ts`, a dev-only script that refuses to run when `NODE_ENV=production`.
  - `--completed 2026-09-30,2026-10-01` inserts completed sessions for those dates, with a random idiom and plausible scores.
  - `--clear-today` deletes today's session and its child rows, for testing the offline fallback in quickstart scenario 15.

**Checkpoint**: All user stories are complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance, quality checks and submission readiness.

- [X] T062 [P] Create the live-model checks in `tests/tutor/`. They are opt-in (`npm run test:tutor`) and need Ollama running.
  - `tests/tutor/fixtures/tips-cases.json`: 20 cases of `{target, transcript, problemWords}`.
  - `tests/tutor/fixtures/grading-cases.json`: 15 cases of `{phrase, sentence, expectedFix}`, mixing correct sentences, grammar errors and wrong idiom use.
  - `tests/tutor/tutor.test.ts` reports: the share of tips containing a problem word (target ≥ 18/20, SC-005); a check that no tip contains discouraging words (a deny-list such as "wrong", "bad", "terrible", "failed"); and the share of corrections that match `expectedFix` or keep the meaning while fixing the error (target ≥ 13/15, SC-006).
- [X] T063 [P] Write `README.md`, as the constitution requires.
  - Who it's for (Eugenia, A2 ESL in SF) and why.
  - Features (the 6-step daily loop).
  - Setup and run steps (`nvm use`, `npm install`, `npm run setup`, `npm run dev`).
  - Models and licenses: Gemma 4 E2B (Apache 2.0) via Ollama (MIT), Whisper `small.en` (MIT) via faster-whisper (MIT).
  - How to swap the model in `config/settings.json`.
  - The ElevenLabs opt-in and the privacy note: only the sentence text is sent, the key goes in `.env.local`, and the key needs text-to-speech permission only.
  - The "Why open innovation matters here" section: offline use, privacy of her mistakes, tuning the tutor to her, zero cost, and where open beat closed (local word confidence, a swappable model).
  - Known limitations: Whisper can autocorrect mispronunciations; a cold model start of about 13 s; mic access works on localhost only, not from a phone on the LAN.
- [X] T064 Privacy and network hardening review.
  - Confirm that no code path writes recordings to disk: grep `app/api/attempts` and `stt/app.py` for any file writes.
  - Confirm that both servers bind to `127.0.0.1`.
  - Confirm with `grep -r "fonts.googleapis\|next/font/google\|cdn" app components` that no CDN or `next/font/google` import exists.
  - Confirm that `ELEVENLABS_API_KEY` never appears in logs or API responses.
  - Confirm that `/api/audio` only ever sends `practice_items.text`.
- [X] T065 Run `npm test` and `uv run --project stt pytest`. Fix failures until both pass.
- [X] T066 Run quickstart.md manual scenarios 1–17 in Chrome and record the results (pass/fail with notes) in `specs/001-idioms-daily-practice/checklists/validation.md`. Include the SC-002 and SC-003 timings and the SC-004 `score:file` repeatability.
- [ ] T067 Do the **offline run** from quickstart.md (constitution, SC-009): turn Wi-Fi off, restart `npm run dev`, and complete a full session using cached clips and the local Samantha voice. Then turn the natural voice off in Settings and confirm in DevTools that there are no requests to `api.elevenlabs.io`. Record the results in `checklists/validation.md`.
- [X] T068 Time one full session against SC-001 (≤ 20 min) and record it in `checklists/validation.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** has no dependencies. T001 comes first; T002–T006 run in parallel; T007 comes after T001.
- **Foundational (Phase 2)** depends on Setup and blocks all stories.
  - T008 → T009 → T010 (sqlite-in-Next check) must come before any route.
  - T012 → T013 → T014.
  - T017 → T018 → T019.
  - T020 → T021; T022 depends on T020 and T009.
  - T024 depends on T016.
- **US1 (Phase 3)** depends on Foundational. Order: T025 → T028 → T032; T027 → T028; T029 → T030 → T031/T032; T033 and T034 come after T009/T012.
- **US2 (Phase 4)** depends on US1 (session, items and PlayButton). T035/T036 (Python) run in parallel with T037/T038 (TS scoring) → T039 → T040. T041 + T042 → T044 → T047. T045/T046 run in parallel before T047.
- **US3 (Phase 5)** depends on US1 (today's idiom), and on US2 only for the step order in the UI. T049 → T050, T051 → T052.
- **US4 (Phase 6)** depends on US2 (Recorder, attempts route, scoring) and US3 (corrected items).
- **US5 (Phase 7)** depends on US4 for completing sessions. T055 → T056/T057/T058 → T059/T060. T061 is independent.
- **Polish (Phase 8)** depends on all stories. T062–T064 run in parallel, then T065 → T066 → T067 → T068.

### User Story Dependencies

```text
Setup → Foundational → US1 (MVP) → US2 ─┬→ US4 → US5
                                  US1 → US3 ┘
```

US3 can be built in parallel with US2 once US1 is done. They touch different files, except
`app/session/page.tsx`, so wire that file last.

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005 and T006 together after T001.
- **Phase 2**: T011, T012, T015, T016, T017 and T020 together after T009/T010. T019 and T021 are tests that run alongside their modules.
- **US1**: T026 (tests) and T031 (PlayButton) alongside the T027–T030 server work.
- **US2**: the Python track (T035 → T036) and the TS scoring track (T037, T038 → T039 → T040) at the same time. T041, T043, T045 and T046 in parallel.
- **US3 ∥ US2**: T049–T051 can be built while US2's UI is in progress.
- **Polish**: T062, T063 and T064 together.

---

## Parallel Example: User Story 2

```bash
# Track A (Python sidecar)
Task: "T035 Implement the sidecar stt/app.py per contracts/stt-service.md"
Task: "T036 Create stt/tests/make_fixture.py + fixtures/clip.webm + test_smoke.py"

# Track B (TypeScript scoring), at the same time
Task: "T037 Implement lib/scoring/normalize.ts"
Task: "T038 Implement lib/scoring/align.ts"

# Track C (UI), at the same time
Task: "T045 Implement components/Recorder.tsx"
Task: "T046 Implement components/ScoreCard.tsx and components/TipList.tsx"
```

## Parallel Example: User Story 1

```bash
Task: "T026 Write tests/unit/selection.test.ts"
Task: "T031 Implement components/PlayButton.tsx"
Task: "T029 Implement lib/tts.ts"   # different file from T025/T027
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (Setup), then Phase 2 (Foundational). **Do T010 early**, because it settles the
   SQLite binding before any other route is written.
2. Phase 3 (US1). **Stop and validate** with quickstart scenarios 1–4: Eugenia can already
   learn and hear one idiom a day.

### Incremental delivery

1. MVP (US1), so she can use it on day 1.
2. Add US2 (Speak tries 1–2), which completes the P1 practice loop. Demo it.
3. Add US3 (Write), then US4 (Read aloud), which completes all practice steps.
4. Add US5 (score, chart, streak) for motivation.
5. Polish: README, tutor quality checks, the offline run, then submission.

### Notes

- Every route handler sets `export const runtime = 'nodejs'` and uses `requireLearner`,
  except login and health.
- Keep all tutor text in `prompts/`, and all tunable numbers in `config/settings.json` or
  the learner profile. Never hard-code them in components.
- Never commit `.env.local` or `data/`. Never send recordings anywhere except
  `127.0.0.1:8765`.
- Commit after each task or logical group. Stop at any checkpoint to validate a story on its
  own.

# Research: IdiomsMasterGirl – Daily Idiom Practice

Phase 0 output. The research was done inline, and the spikes ran on the target laptop
(Apple M4, 24 GB, macOS) on 2026-10-03. No NEEDS CLARIFICATION items remain.

---

## R1. Local language model and structured output

- **Decision**: Use Ollama with `gemma4:e2b` (4.6B, Q4_K_M) as the default. Call
  `/api/chat` with `format: <JSON schema>`, `think: false`, `temperature: 0.2` and
  `keep_alive: -1` (keep the model loaded; 24 GB RAM is enough). Gemma 4 E2B is licensed
  **Apache 2.0** (`ollama show gemma4:e2b --license`). The model tag and endpoint go in `config/settings.json`.
  `gemma4:26b` is listed as an optional upgrade only.
- **Rationale**: In the spike, both local tags honored the JSON schema. Warm calls took
  **1.9–2.6 s**; cold calls took **11.9–13.4 s** (≈ 9 s of that is the model load). `npm run dev`
  therefore sends a warm-up request at start. She stays signed in for a year, so warming at
  login would never run. The Learn page shows curated content first and loads the examples
  in a second request, so SC-002 holds for the idiom content even on a cold model. For the "piece of cake" examples,
  `gemma4:e2b` used the idiom **figuratively** ("The math test was a piece of cake"), while
  `gemma4:e2b-mlx` used it literally ("This chocolate cake is a piece of cake"), which is
  wrong for teaching.
- **Alternatives considered**: `gemma4:e2b-mlx` was faster on cold load but less accurate
  (rejected as default). `gemma4:26b` (18 GB) is too tight on 24 GB next to Whisper and
  Chrome, and it exceeds the ≤ 8B default rule. llama.cpp server directly would mean more
  setup for no gain.

## R2. Local speech recognition with word confidence

- **Decision**: Use a faster-whisper 1.2.x sidecar (FastAPI on `127.0.0.1:8765`) with model
  **`small.en`**, `device="cpu"`, `compute_type="int8"`, loaded once at startup.
  Transcription calls use `language="en"`, `temperature=0.0` (explicit, which disables the
  fallback resampling), `beam_size=5`, `condition_on_previous_text=False`,
  `word_timestamps=True` and `vad_filter=True`. Pin **`av<17`** and Python 3.12 via `uv`.
- **Rationale (spike)**:
  - A 3 s clip transcoded to **webm/opus** (what Chrome's MediaRecorder produces) decoded
    with **no system ffmpeg**, because PyAV ships its own libs.
  - `small.en`: 1.09 s per clip, and two runs gave identical words and probabilities, which
    supports SC-004.
  - `base.en`: 0.37 s warm but slightly less robust. It is the fallback setting.
  - The model load (≈ 19 s the first time, mostly download) happens once at startup and in
    setup.
  - `info.duration_after_vad` gives the speech length for FR-014.
- **Gotchas found**: faster-whisper 1.2.1 with PyAV 19 fails
  (`open() got an unexpected keyword argument 'metadata_errors'`), so pin `av<17`, which has
  wheels (16.1.0). CTranslate2 has no Metal backend, so this is CPU only, which is fine at
  these timings.
- **Offline**: setup pre-downloads the model (`scripts/fetch-models.sh`). The sidecar starts
  with `HF_HUB_OFFLINE=1`.
- **Known limitation**: Whisper tends to "autocorrect" mispronounced words into fluent
  English, so accuracy can over-report. The mitigation is the clarity score and the
  low-confidence threshold (0.6), which catch words the model was unsure about. This is
  documented in the README.
- **Alternatives considered**:
  - Browser `SpeechRecognition` sends audio to Google, which violates FR-024. **Never use
    it.**
  - whisper.cpp needs a native Node build, and its word-confidence output is weaker.
  - Spawning Python per request means paying the model load every time.

## R3. Scoring algorithm (FR-010, FR-011, SC-004)

- **Decision**: This is pure TypeScript in `lib/scoring/`.
  1. **Normalize** both target and transcript: lowercase, Unicode NFKC, curly → straight
     quotes, expand common contractions (`it's → it is`, `don't → do not`, etc.), turn
     hyphens into spaces, strip remaining punctuation, convert digits to words for 0–20, and
     collapse whitespace.
  2. **Align** with word-level Levenshtein (substitution, insertion and deletion cost 1),
     with a backtrace to label each target word `ok | substituted(heard) | missing` and each
     extra word `inserted`.
  3. **Accuracy** = `round(100 × max(0, 1 − WER))`, where `WER = (S + D + I) / N_target`.
  4. **Clarity** = `round(100 × mean(probability))` over the spoken words (Whisper sub-word
     tokens are already merged into words). It is 0 if there are no words.
  5. **Combined** = `round(w_acc × accuracy + w_clar × clarity)`, with weights from settings
     (default 0.7/0.3).
  6. **Problem words** = target words that are `missing` or `substituted` (with the heard
     word), plus aligned `ok` words whose probability is below the threshold (default 0.6),
     labeled `unclear`. They are deduplicated and kept in sentence order.
- **Rationale**: Deterministic, unit-testable, and repeatable for the same transcript.
  Repeatability then depends only on Whisper, and R2 showed identical output across runs.
- **Alternatives considered**: Character-level similarity is too lenient for single wrong
  words. Phoneme-level scoring (e.g. forced alignment) is heavier and out of weekend scope.

## R4. Speaking tips: LLM with validation and a deterministic fallback (FR-012, SC-005)

- **Spike result**: given a target, a transcript and the problem word "cake (heard
  cape)", **0 of 4** Gemma tips named "cake". They were generic idiom-filled
  encouragement.
- **Decision**:
  - **No problem words**: do not call the LLM. Pick a short positive message from a small
    list in `prompts/praise.md`, which avoids inventing problems (scenario 2.3).
  - **Problem words**: tips are **composed**. Code writes the factual lead from the
    problem word ("I heard “cape” for “cake”." / "I didn't hear “cake”." / "“cake” was a
    little unclear."). Gemma writes only the **coaching hint** for each word: one short
    physical tip (stress, a sound, mouth shape, pace), as JSON
    `{hints:[{word, hint}]}`. **Validate** that each `word` is in the problem list and
    each hint is ≤ 20 words with no other idioms. Retry once. The final tip is
    `lead + " " + hint`, for up to 3 problem words. This guarantees that every tip names a
    real word (SC-005), while the coaching text stays LLM-generated (FR-023).
  - **If the LLM is offline or a hint is still invalid**: that hint is replaced by a fixed
    one ("Say it slowly: cake."), so the tip stays factual: it names the real word and what
    was heard, and nothing is invented. The UI marks them
    "quick tip" and shows the "tutor is offline" banner.
- **Rationale**: The spike showed that unguided Gemma tips can be vague and full of idioms
  ("don't let tricky words get under your skin") without naming the word. Validation
  enforces SC-005. The template fallback keeps the Speak step usable when Ollama is down
  without fabricating content. This is the one place where non-LLM text appears, and it is
  data-derived, which reconciles FR-023 with the "no fake content" edge case.
- **Alternatives considered**: Templates only would be reliable but robotic, and would fail
  FR-023's spirit. Blocking scores when the tutor is offline would be an unnecessary loss,
  since scoring is fully local.

## R5. Voice output and audio cache (FR-007, FR-008, FR-025, FR-026)

- **Decision**:
  - **External voice (optional)**: ElevenLabs `POST /v1/text-to-speech/{voice_id}`
    (`output_format=mp3_44100_128`, header `xi-api-key`). The body is
    `{ text, model_id, voice_settings }`. `voice_id` and `model_id` (default
    `eleven_flash_v2_5`) come from settings. It is active only when `ELEVENLABS_API_KEY` is
    set **and** the learner opted in (`external_voice_enabled`, see R14).
  - **Cache**: the key is `sha256(provider + voiceId + modelId + normalizedText)`, stored at
    `data/audio/<key>.mp3`, with a row in `audio_clips`. Replays stream the file (≤ 1 s,
    SC-002). Fetches are idempotent: concurrent requests for the same key share one
    in-flight promise.
  - **Local fallback**: the browser `speechSynthesis` API, using only voices with
    `localService === true` and `lang === "en-US"`, preferring "Samantha". Chrome's "Google
    US English" voices are network voices and are excluded. If no local en-US voice exists,
    the button shows "audio unavailable".
  - **Settings note (FR-025)**: "When the natural voice is on, only the sentence to be
    spoken is sent to ElevenLabs. Your recordings and answers never leave this laptop."
- **Rationale**: This gives the most natural American voice for imitation. The cache keeps
  usage inside the free tier (SC-010), and each sentence is generated at most once.
- **Alternatives considered**: Piper or Kokoro local TTS (open) would be a good future swap
  to remove the exception, but it adds a runtime and models for this weekend. Server-side
  macOS `say` would not work in the browser and would tie the app to macOS.
- **Note**: The ElevenLabs endpoint and model name should be confirmed against the current
  sponsor docs (the `devrelay-sponsor-skills` skill) when implementing.

## R6. Storage: built-in `node:sqlite`

- **Decision**: Use `DatabaseSync` from `node:sqlite` (Node 26) with raw SQL and a small
  migrations array in `lib/db.ts`. Route handlers declare `export const runtime = 'nodejs'`.
  If the Next bundler mis-resolves the prefix-only `node:sqlite` builtin, add it to
  `serverExternalPackages`.
- **Rationale**: The spike worked in **plain Node 26** with no flags or warnings. It was
  **not yet verified inside a Next 16 route handler**, so that is the first implementation
  task. The fallback is `better-sqlite3` (same synchronous API shape), if a prebuild exists
  for Node 26. There is no native
  addon to build, which avoids the missing-prebuild risk of `better-sqlite3` on Node 26.
  It is synchronous, which is fine for one user.
- **Alternatives considered**: `better-sqlite3` needs a native ABI match. Drizzle or Prisma
  would be extra abstraction (YAGNI).

## R7. Authentication (FR-001, FR-002)

- **Decision**: One account is created by `npm run setup`, which asks for username, email
  and password. The password is hashed with `crypto.scrypt` (random 16-byte salt). Login
  matches username **or** email (case-insensitive) plus the password, using a constant-time
  compare. A session token (32 random bytes) is stored hashed in `auth_sessions`, set as an
  `HttpOnly; SameSite=Lax; Path=/` cookie with a 1-year expiry, and cleared on sign-out.
  Errors always read "Username/email or password is not right."
- **Alternatives considered**: NextAuth/Auth.js would be overkill for a single local user.

## R8. Daily idiom selection and examples (FR-004 – FR-006)

- **Decision**:
  - The session date is the laptop's **local** calendar date (`YYYY-MM-DD`) when the session
    is created. The session stays tied to that date even after midnight.
  - **Midnight rule** for `GET /session/today`: if the latest session is **incomplete**, its
    date is **yesterday**, and it had activity (an attempt, sentence or step change) in the
    last **3 hours**, return that session. Otherwise get or create the session for today's
    date. A late-night session therefore continues after midnight, and the next morning
    starts fresh.
  - **Selection**: from idioms whose level is in the learner's range and whose difficulty is
    within the configured range, exclude idioms shown in the last `noRepeatDays` (60). Pick
    one with a seeded PRNG (`seed = date`), so it is stable if re-run. If none are eligible,
    choose the idiom whose `last_shown` is oldest.
  - **Examples**: generated once by Gemma when the session is created and stored on the
    session. They are validated: exactly 3, each contains an accepted idiom variant (R9),
    each is ≤ 15 words, and there are no duplicates. Retry once. If Ollama is offline, use
    the curated `fallbackExamples` from `idioms.json` (human-written, so this is not fake
    content) and show the "tutor offline" banner.
- **Rationale**: Generating once and persisting satisfies FR-006 and makes reopening
  instant (SC-002).

## R9. Idiom variant matching (FR-015, example validation)

- **Decision**: Use a deterministic match, not an LLM. Each curated idiom has
  `variants: string[]` (regex sources, case-insensitive, word-bounded), e.g.
  `\bbr(eak|eaks|oke|eaking|oken)\s+the\s+ice\b`. Placeholders such as `someone's` are
  written as `\b\w+(?:'s)?\b`. A sentence passes if any variant matches.
- **Speakable form**: each idiom has `spoken` (e.g. "break the ice", or "break her heart"
  for "break someone's heart"). This is the Speak target and the TTS text.
- **Rationale**: Predictable, testable, instant, and works offline.

## R10. Writing grades (FR-015, FR-016, SC-006)

- **Decision**: One Gemma call per sentence with a JSON schema
  `{usageGrade, grammarGrade, corrected, isCorrect, explanation}`. The prompt tells it to
  keep her meaning and change as little as possible. Validation:
  - grades are integers 0–100;
  - `corrected` still matches an idiom variant;
  - `explanation` is ≤ 40 words;
  - if `isCorrect` is true, then `corrected === original` after whitespace trim.

  Retry once. If it still fails, the sentence is marked `could_not_grade` and she can press
  "try again".
- **Sentence grade** = `round((usageGrade + grammarGrade) / 2)`. The **Write step score** is
  the mean of the 3 sentence grades.
- **Coercion before validation** (a 4.6B model often contradicts itself): if `isCorrect`,
  set `corrected = original`; if `corrected` equals `original` after trimming, set
  `isCorrect = true`. Clamp grades to 0–100. Only structural failures (missing fields, or
  `corrected` without the idiom) cause a retry or `could_not_grade`.
- **Blocking rule**: the Write step completes only when all 3 sentences have been graded. A
  `could_not_grade` sentence must be retried, or edited and resubmitted, before moving on.
  This keeps the daily score honest.

## R11. Attempts, tries and the daily score (FR-013, FR-014, FR-018)

- **Decision**:
  - One **counted** attempt per item per phase (`try1`, `try2`, `read`). She may re-record
    before submitting (FR-009). Once a recording is scored, re-scoring the same phase
    replaces it only if she explicitly presses "redo" before leaving the step. The last
    scored attempt counts.
  - Rejected recordings (speech < 0.5 s from VAD, no words, or decode failure) are stored
    with `status = rejected` and never counted.
  - **Phase score** = mean of the combined scores of its items (4 items for Speak, 3 for
    Read aloud). **Improvement** = try2 − try1, per item and overall.
  - **Daily score** = `round(mean(speakTry2, writeScore, readScore))`, and each part is
    shown.

## R12. Streak and progress (FR-020, FR-021)

- **Decision**: A day counts if `daily_sessions.completed_at` is set for that date. The
  streak is the number of consecutive completed dates ending **today**, or ending
  **yesterday** if today is not completed yet, so the streak shows before she practices.
  A gap resets the count. Completing the first day after a gap gives a streak of 1. The
  chart is an inline SVG line chart of the last 30 days. Missing days are shown as gaps,
  and no chart library is used, which also keeps it offline.

## R13. Offline and network posture (FR-024, FR-026, SC-009)

- **Decision**: Next.js and the sidecar bind to `127.0.0.1`. No `next/font/google` and no
  CDN assets; all assets are bundled. The sidecar sets `HF_HUB_OFFLINE=1`. Microphone access
  works because `localhost` counts as a secure context. Opening the app from a phone over
  the LAN would lose mic access, which is out of scope and noted in the README.
- **Health**: `/api/health` reports `ollama`, `stt` and `externalVoice` status. The UI shows
  banners rather than crashing, as the edge cases require.

## R14. Prompts, personality and settings (FR-023, Constitution I/II)

- **Decision**: `prompts/system.md` (tutor persona with a `{{personality}}` slot),
  `prompts/examples.md`, `prompts/tips.md`, `prompts/grading.md` and `prompts/praise.md`.
  These are Mustache-style `{{var}}` templates rendered with plain string replacement.
  `config/settings.json` holds the model, thresholds, weights, windows, personality and
  voice provider settings.
- **Single source of truth**:
  - **Learner profile (DB, editable in Settings)**: level, difficulty range, voice on/off
    (`external_voice_enabled`, default **0**, set by the setup opt-in question). The
    difficulty label in prompts is derived from the range (1–2 → "basic to medium").
  - **`settings.json`**: everything that is not personal (model, STT, weights, thresholds,
    windows, personality text, ElevenLabs voice and model ids, privacy note).
  - **External voice is active** only when `profile.external_voice_enabled` is on **and**
    `ELEVENLABS_API_KEY` is present. `settings.json` has no on/off flag for it. It is read on each request, so edits apply without a
  restart. The schema is in [contracts/content-config.md](./contracts/content-config.md).

## R15. Process orchestration

- **Decision**: `npm run dev` runs `concurrently "uv run --project stt uvicorn app:app
  --host 127.0.0.1 --port 8765" "next dev -H 127.0.0.1"`. Ollama runs as the user's existing
  macOS app or service. After both are up, a small `scripts/warmup.ts` sends one tiny chat request
  so Gemma is loaded before she opens the app. `npm run setup` does the following: checks
  Ollama and pulls the configured model if missing, runs `uv sync` in `stt/`, pre-downloads the Whisper model,
  creates `data/app.db`, runs migrations, creates the account interactively, and asks the
  opt-in question "Use the natural ElevenLabs voice? Only the sentence text is sent." (default
  **No**).

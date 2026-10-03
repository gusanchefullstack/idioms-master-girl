# IdiomsMasterGirl 💬

**One English idiom a day: learn it, hear it, say it, write it, and read it aloud.**

A small practice partner built for one person: **Eugenia**, my wife. She is learning English
in San Francisco at an A2 (elementary) level. Idioms are everywhere in American life ("it's a
piece of cake", "let's call it a day"), and they are hard to learn from a textbook. She
needed a patient partner that:

- picks **one common idiom a day** at her level,
- lets her **hear** it in a natural American voice,
- **listens** to her say it and tells her kindly which words to fix,
- **reads** her own sentences and corrects them, and
- shows her **progress and a streak** so she keeps coming back.

Everything that touches her voice, her mistakes and her history **runs on our laptop**.

---

## The daily session (≈ 15–20 minutes)

| Step | What happens |
|------|--------------|
| 1. **Learn** | Today's idiom with its meaning, a "when to use it" note, register/region, a literal-vs-figurative note and 3 examples. Every line has a ▶ play button. |
| 2. **Speak, try 1** | She records the idiom and the 3 examples. Each recording gets **accuracy**, **clarity** and a **combined score**, plus 1–3 warm tips that name the exact words: *"I heard “cape” for “cake”. End with a strong K sound."* |
| 3. **Speak, try 2** | She records everything again and sees **+N points** per sentence and overall. |
| 4. **Write** | She writes 3 sentences of her own. Each gets an idiom-use grade, a grammar grade, a corrected version with the changes highlighted, and a short explanation. |
| 5. **Read aloud** | She hears her corrected sentences, then reads them aloud and gets scored. |
| 6. **Score** | The daily score (average of Speak try 2, Write and Read aloud), a 30-day chart and her 🔥 streak. |

She can leave mid-session and come back to the same step later that day.

## How scoring works

- **Accuracy** = `100 × (1 − word error rate)` of the transcript against the target sentence.
  Case, punctuation and contractions ("it's" = "it is") are ignored.
- **Clarity** = the average confidence Whisper gives to each word she said.
- **Combined** = `70% accuracy + 30% clarity`.
- **Problem words** are words that were missing, replaced, or recognized with confidence
  below 0.6.
- **Tips**: the code writes the fact ("I heard X for Y"), and the local model writes the
  coaching hint. Every tip therefore names a real word, and nothing is invented. A clean
  recording gets praise, not fake corrections.

The weights, the threshold and the 60-day no-repeat window live in `config/settings.json`.

---

## Setup (macOS, about 10 minutes, one time)

**You need:** [Node.js 26](https://nodejs.org) (`nvm use`), [uv](https://docs.astral.sh/uv/),
[Ollama](https://ollama.com) running, and Chrome. You do **not** need ffmpeg.

```bash
nvm use                 # Node 26 (see .nvmrc)
npm install
cp .env.example .env.local    # optional: add ELEVENLABS_API_KEY=... for the natural voice
npm run setup           # pulls gemma4:e2b, installs the speech helper, downloads Whisper,
                        # creates data/app.db, asks for her name/username/email/password,
                        # and asks whether to use the natural voice (default: No)
npm run dev             # http://localhost:3000
```

`npm run dev` starts three things: the local speech helper (`127.0.0.1:8765`), the web app
(`127.0.0.1:3000`), and a warm-up call that loads Gemma, so the first session of the day is
fast.

### Checks

```bash
npm test                      # 55 unit tests: scoring, idiom list, step rules, streak, tips, grading
uv run --project stt pytest   # speech helper smoke test (offline, includes a repeatability check)
npm run test:tutor            # live model quality check (Ollama must be running)
npm run score:file -- stt/tests/fixtures/clip.webm "Finishing the homework was a piece of cake for me."
```

---

## Open models and licenses

| Piece | What | License | Runs |
|-------|------|---------|------|
| Tutor | **Gemma 4 E2B** (`gemma4:e2b`, 4.6B params, Q4_K_M) | Apache 2.0 | locally via **Ollama** (MIT) |
| Ears | **Whisper `small.en`** | MIT | locally via **faster-whisper** (MIT) + CTranslate2 (MIT), CPU int8 |
| Idioms | 100 curated A2–B1 idioms in `content/idioms.json` | this repo | local file |
| Voice (optional) | ElevenLabs text-to-speech | proprietary API | cloud, opt-in, text only |

### Swap the model

Edit `config/settings.json`. No code changes and no restart are needed; it is read on every
request.

```json
"llm": { "baseUrl": "http://127.0.0.1:11434", "model": "gemma4:e2b" }
```

Any Ollama model that supports JSON-schema output works, e.g. `gemma4:26b` on a bigger machine.
You can also change the Whisper size with `stt.model` (`base.en` is faster, `small.en` is
the default). The tutor's personality is in `tutor.personality`, and every prompt is a plain
Markdown file in `prompts/`.

### Privacy

- Her **recordings never leave the laptop**. They go to the speech helper on `127.0.0.1`,
  are processed in memory, and are discarded. They are never saved.
- Scores, sentences and history live in `data/app.db` (SQLite) on this laptop. There is no
  telemetry, analytics or remote logging.
- The **natural voice is opt-in**. When it is on, only the sentence being spoken (an idiom,
  an example or her corrected sentence) is sent to ElevenLabs, and each sentence is sent only
  once: the audio is saved in `data/audio/` and replayed from there. When it is off, or the
  internet is down, the Mac's own voice (Samantha) reads instead.
- The API key lives in `.env.local` (gitignored) and only needs **text-to-speech**
  permission.

---

## Why open innovation matters here

- **It works offline.** After setup, the whole lesson works with Wi-Fi off. Only new
  natural-voice audio needs the internet, and saved clips plus the local voice cover that.
- **Her mistakes stay private.** A learner's recordings and wrong sentences are personal.
  With an open model and open speech recognition on our own laptop, they never go to a
  company's server.
- **It is tuned to one person.** Because the model, the prompts and the idiom list are all
  ours, the tutor speaks to *her* level, in *her* tone ("warm, patient, playful big-sister
  tutor"), about *her* life in SF. Changing that is editing a text file.
- **It costs nothing.** No API bill per session. The open pieces are free, and the voice is
  cached.
- **Where open beat closed:** the scoring needs **per-word confidence**. Open Whisper gives
  that directly, with deterministic settings, so the same recording gets the same score.
  Closed speech APIs usually hide it or change it without notice. Being able to read and
  change the prompts also let us fix a real problem fast: the small model wrote vague tips,
  so we moved the facts into code and let the model write only the coaching.

## Known limitations

- Whisper sometimes "autocorrects" a mispronounced word into the right one, so accuracy can
  be a bit generous. The clarity score and the low-confidence check catch most of these.
- The small default model is good but not perfect at grammar. In our check it fixed 13 of
  15 known errors, and it sometimes misses a past-tense error after "yesterday". A bigger
  model (`gemma4:26b`) is a one-line swap.
- If Ollama was not warmed up, the first examples of the day can take about 13 s.
  `npm run dev` warms it automatically.
- The microphone works on `localhost` only. Opening the app from a phone over Wi-Fi will not
  get microphone access (browsers require a secure origin).
- Chrome is the supported browser (MediaRecorder with webm/opus).

## Project layout

```text
app/            Next.js pages and API routes (sign-in, session, attempts, sentences, audio, progress, settings, health)
components/     Learn / Speak / Write / Read aloud / Summary steps, Recorder, PlayButton, ProgressChart
lib/            db (node:sqlite), auth, idioms, scoring/, tutor/ (Ollama, examples, tips, grading), stt, tts, progress
content/        idioms.json – the curated idiom list
prompts/        the tutor's prompts (Markdown)
config/         settings.json – model, thresholds, weights, voice
stt/            the local speech helper (Python, FastAPI + faster-whisper)
specs/          Spec Kit spec, plan, research, contracts and tasks
```

Built with [Spec Kit](https://github.com/github/spec-kit) for Hacktoberfest 2026, Week 1:
*Build for a Friend*.

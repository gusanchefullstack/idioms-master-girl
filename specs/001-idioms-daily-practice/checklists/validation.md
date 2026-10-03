# Validation Log: IdiomsMasterGirl

Run on 2026-10-03, MacBook (Apple M4, 24 GB), Node 26.0.0, Ollama with `gemma4:e2b`,
Whisper `small.en`. The automated end-to-end run used a throwaway learner and DB, with
recordings synthesized by macOS `say` (Samantha).

## Automated

| Check | Result |
|-------|--------|
| `npm test` (Vitest) | ✅ 55/55 |
| `uv run --project stt pytest` (offline, `HF_HUB_OFFLINE=1`) | ✅ 4/4 (includes repeatability) |
| `tsc --noEmit` / `next build` | ✅ clean |
| `npm run test:tutor` SC-005 tips | ✅ 20/20 name a real problem word (18/20 fully model-written), 0 discouraging |
| `npm run test:tutor` SC-006 corrections | ✅ 13/15 (target ≥ 13). Misses: two past-tense errors next to "yesterday"/"then" were judged correct |

## End-to-end API run (quickstart scenarios)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Wrong password → generic message; sign in with email (any case) | ✅ |
| 2 | Today's idiom + 3 examples ≤ 15 words, figurative | ✅ `GET /session/today` 57 ms; examples 2.6 s (SC-002 ≤ 10 s) |
| 3 | Reload → same idiom | ✅ |
| 4 | ElevenLabs first play / replay | ✅ 316 ms / 17 ms (SC-002 replay ≤ 1 s) |
| 5 | Try 1 with a wrong word ("banana" for "leg") | ✅ tip: “I heard “banana” for “leg”…”; clean take → praise, no tips |
| 6 | Silent take | ✅ 422 `no_speech`, not counted |
| 7 | Try 2 shows delta per item and overall | ✅ |
| 8 | SC-004 repeatability (`score:file` twice) | ✅ identical (100/98/99) |
| 9 | Empty sentence / sentence without the idiom | ✅ 400 `missing_sentences` / `idiom_missing`, nothing graded |
| 10 | Grading with grammar and usage errors | ✅ corrected + explanation (9.5 s for 3 sentences) |
| 11 | Read aloud scored | ✅ |
| 12 | Summary + progress | ✅ daily = mean(Speak 2, Write, Read) |
| 14 | Streak with seeded days and gaps | ✅ streak 4, gaps shown as line breaks |
| — | Every scored recording (SC-003 ≤ 8 s) | ✅ 1.1–2.9 s |
| — | Voice off → uncached clip returns 204 `X-Voice-Fallback: local`; cached clip still 200 | ✅ |
| — | Another learner's item → 404; no cookie → 401 | ✅ |
| — | UI in Chrome at desktop and 390 px width; no console errors | ✅ |

## Privacy review (T064)

- No file writes in the attempts route or the speech helper.
- Both servers bind to 127.0.0.1.
- No CDN or Google Fonts.
- The API key is not in the repo and is never logged.
- ElevenLabs receives only `practice_items.text`.

## Manual checks

- [x] T066 (2026-10-03, confirmed by the user: works great): run the quickstart scenarios in Chrome with a real microphone, including
      scenario 17 (mic blocked) and scenarios 15–16 (stop Ollama / stop the speech helper).
- [ ] T067: offline run. Turn Wi-Fi off, run `npm run dev`, and complete a full session.
      Then turn the natural voice off and confirm there are no requests to `api.elevenlabs.io`.
- [x] T068 (2026-10-03, confirmed by the user): a full session took under 20 min, which meets SC-001.

# Data Model: IdiomsMasterGirl – Daily Idiom Practice

Storage is SQLite (`data/app.db`, via `node:sqlite`). Curated idioms live in
`content/idioms.json` (versioned, read-only at runtime). The only per-idiom state kept in
the DB is the "last shown" date, which is derived from `daily_sessions`. Times are ISO-8601
strings. `date` columns are the local calendar date `YYYY-MM-DD`.

## Entities

### Learner (`learners`)

| Field | Type | Rules |
|-------|------|-------|
| id | INTEGER PK | Single row in v1 |
| username | TEXT UNIQUE NOT NULL | 3–32 chars, `[a-z0-9_.-]`, stored lowercase |
| email | TEXT UNIQUE NOT NULL | Valid email, stored lowercase |
| display_name | TEXT NOT NULL | e.g. "Eugenia" |
| password_hash | TEXT NOT NULL | `scrypt$<saltHex>$<hashHex>` |
| level | TEXT NOT NULL DEFAULT 'A2' | One of `A1, A2, B1, B2` |
| difficulty_min / difficulty_max | INTEGER NOT NULL DEFAULT 1 / 2 | 1 = basic, 2 = medium, 3 = advanced; min ≤ max |
| voice_pref | TEXT NOT NULL DEFAULT 'en-US' | Locale of the voice |
| external_voice_enabled | INTEGER NOT NULL DEFAULT 0 | Opt-in (set by the setup question or Settings); used only if `ELEVENLABS_API_KEY` is present. The single source of truth for the voice switch |
| created_at | TEXT NOT NULL | |

The current streak is **derived** (see Progress), not stored, so it can never drift.

### Auth session (`auth_sessions`)

| Field | Type | Rules |
|-------|------|-------|
| token_hash | TEXT PK | sha256 of the cookie token |
| learner_id | INTEGER FK → learners | |
| created_at / expires_at | TEXT | expires = created + 365 days |

### Idiom (`content/idioms.json`, not a table)

Schema in [contracts/content-config.md](./contracts/content-config.md). Key fields: `id`
(slug), `phrase`, `spoken`, `variants[]`, `level` (A2 or B1), `difficulty` (1–3),
`meaning`, `whenToUse`, `register`, `region`, `literalNote`, `fallbackExamples[3]`.
Validation runs at startup and in tests: ids are unique, there are exactly 3
`fallbackExamples`, each fallback matches a variant, and `spoken` matches a variant.

**Last shown** = `MAX(date) FROM daily_sessions WHERE idiom_id = ?`.

### Daily Session (`daily_sessions`)

| Field | Type | Rules |
|-------|------|-------|
| id | INTEGER PK | |
| learner_id | INTEGER FK | |
| date | TEXT NOT NULL | Local date at creation; UNIQUE(learner_id, date) |
| idiom_id | TEXT NOT NULL | Must exist in idioms.json |
| examples_json | TEXT NULL | JSON array of exactly 3 strings; NULL while pending (generated in a second request, research R8) |
| examples_source | TEXT NULL | `llm` or `curated_fallback` |
| last_activity_at | TEXT NOT NULL | Updated on any attempt, sentence or step change (used by the midnight rule) |
| step | TEXT NOT NULL DEFAULT 'learn' | See the state machine below |
| speak_try1_score / speak_try2_score | INTEGER NULL | 0–100, mean of 4 items |
| write_score | INTEGER NULL | 0–100, mean of 3 sentence grades |
| read_score | INTEGER NULL | 0–100, mean of 3 items |
| daily_score | INTEGER NULL | `round(mean(speak_try2, write, read))` |
| created_at / completed_at | TEXT | `completed_at` is set on entering `done` |

### Practice Item (`practice_items`)

| Field | Type | Rules |
|-------|------|-------|
| id | INTEGER PK | |
| session_id | INTEGER FK | |
| kind | TEXT NOT NULL | `idiom`, `example`, `corrected` |
| position | INTEGER NOT NULL | idiom 0; examples 1–3; corrected 1–3; UNIQUE(session_id, kind, position) |
| text | TEXT NOT NULL | Exact target text (the idiom's `spoken` form for the idiom item) |
| audio_key | TEXT NULL FK → audio_clips | Set once audio exists |

Idiom and example items are created with the session. Corrected items are created when
each sentence is graded.

### Speaking Attempt (`speaking_attempts`)

| Field | Type | Rules |
|-------|------|-------|
| id | INTEGER PK | |
| item_id | INTEGER FK → practice_items | |
| phase | TEXT NOT NULL | `try1`, `try2`, `read` (`read` only for `corrected` items; try1/try2 only for idiom/example) |
| status | TEXT NOT NULL | `scored` or `rejected` |
| reject_reason | TEXT NULL | `too_short`, `no_speech`, `unreadable` |
| speech_seconds | REAL | From VAD |
| transcript | TEXT | Raw transcript |
| words_json | TEXT | `[{word, start, end, probability}]` |
| accuracy / clarity / combined | INTEGER NULL | 0–100 when scored |
| problem_words_json | TEXT | `[{word, type: missing|substituted|unclear, heard?, probability?}]` |
| tips_json | TEXT | `[string]`, 1–3 items, or `[]` when praise is used |
| feedback_source | TEXT | `llm`, `template`, `praise` |
| counted | INTEGER NOT NULL DEFAULT 0 | Exactly one counted scored attempt per (item, phase) |
| created_at | TEXT | |

Recording audio is **not** stored. It is sent to the local sidecar and discarded (privacy,
and nothing needs it).

### Written Sentence (`written_sentences`)

| Field | Type | Rules |
|-------|------|-------|
| id | INTEGER PK | |
| session_id | INTEGER FK | |
| position | INTEGER NOT NULL | 1–3, UNIQUE(session_id, position) |
| original | TEXT NOT NULL | Non-empty and matches an idiom variant (checked before grading) |
| status | TEXT NOT NULL | `pending`, `graded`, `could_not_grade` |
| corrected | TEXT NULL | Matches an idiom variant |
| is_correct | INTEGER NULL | |
| usage_grade / grammar_grade | INTEGER NULL | 0–100 |
| grade | INTEGER NULL | `round((usage + grammar) / 2)` |
| explanation | TEXT NULL | ≤ 40 words, simple English |
| updated_at | TEXT | |

### Audio Clip (`audio_clips`)

| Field | Type | Rules |
|-------|------|-------|
| key | TEXT PK | `sha256(provider + voiceId + modelId + normalizedText)` |
| provider | TEXT | `elevenlabs` (local browser audio is never stored) |
| voice_id / model_id | TEXT | |
| text | TEXT NOT NULL | Exact text spoken |
| file_path | TEXT NOT NULL | `data/audio/<key>.mp3` |
| bytes | INTEGER | |
| created_at | TEXT | |

## Relationships

```text
Learner 1─* AuthSession
Learner 1─* DailySession ─1 Idiom (json)
DailySession 1─* PracticeItem 1─* SpeakingAttempt
DailySession 1─3 WrittenSentence ─(graded)→ PracticeItem(kind=corrected)
PracticeItem *─0..1 AudioClip
```

## Session step state machine

```text
learn ──(continue)──▶ speak_try1 ──(4 counted try1 attempts)──▶ speak_try2
speak_try2 ──(4 counted try2 attempts)──▶ write
write ──(3 sentences status=graded)──▶ read_aloud
read_aloud ──(3 counted read attempts)──▶ done   [compute daily_score, set completed_at]
```

- Transitions only move forward and are checked on the server (`POST
  /api/session/{id}/step`). The guard conditions above must hold.
- Reopening the app on the same date returns the stored `step` (FR-022). Earlier results are
  kept.
- The `learn → speak_try1` transition also requires `examples_json` to be set.
- On a new local date, a new session is created, except under the midnight rule (research
  R8: an incomplete session from yesterday that was active in the last 3 h is continued). An unfinished session from an earlier date
  stays incomplete and does not count toward the streak.
- Learn and Write do not need the microphone. If permission is denied, the speaking steps
  show the help message and the other steps still work.

## Derived values

- **Phase score** = `round(mean(combined))` over the counted attempts of that phase.
- **Improvement** per item = `try2.combined − try1.combined`. Overall improvement =
  `speak_try2_score − speak_try1_score`.
- **Streak**: see research R12.
- **Progress series**: `SELECT date, daily_score FROM daily_sessions WHERE completed_at IS
  NOT NULL AND date >= today − 29`.

## Validation summary (from requirements)

| Rule | Source |
|------|--------|
| Exactly 3 examples, each ≤ 15 words, containing the idiom | FR-005, assumptions |
| Same idiom and examples all day | FR-006 (UNIQUE learner+date) |
| No repeat within 60 days, oldest reused if exhausted | FR-004, edge case |
| Speech < 0.5 s → rejected, not counted | FR-014 |
| Combined = 0.7·acc + 0.3·clar; threshold 0.6 | FR-010/011 (configurable) |
| 1–3 tips, each names a problem word; none when no problems | FR-012 |
| 3 non-empty sentences containing the idiom before grading | FR-015 |
| Grading failure → retry once → `could_not_grade` | Edge case |

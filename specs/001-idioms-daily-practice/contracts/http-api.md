# Contract: HTTP API (Next.js route handlers)

- Base URL: `http://127.0.0.1:3000/api`.
- All routes use `runtime = 'nodejs'`.
- All routes except `auth/login` and `health` need a valid `session` cookie; otherwise they
  return `401 {"error":"unauthorized"}`.
- Errors use the shape `{ "error": string, "message": string }`, where `message` is
  friendly, simple English that is safe to show to Eugenia.
- Entity fields are described in [data-model.md](../data-model.md).

## Auth

### `POST /auth/login`
Request: `{ "identifier": "eugenia" | "eugenia@example.com", "password": "…" }`
- `200` sets the `session` cookie (HttpOnly, SameSite=Lax, 1 year) and returns
  `{ "displayName": "Eugenia" }`.
- `401` returns `{ "error": "bad_credentials", "message": "Username/email or password is
  not right." }`. The response is identical whichever field was wrong.

### `POST /auth/logout`
`204`. Deletes the auth session and clears the cookie.

## Session

### `GET /session/today`
Gets or creates today's session (local date). It is idempotent within a day. **Midnight
rule** (research R8): if the latest session is incomplete, dated yesterday, and active in
the last 3 hours, that session is returned instead. The response returns at once with the
curated idiom content. If the examples are not generated yet, `examplesStatus` is
`"pending"` and the example items are absent.
- `200`:
```json
{
  "id": 12, "date": "2026-10-03", "step": "learn",
  "idiom": { "id": "piece-of-cake", "phrase": "piece of cake", "spoken": "a piece of cake",
             "meaning": "…", "whenToUse": "…", "register": "informal", "region": "US/UK",
             "literalNote": "…" },
  "examplesStatus": "ready",
  "examplesSource": "llm",
  "items": [ { "id": 40, "kind": "idiom", "position": 0, "text": "a piece of cake", "hasAudio": true },
             { "id": 41, "kind": "example", "position": 1, "text": "…", "hasAudio": false } ],
  "attempts": { "<itemId>": { "try1": AttemptSummary, "try2": AttemptSummary, "read": AttemptSummary } },
  "sentences": [ WrittenSentence ],
  "scores": { "speakTry1": 71, "speakTry2": null, "write": null, "read": null, "daily": null },
  "tutorOnline": true
}
```
- If Ollama is offline when the session is created, curated fallback examples are used,
  `examplesSource` is `"curated_fallback"` and `tutorOnline` is `false`.

### `POST /session/{id}/examples`
Generates and stores the 3 examples if they are still pending (research R8). It is
idempotent: if they exist, it returns them. Concurrent calls share one in-flight
generation. `200` returns the session (`examplesStatus: "ready"`). The client calls this
right after `GET /session/today` whenever `examplesStatus` is `"pending"`.

### `POST /session/{id}/step`
Request: `{ "to": "speak_try1" | "speak_try2" | "write" | "read_aloud" | "done" }`
- `200` returns the updated session (same shape as above).
- `409 {"error":"step_guard","message":"Please finish all 4 recordings first."}` when the
  guard in the data-model state machine is not met, or when the move is not forward by one
  step.

## Speaking

### `POST /attempts` (multipart/form-data)
Fields: `itemId` (int), `phase` (`try1` | `try2` | `read`), `audio` (blob, `audio/webm`,
≤ 2 MB, ≤ 30 s).
Server flow: send the audio to the STT sidecar ([stt-service.md](./stt-service.md)), score
it (research R3), generate tips ([tutor-llm.md](./tutor-llm.md)), store the attempt and mark
it `counted`, replacing any earlier counted attempt for (item, phase).
- `200` returns an `AttemptSummary`:
```json
{
  "id": 301, "itemId": 41, "phase": "try2",
  "accuracy": 90, "clarity": 84, "combined": 88,
  "transcript": "It was a piece of cape.",
  "problemWords": [ { "word": "cake", "type": "substituted", "heard": "cape" } ],
  "tips": [ "I heard \"cape\" for \"cake\". End with a strong K sound, like a little cough." ],
  "feedbackSource": "llm",
  "previous": { "phase": "try1", "combined": 76, "delta": 12 }
}
```
  `previous` is present only for `try2`.
- `422 {"error":"recording_rejected","reason":"too_short"|"no_speech"|"unreadable",
  "message":"I couldn't hear enough – please try again, a little louder."}`. The attempt is
  stored as rejected and not counted.
- `400` for an invalid phase/item combination (e.g. `read` on an example item).
- `503 {"error":"stt_offline","message":"The listening helper is not running. Start it and
  try again."}`.

## Writing

### `POST /sentences`
Request: `{ "sessionId": 12, "sentences": ["…", "…", "…"] }`. Previously graded positions
whose text has not changed are not regraded.
- `400 {"error":"missing_sentences","positions":[3]}` if any sentence is empty.
- `400 {"error":"idiom_missing","positions":[2],"message":"Sentence 2 doesn't use \"piece
  of cake\" yet – try adding it!"}`. This uses the deterministic variant match (research
  R9), and nothing is graded.
- `200` returns `{ "sentences": [WrittenSentence], "writeScore": 83 | null }`.
  `writeScore` is null while any sentence has status `could_not_grade`.

### `POST /sentences/{id}/regrade`
Regrades one `could_not_grade` sentence. `200` returns `WrittenSentence`.
`503 tutor_offline` if Ollama is down.

`WrittenSentence`:
`{ id, position, original, status, corrected, isCorrect, usageGrade, grammarGrade, grade,
explanation, itemId }`. `itemId` is the corrected practice item, used for Read aloud.

## Audio

### `GET /audio?itemId=41`
- `200 audio/mpeg`: a cached clip, or a newly generated one from ElevenLabs that is then
  cached. It has `Cache-Control: private, max-age=31536000, immutable`.
- `204` with `X-Voice-Fallback: local` when the external voice is disabled, has no key, is
  unreachable, or is offline. The client then uses on-device `speechSynthesis` (only voices
  with `localService === true` and en-US), or shows "audio unavailable" if there is none.
- Only `items.text` is ever sent to ElevenLabs, never free text from the client.

## Progress

### `GET /progress?days=30`
`200`:
```json
{ "streak": 4,
  "series": [ { "date": "2026-10-01", "daily": 78 }, { "date": "2026-10-02", "daily": null } ],
  "today": { "speakTry1": 71, "speakTry2": 83, "improvement": 12, "write": 80, "read": 85, "daily": 83 } }
```
The series has one entry for each of the last `days` dates. `daily` is null if that day was
not completed.

## Settings & health

### `GET /settings` · `PATCH /settings`
Reads or updates the learner's profile fields (`displayName`, `level`, `difficultyMin`,
`difficultyMax`, `externalVoiceEnabled`). It returns `externalVoiceAvailable`, which is true
only if a key is configured. The external voice is used only when both are true. It also returns the privacy note text (FR-025). File-level settings
(model, weights, thresholds, personality) are edited in `config/settings.json`.

### `GET /health` (no auth)
`200 { "ollama": "up"|"down", "model": "gemma4:e2b", "stt": "up"|"down",
"externalVoice": "on"|"off"|"unreachable" }`

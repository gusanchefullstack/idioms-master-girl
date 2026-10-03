# Contract: Tutor (Ollama + Gemma)

- Endpoint: `POST {settings.llm.baseUrl}/api/chat` (default `http://127.0.0.1:11434`).
- Common options: `model: settings.llm.model`, `stream: false`, `think: false`,
  `keep_alive: -1`, `options.temperature: settings.llm.temperature` (default 0.2),
  `format: <schema below>`.
- Timeout: 20 s per call.
- The system message is `prompts/system.md`, rendered with `{{personality}}` (from settings), plus
  `{{level}}` and `{{difficultyLabel}}` (from the learner profile).
- Every response is parsed as JSON and then **validated in code**. If validation fails,
  the call is retried once with an added reminder that names the failed rule. Each section
  below says what happens if it fails again.
- No closed APIs are used. The model is swappable through `config/settings.json`.

## 1. Examples (`prompts/examples.md`)
Inputs: `phrase`, `spoken`, `meaning`, `whenToUse`, `level`.
Schema:
```json
{ "type": "object", "required": ["examples"],
  "properties": { "examples": { "type": "array", "minItems": 3, "maxItems": 3,
                                "items": { "type": "string" } } } }
```
Validators:
- exactly 3 items;
- each is unique, ≤ 15 words and matches an idiom variant.

Figurative use is required by the prompt, which includes the `literalNote` and one curated
example as a model. It is not checked in code; research R1 picked `gemma4:e2b` partly
because it used idioms figuratively in the spike.

If it still fails: use `fallbackExamples` from `idioms.json`, with
`examplesSource = "curated_fallback"`.

## 2. Speaking tips (`prompts/tips.md`): composed (research R4)
This is called only when `problemWords.length > 0`. Otherwise a line from `prompts/praise.md`
is used (`feedbackSource = "praise"`). At most the first 3 problem words, in sentence order,
are sent.

Inputs: `target`, `transcript`, `problemWords` (JSON list with `word`, `type`, `heard?`,
`probability?`), `phase`.
Schema (Gemma writes only the coaching hint for each word):
```json
{ "type": "object", "required": ["hints"],
  "properties": { "hints": { "type": "array", "minItems": 1, "maxItems": 3,
    "items": { "type": "object", "required": ["word", "hint"],
               "properties": { "word": { "type": "string" }, "hint": { "type": "string" } } } } } }
```
Validators:
- `word` must be one of the sent problem words;
- `hint` must be ≤ 20 words and must not be empty;
- there is at most one hint per word.

The prompt rules are: warm and simple, one concrete physical hint (stress, a sound, mouth
shape, pace), and no idioms other than today's.

**Final tip** = code-written lead + `" "` + hint:
- `substituted`: "I heard “{heard}” for “{word}”."
- `missing`: "I didn't hear “{word}”."
- `unclear`: "“{word}” was a little unclear."

If a word's hint is missing or invalid after one retry, or Ollama is offline, use a fixed
hint: "Say it slowly: {word}." `feedbackSource` is `"llm"` if every hint came from the
model, otherwise `"template"`.

## 3. Writing grade (`prompts/grading.md`)
Inputs: `phrase`, `meaning`, `sentence`, `level`.
Schema:
```json
{ "type": "object",
  "required": ["usageGrade", "grammarGrade", "isCorrect", "corrected", "explanation"],
  "properties": {
    "usageGrade":   { "type": "integer", "minimum": 0, "maximum": 100 },
    "grammarGrade": { "type": "integer", "minimum": 0, "maximum": 100 },
    "isCorrect":    { "type": "boolean" },
    "corrected":    { "type": "string" },
    "explanation":  { "type": "string" } } }
```
Coercion (applied first): if `isCorrect`, set `corrected = sentence`; if
`corrected.trim() === sentence.trim()`, set `isCorrect = true`; clamp the grades to 0–100.

Validators (after coercion):
- the grades are in range;
- `corrected` matches an idiom variant;
- `explanation` is ≤ 40 words and is not empty;
- all required fields are present.

The prompt rules are: change as little as possible, keep her meaning, explain *why* in
simple English, and be kind.

If it still fails or the model is offline: `status = "could_not_grade"`. No invented grade
is shown.

## Quality checks (map to SC-005, SC-006)
`tests/tutor/fixtures/tips-cases.json` (20 cases) and `tests/tutor/fixtures/grading-cases.json` (15
cases) feed an opt-in Vitest suite (`npm run test:tutor`) against the live local model. It
reports the pass rate for each criterion, and the target is ≥ 18/20 and ≥ 13/15.

# Contract: Curated content and settings files

## `content/idioms.json` (versioned, about 100 entries)

```json
{
  "version": "1.0.0",
  "idioms": [
    {
      "id": "break-the-ice",
      "phrase": "break the ice",
      "spoken": "break the ice",
      "variants": ["\\bbr(?:eak|eaks|oke|oken|eaking)\\s+the\\s+ice\\b"],
      "level": "A2",
      "difficulty": 1,
      "meaning": "to make people feel relaxed when they first meet",
      "whenToUse": "At parties, first days, or meetings when nobody is talking yet.",
      "register": "informal, OK at work",
      "region": "US and UK",
      "literalNote": "Nobody breaks real ice; it means ending an awkward silence.",
      "fallbackExamples": [
        "I told a funny story to break the ice.",
        "Games help kids break the ice on the first day.",
        "She broke the ice by asking about my dog."
      ]
    }
  ]
}
```

Rules, checked by `npm test` with `tests/unit/idioms.test.ts`:
- `id` is a unique kebab-case slug;
- `level ∈ {A2, B1}` and `difficulty ∈ {1, 2, 3}` (v1 serves 1–2);
- each `variants[]` entry compiles as a case-insensitive regex;
- `spoken` and every `fallbackExamples[i]` match at least one variant;
- there are exactly 3 `fallbackExamples`, each ≤ 15 words;
- `meaning` is ≤ 20 words and `whenToUse` is ≤ 25 words.

The list is human-curated (generated as a draft and then reviewed), and it is the only
source of idioms (Constitution IV).

## `config/settings.json`

```json
{
  "llm": { "baseUrl": "http://127.0.0.1:11434", "model": "gemma4:e2b", "temperature": 0.2,
           "timeoutMs": 20000, "keepAlive": -1 },
  "stt": { "baseUrl": "http://127.0.0.1:8765", "model": "small.en", "minSpeechSeconds": 0.5 },
  "scoring": { "accuracyWeight": 0.7, "clarityWeight": 0.3, "lowConfidenceThreshold": 0.6,
               "maxTips": 3 },
  "session": { "noRepeatDays": 60, "exampleMaxWords": 15 },
  "tutor": { "personality": "warm, patient, playful big-sister tutor who celebrates small wins" },
  "voice": {
    "external": { "provider": "elevenlabs", "voiceId": "<american-voice-id>",
                  "modelId": "eleven_flash_v2_5" },
    "localFallback": { "lang": "en-US", "preferredName": "Samantha" },
    "privacyNote": "When the natural voice is on, only the sentence to be spoken is sent to ElevenLabs. Your recordings and answers never leave this laptop."
  }
}
```

Rules:
- the weights sum to 1;
- the threshold is in (0, 1);
- `noRepeatDays` is ≥ 1.

Personal settings are **not** in this file. Level, difficulty range and the natural-voice
on/off switch live in the learner profile (DB, edited in Settings). The prompt's difficulty
label is derived from the profile range. The external voice is used only when the profile
switch is on **and** `ELEVENLABS_API_KEY` is set (research R14).

The file is loaded on every request, so edits apply without code changes (FR-023). Secrets
are never put in this file: `ELEVENLABS_API_KEY` lives in `.env.local` (gitignored).

## `prompts/*.md`
`system.md`, `examples.md`, `tips.md`, `grading.md` and `praise.md` (a list of short
positive lines, one per line). Variables use `{{name}}`, and an unknown variable is an
error at load time.

# Contract: Local speech service (Python sidecar)

- Process: `uv run --project stt uvicorn app:app --host 127.0.0.1 --port 8765`, with env
  `HF_HUB_OFFLINE=1`.
- The service binds to localhost only. It is called **only** by the Next.js server, never
  directly by the browser.
- Audio is processed in memory and never written to disk or logged.

## `GET /health`
`200 { "status": "ok", "model": "small.en", "device": "cpu", "computeType": "int8" }`
`503` while the model is loading.

## `POST /transcribe` (multipart/form-data)
Fields: `audio` (any container/codec PyAV can decode; normally `audio/webm;codecs=opus`).

Decoding parameters (fixed, for repeatability; see research R2): `language="en"`,
`temperature=0.0`, `beam_size=5`, `condition_on_previous_text=False`,
`word_timestamps=True`, `vad_filter=True`.

`200`:
```json
{
  "text": "It was a piece of cape.",
  "words": [
    { "word": "It", "start": 0.32, "end": 0.48, "probability": 0.98 },
    { "word": "cape.", "start": 1.60, "end": 1.94, "probability": 0.41 }
  ],
  "speechSeconds": 1.62,
  "durationSeconds": 2.53
}
```
- `words[].word` is the merged word with surrounding whitespace stripped. Punctuation may
  remain attached; the Node scorer normalizes it.
- `probability` is in 0–1, rounded to 3 decimals.
- `speechSeconds` is `info.duration_after_vad`. The Node side rejects the recording when
  it is < `minSpeechSeconds` (0.5) or `words` is empty.

Errors: `400 {"error":"unreadable"}` if decoding fails; `413` if the upload is over 2 MB.

## Dependencies (pinned in `stt/pyproject.toml`)
`python = ">=3.12,<3.13"`, `faster-whisper ~= 1.2`, `av < 17` (PyAV 19 breaks
`decode_audio`), `fastapi`, `uvicorn`, `python-multipart`. The Whisper size comes from
the `STT_MODEL` env var, set by `npm run dev` from `config/settings.json` (default
`small.en`).

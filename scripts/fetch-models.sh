#!/usr/bin/env bash
# Pre-download the Whisper model so the speech helper works offline afterwards (research R2).
set -euo pipefail
cd "$(dirname "$0")/.."
MODEL="${STT_MODEL:-$(node -p "require('./config/settings.json').stt.model")}"
echo "Downloading Whisper model '$MODEL' (one time)…"
uv run --project stt python -c "from faster_whisper import WhisperModel; WhisperModel('$MODEL', device='cpu', compute_type='int8'); print('ok')"

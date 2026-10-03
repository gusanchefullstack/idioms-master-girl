"""Local speech-to-text sidecar for IdiomsMasterGirl (contracts/stt-service.md).

Binds to 127.0.0.1 only. Audio is decoded in memory and never written to disk or logged.
"""

import io
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("STT_MODEL", "small.en")
MAX_BYTES = 2 * 1024 * 1024

state: dict = {"model": None}
# CTranslate2 models are not safe to call from many threads at once; one request at a time is fine for one user.
lock = threading.Lock()


def load_model() -> None:
    state["model"] = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=load_model, daemon=True).start()
    yield


app = FastAPI(title="idioms-stt", lifespan=lifespan)


@app.get("/health")
def health():
    if state["model"] is None:
        return JSONResponse({"status": "loading", "model": MODEL_NAME}, status_code=503)
    return {"status": "ok", "model": MODEL_NAME, "device": "cpu", "computeType": "int8"}


def transcribe_bytes(data: bytes) -> dict:
    model: WhisperModel = state["model"]
    with lock:
        # Fixed decoding settings for repeatable scores (research R2, SC-004).
        segments, info = model.transcribe(
            io.BytesIO(data),
            language="en",
            temperature=0.0,
            beam_size=5,
            condition_on_previous_text=False,
            word_timestamps=True,
            vad_filter=True,
        )
        words = [
            {
                "word": w.word.strip(),
                "start": round(w.start, 2),
                "end": round(w.end, 2),
                "probability": round(float(w.probability), 3),
            }
            for seg in segments
            for w in (seg.words or [])
            if w.word.strip()
        ]
    return {
        "text": " ".join(w["word"] for w in words),
        "words": words,
        "speechSeconds": round(float(getattr(info, "duration_after_vad", info.duration)), 3),
        "durationSeconds": round(float(info.duration), 3),
    }


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if state["model"] is None:
        return JSONResponse({"error": "loading"}, status_code=503)
    data = await audio.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        return JSONResponse({"error": "too_large"}, status_code=413)
    try:
        return transcribe_bytes(data)
    except Exception:  # undecodable / empty container
        return JSONResponse({"error": "unreadable"}, status_code=400)

"""Offline smoke test for the sidecar (constitution: smoke check per core feature)."""

import os
import pathlib

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import pytest
from fastapi.testclient import TestClient

import app as stt_app

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "clip.webm"


@pytest.fixture(scope="module")
def client():
    stt_app.load_model()
    with TestClient(stt_app.app) as c:
        yield c


def post(client, data: bytes):
    return client.post("/transcribe", files={"audio": ("clip.webm", data, "audio/webm")})


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_transcribes_fixture_with_word_confidence(client):
    res = post(client, FIXTURE.read_bytes())
    assert res.status_code == 200
    body = res.json()
    words = [w["word"].strip(".,!?").lower() for w in body["words"]]
    assert len(words) >= 9
    assert "cake" in words
    cake = next(w for w in body["words"] if w["word"].strip(".,!?").lower() == "cake")
    assert cake["probability"] > 0.6
    assert body["speechSeconds"] > 0.5


def test_repeatable(client):
    a = post(client, FIXTURE.read_bytes()).json()
    b = post(client, FIXTURE.read_bytes()).json()
    assert a["words"] == b["words"]


def test_garbage_is_unreadable(client):
    res = post(client, b"this is not audio at all")
    assert res.status_code == 400
    assert res.json() == {"error": "unreadable"}

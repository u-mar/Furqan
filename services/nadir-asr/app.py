"""
Nadir's speech service: a recitation in, and out either the words recited or
the ayat they came from.

  GET  /            health: whether the model and the Quran text are loaded
  POST /transcribe  multipart form, field "audio" → JSON (see TranscribeResult)
  POST /mark        multipart form, field "audio" → JSON (see MarkResult)

Set ASR_API_KEY to protect it: /transcribe then needs the header
`x-api-key: <key>`, and /mark needs that or `x-marking-token`, the short-lived
permission the app's server gives a phone (app/api/qari/marking-access), so
phones can send recordings straight here without ever holding the key.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import threading
import time
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from audio import AudioError, decode
from features import SAMPLE_RATE
from marking import Marker, load_marker
from recognizer import Recognizer, load_from_env

MAX_UPLOAD_BYTES = 30 * 1024 * 1024
MAX_DURATION_SEC = 15 * 60
# Phones send recordings straight here, so the browser has to be told it may.
SITE_ORIGINS = ["https://qurannaba.com", "https://www.qurannaba.com", "http://localhost:3000"]

_recognizer: Recognizer | None = None
_marker: Marker | None = None
_load_error: str | None = None
_lock = threading.Lock()


def recognizer() -> Recognizer:
    """Loaded once, on the first request or at startup, then shared."""
    global _recognizer, _load_error
    if _recognizer is None:
        with _lock:
            if _recognizer is None:
                try:
                    _recognizer = load_from_env()
                    _load_error = None
                except Exception as err:  # noqa: BLE001 — reported by the health check
                    _load_error = str(err)
                    raise
    return _recognizer


def marker() -> Marker:
    """The Quran text and the model's vocabulary, ready to match against. Loaded once, then shared."""
    global _marker, _load_error
    if _marker is None:
        model = recognizer()
        with _lock:
            if _marker is None:
                try:
                    pieces = [model.tokenizer.id_to_piece(i) for i in range(model.blank_id)]
                    _marker = load_marker(pieces, model.blank_id)
                    _load_error = None
                except Exception as err:  # noqa: BLE001 — reported by the health check
                    _load_error = str(err)
                    raise
    return _marker


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Loading at start means the first real request doesn't wait for it.
    try:
        await run_in_threadpool(marker)
    except Exception:  # noqa: BLE001 — the health check reports it
        pass
    yield


app = FastAPI(title="nadir-asr", docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=SITE_ORIGINS, allow_methods=["POST"], allow_headers=["x-marking-token"], max_age=86400)


class WordOut(BaseModel):
    word: str
    start: float
    end: float


class TranscribeResult(BaseModel):
    text: str
    words: list[WordOut]
    durationSec: float
    confidence: float
    elapsedMs: int


class AyahOut(BaseModel):
    verseKey: str
    atSeconds: float
    words: list[float] | None = None


class MarkResult(BaseModel):
    # Left out when nothing could be matched to the Quran with confidence.
    timeline: list[AyahOut] | None = None
    coverage: float
    durationSec: float
    elapsedMs: int


@app.get("/")
def health() -> dict:
    return {"ok": _recognizer is not None and _marker is not None, "error": _load_error}


def _key_matches(given: str | None, expected: str) -> bool:
    return hmac.compare_digest((given or "").encode(), expected.encode())


def _token_is_valid(token: str | None, key: str) -> bool:
    """`<expiry in unix seconds>.<signature>`, as signed by app/api/qari/marking-access."""
    expires, _, signature = (token or "").partition(".")
    if not expires.isdigit() or int(expires) < time.time():
        return False
    expected = hmac.new(key.encode(), f"mark:{expires}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature.encode(), expected.encode())


async def _read_samples(audio: UploadFile) -> np.ndarray:
    data = await audio.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="No audio was sent.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That recording is too large.")
    try:
        # Decoding and recognising are CPU work: off the event loop, so a second request can run alongside.
        samples = await run_in_threadpool(decode, data)
    except AudioError as err:
        raise HTTPException(status_code=415, detail=str(err)) from err
    if len(samples) > MAX_DURATION_SEC * SAMPLE_RATE:
        raise HTTPException(status_code=413, detail="That recording is too long.")
    return samples


@app.post("/transcribe", response_model=TranscribeResult)
async def transcribe(audio: UploadFile = File(...), x_api_key: str | None = Header(default=None)) -> TranscribeResult:
    expected = os.environ.get("ASR_API_KEY")
    if expected and not _key_matches(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Missing or wrong API key.")

    started = time.perf_counter()
    samples = await _read_samples(audio)
    try:
        model = recognizer()
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"The model is not loaded: {err}") from err

    result = await run_in_threadpool(model.transcribe, samples)
    return TranscribeResult(
        text=result.text,
        words=[WordOut(word=w.word, start=w.start, end=w.end) for w in result.words],
        durationSec=result.duration,
        confidence=round(result.confidence, 4),
        elapsedMs=int((time.perf_counter() - started) * 1000),
    )


@app.post("/mark", response_model=MarkResult, response_model_exclude_none=True)
async def mark(
    audio: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
    x_marking_token: str | None = Header(default=None),
) -> MarkResult:
    expected = os.environ.get("ASR_API_KEY")
    if expected and not (_key_matches(x_api_key, expected) or _token_is_valid(x_marking_token, expected)):
        raise HTTPException(status_code=401, detail="Missing or expired permission.")

    started = time.perf_counter()
    samples = await _read_samples(audio)
    try:
        model = recognizer()
        ayat = marker()
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"The model is not loaded: {err}") from err

    result = await run_in_threadpool(model.transcribe, samples, None, True)
    timeline, coverage = await run_in_threadpool(ayat.mark, result.words, result.emissions, result.duration)
    return MarkResult(
        timeline=timeline,
        coverage=round(coverage, 4),
        durationSec=result.duration,
        elapsedMs=int((time.perf_counter() - started) * 1000),
    )

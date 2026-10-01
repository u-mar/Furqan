"""
Nadir's speech service: a recitation in, the words recited out, with the time
each word starts and ends. Matching those words to ayat happens in the Nadir
app's own server, which has the Quran text; this service only listens.

  GET  /            health: whether the model is loaded
  POST /transcribe  multipart form, field "audio" → JSON (see TranscribeResult)

Set ASR_API_KEY to require the header `x-api-key: <key>` on /transcribe, so
only Nadir's server can use it.
"""

from __future__ import annotations

import hmac
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from audio import AudioError, decode
from features import SAMPLE_RATE
from recognizer import Recognizer, load_from_env

MAX_UPLOAD_BYTES = 30 * 1024 * 1024
MAX_DURATION_SEC = 15 * 60

_recognizer: Recognizer | None = None
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Loading at start means the first real request doesn't wait for it.
    try:
        await run_in_threadpool(recognizer)
    except Exception:  # noqa: BLE001 — the health check reports it
        pass
    yield


app = FastAPI(title="nadir-asr", docs_url=None, redoc_url=None, lifespan=lifespan)


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


@app.get("/")
def health() -> dict:
    return {"ok": _recognizer is not None, "error": _load_error}


@app.post("/transcribe", response_model=TranscribeResult)
async def transcribe(audio: UploadFile = File(...), x_api_key: str | None = Header(default=None)) -> TranscribeResult:
    expected = os.environ.get("ASR_API_KEY")
    if expected and not hmac.compare_digest(x_api_key or "", expected):
        raise HTTPException(status_code=401, detail="Missing or wrong API key.")

    data = await audio.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="No audio was sent.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That recording is too large.")

    started = time.perf_counter()
    try:
        # Decoding and recognising are CPU work: off the event loop, so a second request can run alongside.
        samples = await run_in_threadpool(decode, data)
    except AudioError as err:
        raise HTTPException(status_code=415, detail=str(err)) from err
    if len(samples) > MAX_DURATION_SEC * SAMPLE_RATE:
        raise HTTPException(status_code=413, detail="That recording is too long.")

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

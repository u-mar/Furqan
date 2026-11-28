"""
Runs the speech service (app.py) on Modal, as an alternative to Cloud Run.

From this folder:  python -m modal deploy modal_app.py
The steps are in README.md, under "Or deploy to Modal".
"""

import hashlib
import hmac
import os
import sys
import time
import uuid
from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
CODE_DIR = "/srv/nadir-asr"
MODEL_DIR = "/srv/nadir-asr-model"

# The file the phones download. Modal fetches it while building, so nothing big is uploaded from this computer.
MODEL_URL = "https://pub-0d4d974a9cad4a92b81667e5b4f5523f.r2.dev/model.onnx"
# Git-ignored, so deploy from a computer that has it.
TOKENIZER = HERE.parent.parent / "public" / "models" / "asr" / "tokenizer.model"
QURAN_DATA = HERE.parent.parent / "public" / "quran-data.json"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "ffmpeg")
    .pip_install_from_requirements(str(HERE / "requirements.txt"))
    .run_commands(f"mkdir -p {MODEL_DIR}", f"curl -fsSL --retry 5 -o {MODEL_DIR}/model.onnx {MODEL_URL}")
    .env(
        {
            "MODEL_DIR": MODEL_DIR,
            # A container can see far more cores than it is given. More threads than cores is slower and costs more.
            "ORT_THREADS": "2",
        }
    )
    .add_local_file(str(TOKENIZER), f"{MODEL_DIR}/tokenizer.model")
    .add_local_file(str(QURAN_DATA), f"{MODEL_DIR}/quran-data.json")
)
for name in ("app.py", "audio.py", "features.py", "listen_check.py", "marking.py", "recognizer.py"):
    image = image.add_local_file(str(HERE / name), f"{CODE_DIR}/{name}")

app = modal.App("nadir-asr")

# Listen qaris (Admin → Listen qaris): an uploaded surah waits here for its check, and the check's
# progress and report are kept by job id until the app's server has read them.
uploads = modal.Volume.from_name("naba-listen-uploads", create_if_missing=True)
jobs = modal.Dict.from_name("naba-listen-jobs", create_if_missing=True)
UPLOADS = "/uploads"
MAX_SURAH_BYTES = 400 * 1024 * 1024


@app.function(
    image=image,
    cpu=(2.0, 4.0),
    memory=(4096, 8192),
    # Al-Baqarah is about two hours of audio.
    timeout=3600,
    max_containers=2,
    volumes={UPLOADS: uploads},
    secrets=[modal.Secret.from_name("nadir-asr-key")],
)
def check_surah(job: str, surah: int, put_url: str) -> None:
    sys.path.insert(0, CODE_DIR)
    from app import marker, recognizer
    from listen_check import run_check

    def progress(step: str) -> None:
        jobs[job] = {"status": "checking", "step": step, "updatedAt": time.time()}

    uploads.reload()
    path = f"{UPLOADS}/{job}"
    try:
        report = run_check(path, surah, put_url, recognizer(), marker(), progress)
        jobs[job] = {"status": "done", "report": report, "updatedAt": time.time()}
    except Exception as err:  # noqa: BLE001 — the admin sees what went wrong
        jobs[job] = {"status": "failed", "error": str(err)[:500], "updatedAt": time.time()}
    finally:
        try:
            os.remove(path)
            uploads.commit()
        except OSError:
            pass


def _listen_token_ok(token: str, job: str, surah: int, put_url: str) -> bool:
    """`<expiry>.<signature>`, signed by the app's server (lib/listen-qaris-server.ts) for this one upload."""
    key = os.environ.get("ASR_API_KEY", "")
    expires, _, signature = (token or "").partition(".")
    if not key or not expires.isdigit() or int(expires) < time.time():
        return False
    target = hashlib.sha256(put_url.encode()).hexdigest()
    expected = hmac.new(key.encode(), f"listen:{job}:{surah}:{expires}:{target}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature.encode(), expected.encode())


def _add_listen_routes(service) -> None:
    from fastapi import File, Form, Header, HTTPException, UploadFile

    @service.post("/listen/upload")
    async def listen_upload(
        audio: UploadFile = File(...),
        job: str = Form(...),
        surah: int = Form(...),
        putUrl: str = Form(...),
        token: str = Form(...),
    ) -> dict:
        try:
            uuid.UUID(job)
        except ValueError as err:
            raise HTTPException(status_code=400, detail="Bad job id.") from err
        if not 1 <= surah <= 114 or not _listen_token_ok(token, job, surah, putUrl):
            raise HTTPException(status_code=401, detail="Missing or expired permission.")
        path = f"{UPLOADS}/{job}"
        size = 0
        with open(path, "wb") as out:
            while chunk := await audio.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_SURAH_BYTES:
                    out.close()
                    os.remove(path)
                    raise HTTPException(status_code=413, detail="That file is too large (400 MB at most).")
                out.write(chunk)
        uploads.commit()
        jobs[job] = {"status": "queued", "step": "Waiting to start", "updatedAt": time.time()}
        check_surah.spawn(job, surah, putUrl)
        return {"job": job}

    @service.get("/listen/status/{job}")
    def listen_status(job: str, x_api_key: str | None = Header(default=None)) -> dict:
        key = os.environ.get("ASR_API_KEY", "")
        if not key or not hmac.compare_digest((x_api_key or "").encode(), key.encode()):
            raise HTTPException(status_code=401, detail="Missing or wrong API key.")
        return jobs.get(job) or {"status": "unknown"}


@app.function(
    image=image,
    cpu=(2.0, 3.0),
    memory=2048,
    # Seconds, per recording. A web request still running after 150 seconds gets a 303 redirect to wait on,
    # so whatever calls this has to follow redirects.
    timeout=600,
    max_containers=2,
    # Deploying fails without this secret, so the service is never open to anyone who finds the link.
    secrets=[modal.Secret.from_name("nadir-asr-key")],
    volumes={UPLOADS: uploads},
)
@modal.concurrent(max_inputs=2)
@modal.asgi_app()
def web():
    sys.path.insert(0, CODE_DIR)
    from app import app as service

    _add_listen_routes(service)
    return service

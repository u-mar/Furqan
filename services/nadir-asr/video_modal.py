"""
Makes recitations' English share videos ahead of time, so "Save video" downloads a ready file
instead of the phone spending a minute making a big one.

Each video is made by the app's own video maker (app/render-video), opened in Google Chrome
without a screen, so it looks exactly like one made on a phone. The cloud then re-encodes it
carefully (x264, slow preset): about a third of the size at the same look. The file goes to R2 at
videos/en/<recitation id>.mp4, and the site is told where it is.

    python -m modal deploy services/nadir-asr/video_modal.py

Secrets: nadir-asr-key (ASR_API_KEY, the key callers send as x-api-key, the same one as the speech
service) and naba-r2 (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL).
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.request

import modal

SITE = "https://qurannaba.com"
# x264 settings: CRF 26 at the slow preset measured 8.7 MB against the phone's 34.9 MB for the same
# recitation, with no visible difference (PSNR 48 dB).
CRF = "26"
PRESET = "slow"
AUDIO_BITRATE = "128k"
RENDER_TIMEOUT_S = 15 * 60

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "fonts-noto-core", "curl", "ca-certificates")
    # Google Chrome, not Chromium: the app makes H.264 with the browser's own encoder (WebCodecs),
    # which Chromium builds leave out. Playwright drives it ("chrome" channel).
    .run_commands(
        "curl -fsSL --retry 5 -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb",
        "apt-get update && apt-get install -y /tmp/chrome.deb && rm /tmp/chrome.deb",
    )
    .pip_install("playwright==1.49.1", "boto3==1.35.90", "fastapi[standard]==0.115.6")
)

app = modal.App("naba-video")

with image.imports():
    from fastapi import Request


def _key_for(recitation_id: str) -> str:
    """A new name for every video made: a remade one is never served from an old cached copy."""
    return f"videos/en/{recitation_id}-{int(time.time() * 1000):x}.mp4"


async def _make_master(site: str, recitation_id: str) -> tuple[bytes, float, str]:
    """The video as the app makes it (1080p, high rate), the seconds it took, and what it was made for."""
    from playwright.async_api import async_playwright

    started = time.time()
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage"],
        )
        try:
            page = await browser.new_page(viewport={"width": 420, "height": 860})
            logs: list[str] = []
            page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"[:300]))
            await page.goto(f"{site}/render-video?id={recitation_id}", wait_until="domcontentloaded", timeout=120_000)
            await page.wait_for_function(
                "() => { const s = window.__nabaVideoState || ''; return s === 'done' || s.startsWith('error') }",
                timeout=RENDER_TIMEOUT_S * 1000,
                polling=1000,
            )
            state = await page.evaluate("window.__nabaVideoState")
            if state != "done":
                raise RuntimeError(f"{state}; console: {' | '.join(logs[-8:])}")
            made_for = await page.evaluate("window.__nabaVideoMadeFor || ''")
            size = await page.evaluate("window.__nabaVideo.size")
            chunks: list[bytes] = []
            step = 4 * 1024 * 1024
            for offset in range(0, size, step):
                piece = await page.evaluate(
                    """async ([a, b]) => {
                        const bytes = new Uint8Array(await window.__nabaVideo.slice(a, b).arrayBuffer())
                        let s = ''
                        for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768))
                        return btoa(s)
                    }""",
                    [offset, offset + step],
                )
                chunks.append(base64.b64decode(piece))
            return b"".join(chunks), time.time() - started, made_for
        finally:
            await browser.close()


def _reencode(master: bytes) -> tuple[bytes, float]:
    """The same video, much smaller: x264 at CRF 26, AAC sound, ready to play while downloading."""
    started = time.time()
    with tempfile.TemporaryDirectory() as folder:
        src, dst = os.path.join(folder, "master.mp4"), os.path.join(folder, "out.mp4")
        with open(src, "wb") as f:
            f.write(master)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", src,
             "-c:v", "libx264", "-preset", PRESET, "-crf", CRF, "-pix_fmt", "yuv420p", "-profile:v", "high",
             "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-movflags", "+faststart", dst],
            check=True,
        )
        with open(dst, "rb") as f:
            return f.read(), time.time() - started


def _upload(key: str, data: bytes) -> str:
    import boto3

    account = os.environ["R2_ACCOUNT_ID"]
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    client.put_object(
        Bucket=os.environ["R2_BUCKET"], Key=key, Body=data, ContentType="video/mp4",
        CacheControl="public, max-age=31536000, immutable",
    )
    return f"{os.environ['R2_PUBLIC_URL'].rstrip('/')}/{key}"


def _tell_site(site: str, recitation_id: str, key: str, made_for: str) -> bool:
    """Records the ready video on the recitation (POST /api/qari/<id>/video); False if it was out of date."""
    body = json.dumps({"key": key, "madeFor": made_for}).encode()
    req = urllib.request.Request(
        f"{site}/api/qari/{recitation_id}/video", data=body, method="POST",
        headers={"content-type": "application/json", "x-api-key": os.environ["ASR_API_KEY"], "user-agent": "naba-video"},
    )
    return bool(json.load(urllib.request.urlopen(req, timeout=60)).get("kept"))


@app.function(
    image=image,
    cpu=4.0,
    memory=6144,
    timeout=RENDER_TIMEOUT_S + 300,
    max_containers=2,
    secrets=[modal.Secret.from_name("nadir-asr-key"), modal.Secret.from_name("naba-r2")],
)
async def render(recitation_id: str, site: str = SITE, tell: bool = True) -> dict:
    master, render_s, made_for = await _make_master(site, recitation_id)
    small, encode_s = _reencode(master)
    key = _key_for(recitation_id)
    url = _upload(key, small)
    kept = _tell_site(site, recitation_id, key, made_for) if tell else None
    result = {
        "id": recitation_id, "url": url, "kept": kept, "bytes": len(small), "masterBytes": len(master),
        "renderSeconds": round(render_s, 1), "encodeSeconds": round(encode_s, 1),
    }
    print(json.dumps(result))
    return result


@app.function(image=image, timeout=120)
async def can_encode() -> dict:
    """Whether Chrome here can make the app's video at all (H.264 through WebCodecs)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        page = await browser.new_page()
        await page.goto(SITE, wait_until="domcontentloaded")  # WebCodecs needs a secure page
        result = await page.evaluate(
            """async () => ({
                version: navigator.userAgent,
                avc: (await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 720, height: 1280, bitrate: 6e6, framerate: 24 })).supported,
                aac: typeof AudioEncoder !== 'undefined' && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128000 })).supported,
            })"""
        )
        await browser.close()
        print(json.dumps(result))
        return result


@app.function(image=image, secrets=[modal.Secret.from_name("nadir-asr-key")], timeout=60)
@modal.fastapi_endpoint(method="POST")
async def start(request: Request) -> dict:
    """POST {"id": "<recitation id>"} with x-api-key: starts making that recitation's video and returns at once."""
    import hmac
    import re

    from fastapi import HTTPException

    expected = os.environ.get("ASR_API_KEY", "")
    given = request.headers.get("x-api-key", "")
    if not expected or not hmac.compare_digest(given, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    recitation_id = str(body.get("id", ""))
    if not re.fullmatch(r"[a-f0-9]{24}", recitation_id):
        raise HTTPException(status_code=400, detail="Bad id")
    await render.spawn.aio(recitation_id)
    return {"started": recitation_id}

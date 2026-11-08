"""
Runs the speech service (app.py) on Modal, as an alternative to Cloud Run.

From this folder:  python -m modal deploy modal_app.py
The steps are in README.md, under "Or deploy to Modal".
"""

import sys
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
    .apt_install("curl")
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
for name in ("app.py", "audio.py", "features.py", "marking.py", "recognizer.py"):
    image = image.add_local_file(str(HERE / name), f"{CODE_DIR}/{name}")

app = modal.App("nadir-asr")


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
)
@modal.concurrent(max_inputs=2)
@modal.asgi_app()
def web():
    sys.path.insert(0, CODE_DIR)
    from app import app as service

    return service

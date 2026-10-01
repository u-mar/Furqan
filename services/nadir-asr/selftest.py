"""
Checks the model before deploying: transcribes audio files (the model's own
`demo/` clips are ideal) under every feature setting, and shows which one the
model is most confident with — that is the one it was trained on.

    python selftest.py model/demo

Put the winning settings in the Dockerfile (FEATURE_WINDOW, FEATURE_PAD,
FEATURE_NORMALIZE) if they differ from the defaults.
"""

from __future__ import annotations

import itertools
import os
import sys
import time

from audio import decode
from features import FeatureConfig
from recognizer import load_from_env

AUDIO_EXT = (".wav", ".mp3", ".m4a", ".ogg", ".opus", ".webm", ".flac")


def main() -> None:
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join("model", "demo")
    files = sorted(os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith(AUDIO_EXT))
    if not files:
        sys.exit(f"No audio files in {folder}")
    recognizer = load_from_env()
    clips = [(os.path.basename(f), decode(open(f, "rb").read())) for f in files]

    results = []
    for window, pad, normalize in itertools.product(("periodic", "symmetric"), ("reflect", "constant"), ("per_feature", "none")):
        config = FeatureConfig(window=window, pad=pad, normalize=normalize)
        started = time.perf_counter()
        outputs = [(name, recognizer.transcribe(samples, config)) for name, samples in clips]
        confidence = sum(t.confidence for _, t in outputs) / len(outputs)
        results.append((confidence, config, outputs, time.perf_counter() - started))

    results.sort(key=lambda r: r[0], reverse=True)
    for confidence, config, outputs, seconds in results:
        print(f"\n=== window={config.window} pad={config.pad} normalize={config.normalize}  confidence={confidence:.3f}  ({seconds:.1f}s)")
        for name, transcript in outputs:
            print(f"  {name}: {transcript.text}")

    best = results[0][1]
    print("\nMost confident settings:")
    print(f"  FEATURE_WINDOW={best.window}  FEATURE_PAD={best.pad}  FEATURE_NORMALIZE={best.normalize}")
    print("Check that its transcriptions read correctly (the demo clips are Q 1:4, 112:1 and 38:67).")


if __name__ == "__main__":
    main()

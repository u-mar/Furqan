"""
Turns whatever the phone recorded (WebM/Opus on Android, M4A/AAC on iPhone,
MP3, WAV…) into 16 kHz mono float32, using PyAV. PyAV's wheels carry their
own FFmpeg, so the container needs no system packages.
"""

from __future__ import annotations

import io

import av
import numpy as np

from features import SAMPLE_RATE


class AudioError(ValueError):
    pass


def decode(data: bytes) -> np.ndarray:
    try:
        container = av.open(io.BytesIO(data))
    except Exception as err:  # noqa: BLE001 — any unreadable file is the same answer
        raise AudioError("That file could not be read as audio.") from err

    with container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise AudioError("There is no audio in that file.")
        resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
        parts: list[np.ndarray] = []
        try:
            for frame in container.decode(stream):
                for out in resampler.resample(frame):
                    parts.append(out.to_ndarray().reshape(-1))
            for out in resampler.resample(None):  # what the resampler still holds
                parts.append(out.to_ndarray().reshape(-1))
        except av.FFmpegError as err:
            raise AudioError("The audio is damaged.") from err

    if not parts:
        raise AudioError("The recording is empty.")
    return np.concatenate(parts).astype(np.float32)

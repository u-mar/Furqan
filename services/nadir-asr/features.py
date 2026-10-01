"""
Log-mel features for Muno459/fastconformer-quran, in plain NumPy (no torch),
so the container stays small.

The pipeline is the one this model family was trained on: preemphasis 0.97,
a 25 ms Hann window every 10 ms (n_fft 512), power spectrum, 80 Slaney mel
bins, ln(x + 2**-24), then per-feature normalisation. The same steps as the
app's own phone-side extractor (lib/asr/log-mel.ts), which was checked
against torchaudio to float precision.

Three details differ between toolkits, so they are settings rather than
guesses. `selftest.py` runs the model's demo clips under every combination
and says which one the model is most confident with:

  FEATURE_WINDOW     periodic | symmetric   (torchaudio uses periodic, NeMo symmetric)
  FEATURE_PAD        reflect | constant     (how the edges are padded)
  FEATURE_NORMALIZE  per_feature | none     (offline models normalise each mel bin)
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np

SAMPLE_RATE = 16_000
N_FFT = 512
WIN_LENGTH = 400  # 25 ms
HOP_LENGTH = 160  # 10 ms
N_MELS = 80
PREEMPH = 0.97
LOG_EPS = 2.0**-24
NORM_EPS = 1e-5


@dataclass(frozen=True)
class FeatureConfig:
    window: str = "periodic"
    pad: str = "reflect"
    normalize: str = "per_feature"

    @staticmethod
    def from_env() -> "FeatureConfig":
        return FeatureConfig(
            window=os.environ.get("FEATURE_WINDOW", "periodic"),
            pad=os.environ.get("FEATURE_PAD", "reflect"),
            normalize=os.environ.get("FEATURE_NORMALIZE", "per_feature"),
        )


def _hz_to_mel(hz: np.ndarray) -> np.ndarray:
    """Slaney mel scale (librosa htk=False)."""
    f_sp = 200.0 / 3
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    hz = np.asarray(hz, dtype=np.float64)
    return np.where(hz < min_log_hz, hz / f_sp, min_log_mel + np.log(np.maximum(hz, 1e-10) / min_log_hz) / logstep)


def _mel_to_hz(mel: np.ndarray) -> np.ndarray:
    f_sp = 200.0 / 3
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    mel = np.asarray(mel, dtype=np.float64)
    return np.where(mel < min_log_mel, f_sp * mel, min_log_hz * np.exp(logstep * (mel - min_log_mel)))


def _mel_filterbank() -> np.ndarray:
    """(N_MELS, N_FFT/2+1) triangular filters, Slaney area-normalised."""
    n_freqs = N_FFT // 2 + 1
    mels = np.linspace(_hz_to_mel(0.0), _hz_to_mel(SAMPLE_RATE / 2), N_MELS + 2)
    hz = _mel_to_hz(mels)
    bins = np.arange(n_freqs) * SAMPLE_RATE / N_FFT
    fb = np.zeros((N_MELS, n_freqs))
    for m in range(N_MELS):
        left, center, right = hz[m], hz[m + 1], hz[m + 2]
        rising = (bins - left) / (center - left)
        falling = (right - bins) / (right - center)
        fb[m] = np.maximum(0.0, np.minimum(rising, falling)) * (2.0 / (right - left))
    return fb


_MEL_FB = _mel_filterbank()


def _window(kind: str) -> np.ndarray:
    n = np.arange(WIN_LENGTH)
    denom = WIN_LENGTH if kind == "periodic" else WIN_LENGTH - 1
    return 0.5 - 0.5 * np.cos(2 * np.pi * n / denom)


def log_mel(samples: np.ndarray, config: FeatureConfig | None = None) -> np.ndarray:
    """
    samples: mono float32 PCM at 16 kHz.
    Returns (N_MELS, T) float32, the model's `audio_signal` layout once given a batch axis.
    """
    config = config or FeatureConfig.from_env()
    x = np.asarray(samples, dtype=np.float32)
    if x.size == 0:
        return np.zeros((N_MELS, 0), dtype=np.float32)

    x = np.concatenate([x[:1], x[1:] - PREEMPH * x[:-1]]).astype(np.float32)

    pad = N_FFT // 2
    x = np.pad(x, pad, mode="reflect" if config.pad == "reflect" and x.size > pad else "constant")

    n_frames = 1 + (x.size - N_FFT) // HOP_LENGTH
    # The shorter window sits centred inside each n_fft frame, as torch.stft places it.
    win = np.zeros(N_FFT)
    left = (N_FFT - WIN_LENGTH) // 2
    win[left : left + WIN_LENGTH] = _window(config.window)

    idx = np.arange(N_FFT)[None, :] + HOP_LENGTH * np.arange(n_frames)[:, None]
    frames = x[idx] * win[None, :]
    power = np.abs(np.fft.rfft(frames, n=N_FFT, axis=1)) ** 2  # (T, n_freqs)
    mel = np.log(power @ _MEL_FB.T + LOG_EPS).T  # (N_MELS, T)

    if config.normalize == "per_feature" and mel.shape[1] > 1:
        mean = mel.mean(axis=1, keepdims=True)
        std = mel.std(axis=1, ddof=1, keepdims=True) + NORM_EPS
        mel = (mel - mean) / std

    return mel.astype(np.float32)

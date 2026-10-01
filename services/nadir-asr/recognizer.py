"""
Runs Muno459/fastconformer-quran (ONNX, CTC) over a recording and returns
what was recited, with when each word starts and ends.

Long recordings are cut into pieces of at most MAX_CHUNK_SEC, at the
quietest moment near each cut (reciters pause between ayat), so memory stays
flat however long the recitation is; each piece's times are moved back into
place afterwards.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

import numpy as np
import onnxruntime as ort
import sentencepiece as spm

from features import HOP_LENGTH, SAMPLE_RATE, FeatureConfig, log_mel

MAX_CHUNK_SEC = 40.0
MIN_CHUNK_SEC = 25.0


@dataclass
class Word:
    word: str
    start: float
    end: float


@dataclass
class Transcript:
    text: str
    words: list[Word] = field(default_factory=list)
    duration: float = 0.0
    confidence: float = 0.0


class Recognizer:
    def __init__(self, model_path: str, tokenizer_path: str, threads: int | None = None):
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads or int(os.environ.get("ORT_THREADS", "0")) or os.cpu_count() or 2
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(model_path, options, providers=["CPUExecutionProvider"])

        inputs = self.session.get_inputs()
        self.signal_name = inputs[0].name
        self.length_name = inputs[1].name if len(inputs) > 1 else None
        self.signal_dtype = np.float16 if "float16" in inputs[0].type else np.float32
        # The CTC output is the one whose last axis is the vocabulary (1,024 pieces + blank).
        outputs = self.session.get_outputs()
        self.logprobs_name = next((o.name for o in outputs if o.name == "logprobs"), outputs[0].name)

        self.tokenizer = spm.SentencePieceProcessor(model_file=tokenizer_path)
        self.blank_id = self.tokenizer.get_piece_size()  # the blank comes after every real piece

    # ------------------------------------------------------------------ public

    def transcribe(self, samples: np.ndarray, config: FeatureConfig | None = None) -> Transcript:
        duration = len(samples) / SAMPLE_RATE
        words: list[Word] = []
        texts: list[str] = []
        confidences: list[float] = []
        for start, piece in self._chunks(samples):
            part = self._transcribe_piece(piece, config)
            offset = start / SAMPLE_RATE
            words.extend(Word(w.word, round(w.start + offset, 3), round(w.end + offset, 3)) for w in part.words)
            if part.text:
                texts.append(part.text)
            confidences.append(part.confidence)
        return Transcript(
            text=" ".join(texts),
            words=words,
            duration=round(duration, 3),
            confidence=float(np.mean(confidences)) if confidences else 0.0,
        )

    # ------------------------------------------------------------------ internals

    def _chunks(self, samples: np.ndarray):
        """Yields (start_sample, piece), cut at the quietest 100 ms between MIN and MAX seconds in."""
        total = len(samples)
        max_len = int(MAX_CHUNK_SEC * SAMPLE_RATE)
        min_len = int(MIN_CHUNK_SEC * SAMPLE_RATE)
        step = SAMPLE_RATE // 10
        start = 0
        while total - start > max_len:
            region = samples[start + min_len : start + max_len]
            usable = len(region) - len(region) % step
            energy = (region[:usable].reshape(-1, step) ** 2).mean(axis=1)
            cut = start + min_len + int(np.argmin(energy)) * step + step // 2
            yield start, samples[start:cut]
            start = cut
        if total - start > 0:
            yield start, samples[start:]

    def _transcribe_piece(self, samples: np.ndarray, config: FeatureConfig | None) -> Transcript:
        features = log_mel(samples, config)
        n_in = features.shape[1]
        if n_in < 8:
            return Transcript(text="")

        feeds = {self.signal_name: features[None, :, :].astype(self.signal_dtype)}
        if self.length_name:
            feeds[self.length_name] = np.array([n_in], dtype=np.int64)
        logprobs = self.session.run([self.logprobs_name], feeds)[0][0]  # (T_out, vocab)
        if logprobs.ndim != 2 or logprobs.shape[0] == 0:
            return Transcript(text="")
        logprobs = logprobs.astype(np.float32)

        # Each output frame stands for this much audio (the encoder shortens time 8x).
        subsampling = max(1, round(n_in / logprobs.shape[0]))
        frame_sec = subsampling * HOP_LENGTH / SAMPLE_RATE

        best = logprobs.argmax(axis=1)
        confidence = float(np.exp(logprobs.max(axis=1)).mean())

        # Greedy CTC: a token is emitted where the best label changes to something other than blank.
        # Each emitted token keeps the frames it covered, for its word's start and end.
        tokens: list[tuple[int, int, int]] = []  # (id, first frame, last frame)
        prev = -1
        for t, label in enumerate(best):
            label = int(label)
            if label != self.blank_id:
                if label != prev:
                    tokens.append((label, t, t))
                else:
                    tokens[-1] = (label, tokens[-1][1], t)
            prev = label

        text = self.tokenizer.decode([tid for tid, _, _ in tokens]).strip()
        return Transcript(text=text, words=self._words(tokens, frame_sec), confidence=confidence)

    def _words(self, tokens: list[tuple[int, int, int]], frame_sec: float) -> list[Word]:
        """Groups pieces into words: a piece starting with ▁ begins a new one."""
        words: list[Word] = []
        group: list[tuple[int, int, int]] = []

        def flush() -> None:
            if not group:
                return
            word = self.tokenizer.decode([tid for tid, _, _ in group]).strip()
            if word:
                words.append(Word(word, round(group[0][1] * frame_sec, 3), round((group[-1][2] + 1) * frame_sec, 3)))

        for token in tokens:
            if self.tokenizer.id_to_piece(token[0]).startswith("▁") and group:
                flush()
                group = []
            group.append(token)
        flush()
        return words


def load_from_env() -> Recognizer:
    model_dir = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "model"))
    model_path = os.environ.get("MODEL_PATH") or _first_existing(
        model_dir, ["model.int8.onnx", "model.onnx", "model.fp16.onnx"]
    )
    tokenizer_path = os.environ.get("TOKENIZER_PATH") or os.path.join(model_dir, "tokenizer.model")
    if not model_path or not os.path.exists(model_path):
        raise FileNotFoundError(f"No model found in {model_dir} (expected model.onnx, model.int8.onnx or model.fp16.onnx)")
    if not os.path.exists(tokenizer_path):
        raise FileNotFoundError(f"No tokenizer at {tokenizer_path}")
    started = time.perf_counter()
    recognizer = Recognizer(model_path, tokenizer_path)
    print(f"[nadir-asr] loaded {os.path.basename(model_path)} in {time.perf_counter() - started:.1f}s", flush=True)
    return recognizer


def _first_existing(folder: str, names: list[str]) -> str | None:
    for name in names:
        path = os.path.join(folder, name)
        if os.path.exists(path):
            return path
    return None

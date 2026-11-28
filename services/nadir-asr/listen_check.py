"""
The check a verified qari's surah goes through before it is offered in Listen (Admin → Listen qaris).

From the file the admin uploaded:
  1. the silence at either end is trimmed, the loudness is evened to the level Listen plays at,
     and the result is saved as a 128 kbps MP3 where the app's server said (a signed R2 address);
  2. the sound is measured: loudness before, distortion (clipping), background noise, long silences
     in the middle, and whether it starts or ends abruptly (cut off);
  3. the recitation is matched to the Quran, in overlapping windows so a two-hour surah fits in
     memory: which ayat are there, which are missing, out of order or repeated, which were hard to
     hear, and whether it is the surah it was uploaded as. The ayah timings that come out are
     Listen's and Read's for this recording.

Not checked here: tajweed, which the admin listens for, and music, echo, the voice and whether
the recording is someone else's, which are not built yet.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.request
from collections import Counter
from typing import Any, Callable

import av
import numpy as np

from features import SAMPLE_RATE

TARGET_LUFS = -16.0
TRUE_PEAK = -1.5
# Matched in windows this long, overlapping by this much, so an ayah cut by one edge is whole in the next.
WINDOW_SEC = 12 * 60
OVERLAP_SEC = 90
FRAME_SEC = 0.05
SPEECH_DB = -50.0
LONG_SILENCE_SEC = 4.0


def _decode_file(path: str) -> tuple[np.ndarray, int]:
    """16 kHz mono float32, and the channel count of the original."""
    with av.open(path) as container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("There is no audio in that file.")
        channels = stream.codec_context.channels or 1
        resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
        parts: list[np.ndarray] = []
        for frame in container.decode(stream):
            for out in resampler.resample(frame):
                parts.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            parts.append(out.to_ndarray().reshape(-1))
    if not parts:
        raise ValueError("The recording is empty.")
    return np.concatenate(parts).astype(np.float32), channels


def _frame_db(samples: np.ndarray) -> np.ndarray:
    step = int(FRAME_SEC * SAMPLE_RATE)
    usable = len(samples) - len(samples) % step
    if usable == 0:
        return np.array([-120.0])
    rms = np.sqrt((samples[:usable].reshape(-1, step) ** 2).mean(axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-6))


def _ffmpeg(args: list[str]) -> str:
    done = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True)
    if done.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {done.stderr[-400:]}")
    return done.stderr


def _measure(path: str, start: float, end: float) -> tuple[dict[str, Any], float, int]:
    """loudnorm's first-pass numbers, the peak in dBFS, and how many samples sit at it."""
    log = _ffmpeg(
        [
            "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", path,
            "-af", f"astats,loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json",
            "-f", "null", "-",
        ]
    )
    loud = json.loads(log[log.rindex("{") : log.rindex("}") + 1])
    overall = log[log.rfind("Overall") :]
    peak = re.search(r"Peak level dB:\s*(-?[\d.]+|-inf)", overall)
    count = re.search(r"Peak count:\s*(\d+)", overall)
    peak_db = float(peak.group(1)) if peak and peak.group(1) != "-inf" else -120.0
    return loud, peak_db, int(count.group(1)) if count else 0


def _encode(path: str, out: str, start: float, end: float, loud: dict[str, Any], channels: int) -> None:
    measured = (
        f"measured_I={loud['input_i']}:measured_TP={loud['input_tp']}:measured_LRA={loud['input_lra']}"
        f":measured_thresh={loud['input_thresh']}:offset={loud['target_offset']}"
    )
    _ffmpeg(
        [
            "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", path,
            "-af", f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:{measured}:linear=true",
            # Audio only: a cover picture in the upload is not carried into Listen's file.
            "-vn", "-ar", "44100", "-ac", str(min(channels, 2)), "-c:a", "libmp3lame", "-b:a", "128k",
            "-map_metadata", "-1", out,
        ]
    )


def _put(url: str, path: str) -> None:
    with open(path, "rb") as f:
        body = f.read()
    request = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={"Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable"},
    )
    with urllib.request.urlopen(request, timeout=600) as res:
        if res.status >= 300:
            raise RuntimeError(f"Storage refused the file ({res.status})")


def _sound_report(db: np.ndarray, start: float, end: float) -> dict[str, Any]:
    first = int(start / FRAME_SEC)
    last = max(first + 1, int(end / FRAME_SEC))
    inner = db[first:last]
    speech = inner[inner > SPEECH_DB]
    floor = float(np.percentile(inner, 10)) if len(inner) else -120.0
    level = float(np.percentile(speech, 90)) if len(speech) else -120.0
    snr = level - floor

    silences: list[dict[str, float]] = []
    run = 0
    for i, value in enumerate(inner):
        if value < max(SPEECH_DB, floor + 6):
            run += 1
            continue
        if run * FRAME_SEC >= LONG_SILENCE_SEC:
            silences.append({"atSeconds": round((i - run) * FRAME_SEC, 1), "seconds": round(run * FRAME_SEC, 1)})
        run = 0

    edge = int(0.25 / FRAME_SEC)
    return {
        "noiseFloorDb": round(floor, 1),
        "speechToNoiseDb": round(snr, 1),
        "noise": "quiet" if snr >= 35 else "some" if snr >= 22 else "noisy",
        "longSilences": silences[:20],
        # The original's own first and last quarter-second as loud as the recitation itself (within
        # 15 dB): a recording that begins or stops mid-sound.
        "startsAbruptly": bool(len(db) > edge and float(np.max(db[:edge])) > level - 15),
        "endsAbruptly": bool(len(db) > edge and float(np.max(db[-edge:])) > level - 15),
    }


def _match(samples: np.ndarray, recognizer: Any, marker: Any, progress: Callable[[str], None]) -> tuple[list[dict[str, Any]], list[Any], Counter]:
    """Each ayah heard, from the window where it sits furthest from an edge; the words heard; ayat heard twice in one window."""
    total = len(samples) / SAMPLE_RATE
    starts = [0.0]
    while starts[-1] + WINDOW_SEC < total:
        starts.append(starts[-1] + WINDOW_SEC - OVERLAP_SEC)

    best: dict[str, tuple[float, dict[str, Any]]] = {}
    heard: list[Any] = []
    repeated: Counter = Counter()
    for n, offset in enumerate(starts):
        progress(f"Matching ayahs ({n + 1} of {len(starts)})")
        stop = min(total, offset + WINDOW_SEC)
        piece = samples[int(offset * SAMPLE_RATE) : int(stop * SAMPLE_RATE)]
        result = recognizer.transcribe(piece, None, True)
        timeline, _coverage = marker.mark(result.words, result.emissions, result.duration)
        # Words from the middle stretch of each window only, so the overlap is not counted twice.
        keep_from = offset + (OVERLAP_SEC / 2 if n > 0 else 0)
        keep_to = stop - (OVERLAP_SEC / 2 if n + 1 < len(starts) else 0)
        for w in result.words:
            at = w.start + offset
            if keep_from <= at < keep_to:
                heard.append((at, w.word))
        seen: Counter = Counter()
        for entry in timeline or []:
            at = entry["atSeconds"] + offset
            seen[entry["verseKey"]] += 1
            centrality = min(at - offset, stop - at)
            shifted = {
                "verseKey": entry["verseKey"],
                "atSeconds": round(at, 2),
                "words": [round(t + offset, 2) for t in entry.get("words") or []],
            }
            if entry["verseKey"] not in best or centrality > best[entry["verseKey"]][0]:
                best[entry["verseKey"]] = (centrality, shifted)
        for key, count in seen.items():
            if count > 1:
                repeated[key] = max(repeated[key], count)
    entries = sorted((e for _, e in best.values()), key=lambda e: e["atSeconds"])
    return entries, heard, repeated


def run_check(path: str, surah: int, put_url: str, recognizer: Any, marker: Any, progress: Callable[[str], None]) -> dict[str, Any]:
    progress("Reading the file")
    samples, channels = _decode_file(path)
    original = len(samples) / SAMPLE_RATE
    db = _frame_db(samples)
    loud_frames = np.nonzero(db > SPEECH_DB)[0]
    if len(loud_frames) == 0:
        raise ValueError("The recording is silent.")
    start = max(0.0, loud_frames[0] * FRAME_SEC - 0.3)
    end = min(original, (loud_frames[-1] + 1) * FRAME_SEC + 0.6)

    progress("Measuring the sound")
    loud, peak_db, peak_count = _measure(path, start, end)
    sound = _sound_report(db, start, end)

    progress("Evening the loudness")
    out = f"{path}.out.mp3"
    _encode(path, out, start, end, loud, channels)
    progress("Saving the file")
    _put(put_url, out)
    out_bytes = os.path.getsize(out)
    os.remove(out)

    trimmed = samples[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
    entries, heard, repeated = _match(trimmed, recognizer, marker, progress)
    duration = len(trimmed) / SAMPLE_RATE

    progress("Writing the report")
    prefix = f"{surah}:"
    expected = [k for k in marker.order if k.startswith(prefix)]
    in_surah = [e for e in entries if e["verseKey"].startswith(prefix)]
    others = Counter(e["verseKey"].split(":")[0] for e in entries if not e["verseKey"].startswith(prefix))
    other_surah = None
    if others:
        top, count = others.most_common(1)[0]
        if count > len(in_surah):
            other_surah = {"surah": int(top), "ayahs": count}

    found = {e["verseKey"] for e in in_surah}
    missing = [int(k.split(":")[1]) for k in expected if k not in found]
    numbers = [int(e["verseKey"].split(":")[1]) for e in in_surah]
    out_of_order = [numbers[i] for i in range(1, len(numbers)) if numbers[i] < numbers[i - 1]]

    timings: dict[str, list[int]] = {}
    unclear: list[int] = []
    for i, entry in enumerate(in_surah):
        frm = entry["atSeconds"]
        to = in_surah[i + 1]["atSeconds"] if i + 1 < len(in_surah) else duration
        timings[entry["verseKey"]] = [int(round(frm * 1000)), int(round(to * 1000))]
        spelt = marker.words_of(entry["verseKey"]) or []
        count = sum(1 for at, _ in heard if frm <= at < to)
        if spelt and count < 0.6 * len(spelt):
            unclear.append(int(entry["verseKey"].split(":")[1]))

    return {
        "surah": surah,
        "durationSec": round(duration, 1),
        "originalDurationSec": round(original, 1),
        "trimmed": {"start": round(start, 2), "end": round(original - end, 2)},
        "loudness": {"inputLufs": float(loud["input_i"]), "outputLufs": TARGET_LUFS, "truePeakDb": float(loud["input_tp"])},
        "clipping": {"peakDb": round(peak_db, 2), "peakCount": peak_count, "clipped": peak_db > -0.1 and peak_count > 50},
        **sound,
        "ayahs": {
            "expected": len(expected),
            "found": len(found),
            "missing": missing,
            "outOfOrder": out_of_order,
            "repeated": sorted(int(k.split(":")[1]) for k in repeated if k.startswith(prefix)),
            "unclear": unclear,
            "otherSurah": other_surah,
        },
        "output": {"bytes": out_bytes, "channels": min(channels, 2), "bitrateKbps": 128},
        "timings": timings,
    }


# --------------------------------------------------------------------------- joining parts

PART_GAP_SEC = 0.8
# How far before the first new ayah a later part is cut in, so its first word is whole.
CUT_LEAD_SEC = 0.4


def _download(url: str, path: str) -> None:
    with urllib.request.urlopen(url, timeout=600) as res, open(path, "wb") as out:
        while chunk := res.read(1024 * 1024):
            out.write(chunk)


def _part(path: str, surah: int, recognizer: Any, marker: Any, progress: Callable[[str], None]) -> dict[str, Any]:
    """Where a part's recitation starts and ends, and the ayat of `surah` it holds (times from its own start)."""
    samples, _channels = _decode_file(path)
    original = len(samples) / SAMPLE_RATE
    db = _frame_db(samples)
    loud_frames = np.nonzero(db > SPEECH_DB)[0]
    if len(loud_frames) == 0:
        raise ValueError("One of the parts is silent.")
    start = max(0.0, loud_frames[0] * FRAME_SEC - 0.3)
    end = min(original, (loud_frames[-1] + 1) * FRAME_SEC + 0.6)
    entries, _heard, _repeated = _match(samples[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)], recognizer, marker, progress)
    prefix = f"{surah}:"
    own = [e for e in entries if e["verseKey"].startswith(prefix)]
    numbers = [int(e["verseKey"].split(":")[1]) for e in own]
    return {"path": path, "start": start, "end": end, "entries": own, "first": min(numbers) if numbers else None, "last": max(numbers) if numbers else None}


def run_join(paths: list[str], surah: int, put_url: str, recognizer: Any, marker: Any, progress: Callable[[str], None]) -> dict[str, Any]:
    """
    Parts of one surah recorded separately, made one: put in the order of the ayat they hold, an ayah
    recited at the end of one part and again at the start of the next kept once (the later part is cut
    in just before its first new ayah), and joined with a short pause between them. The joined
    recording then goes through the same check as a single upload.
    """
    parts = []
    for n, path in enumerate(paths):
        parts.append(_part(path, surah, recognizer, marker, lambda step, n=n: progress(f"Part {n + 1} of {len(paths)}: {step.lower()}")))
    unknown = [n + 1 for n, p in enumerate(parts) if p["first"] is None]
    if unknown:
        raise ValueError(f"Part {', '.join(map(str, unknown))} does not sound like surah {surah}.")
    parts.sort(key=lambda p: (p["first"], p["last"]))

    segments: list[tuple[str, float, float]] = []
    kept: list[dict[str, int]] = []
    reached = 0
    for p in parts:
        cut = p["start"]
        first = p["first"]
        if p["first"] <= reached:
            later = [e for e in p["entries"] if int(e["verseKey"].split(":")[1]) > reached]
            if not later:
                continue  # Nothing in it that the parts before did not already have.
            cut = p["start"] + max(0.0, later[0]["atSeconds"] - CUT_LEAD_SEC)
            first = int(later[0]["verseKey"].split(":")[1])
        segments.append((p["path"], cut, p["end"]))
        kept.append({"first": first, "last": p["last"]})
        reached = max(reached, p["last"])

    progress("Joining the parts")
    joined = f"{paths[0]}.joined.flac"
    args: list[str] = ["-y"]
    for path, start, end in segments:
        args += ["-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", path]
    chain = []
    labels = []
    for i in range(len(segments)):
        chain.append(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo[p{i}]")
        labels.append(f"[p{i}]")
        if i + 1 < len(segments):
            chain.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={PART_GAP_SEC}[g{i}]")
            labels.append(f"[g{i}]")
    chain.append(f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1[out]")
    _ffmpeg([*args, "-filter_complex", ";".join(chain), "-map", "[out]", "-c:a", "flac", joined])

    try:
        report = run_check(joined, surah, put_url, recognizer, marker, progress)
    finally:
        if os.path.exists(joined):
            os.remove(joined)
    report["joinedParts"] = kept
    return report

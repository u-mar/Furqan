"""
Finds the ayat in a recitation from what the speech model heard, and exactly
when each word of each ayah is said.

The model transcribes what was actually said, so it is rarely word-perfect: it
drops or swaps the odd word, and hears the taʿawwudh, the basmalah or a
repeated phrase that the Quran text does not have there. So this does not look
for exact quotations. It finds where in the Quran the first words belong, then
follows the recitation along the text, and starts over from a fresh search if
it loses its place.

Once it is known which ayat were recited, CTC forced alignment places their
words: the model is asked "these exact words were recited, where does each one
start?", using the scores it gave every sound. Every word gets a time, the ones
it did not catch by ear included, and ayat missed between two that were found
are tried in the gap and kept if their text fits the sound.

Numpy only: no model here. Characters are written as escapes because combining
marks are invisible when read.
"""

from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np

WORD_BOUNDARY = "▁"

# ------------------------------------------------------------------ text

_DIACRITICS = re.compile("[ؐ-ًؚ-ٟۖ-ۭـٰ]")
_ALEFS = re.compile("[إأآٱ]")
_NON_ARABIC = re.compile(r"[^؀-ۿ\s]")
_SPACES = re.compile(r"\s+")


def normalize_arabic(text: str) -> str:
    """For comparing words: no vowels or marks, and the letters people use interchangeably folded together."""
    text = _ALEFS.sub("ا", _DIACRITICS.sub("", text))
    for letter, folded in (("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        text = text.replace(letter, folded)
    return _SPACES.sub(" ", _NON_ARABIC.sub("", text)).strip()


_HAMZA_THEN_ALEF = re.compile("ـ?(?:َٔ?|َٔ)ا")
_MARKS = re.compile("[ٓ-ٟۖ-ۭـ‌-‏]")


def to_model_spelling(uthmani: str) -> str:
    """
    The model writes the Quran in the plain modern spelling with its vowels,
    not the mushaf's Uthmani one, so an ayah is respelt before its words are
    looked up in the model's vocabulary: the vowels kept, the mushaf's own
    signs turned into their plain equivalents or dropped.
    """
    text = uthmani
    # A small alef standing for a long a is written out, but not on alef maqsura, where it is already long.
    text = text.replace("ىٰ", "ى").replace("ـٰ", "ا").replace("ٰ", "ا")
    # Hamza then a long a is alef madda.
    text = _HAMZA_THEN_ALEF.sub("آ", text).replace("ءَا", "آ")
    # Alef wasla is a plain alef; the mushaf's round sukun and tanween forms are the plain marks.
    for mushaf, plain in (("ٱ", "ا"), ("ۡ", "ْ"), ("ࣰ", "ً"), ("ࣱ", "ٌ"), ("ࣲ", "ٍ")):
        text = text.replace(mushaf, plain)
    # Madda, hamza marks, small letters, pause and recitation signs, tatweel.
    return _SPACES.sub(" ", _MARKS.sub("", text)).strip()


def _js_round(value: float) -> int:
    """Halves round up, where Python's round() goes to the nearest even number."""
    return math.floor(value + 0.5)


# ------------------------------------------------------------------ finding the ayat


@dataclass
class WordIndex:
    """Every word of the Quran in reading order, normalised for comparison."""

    norm: list[str] = field(default_factory=list)
    verse: list[str] = field(default_factory=list)
    position: list[int] = field(default_factory=list)  # 1-based, inside its ayah
    word_count: dict[str, int] = field(default_factory=dict)
    by_word: dict[str, list[int]] = field(default_factory=dict)


def _verse_order(key: str) -> tuple[int, int]:
    chapter, verse = key.split(":")
    return int(chapter), int(verse)


def build_word_index(verses: list[dict[str, Any]]) -> WordIndex:
    index = WordIndex()
    for v in sorted(verses, key=lambda item: _verse_order(item["verse_key"])):
        words = v.get("words")
        if words:
            texts = [w.get("text_uthmani") or w.get("text_qpc_hafs") or "" for w in words if w.get("char_type_name") == "word"]
        else:
            texts = _SPACES.split(v.get("text_uthmani") or "")
        count = 0
        for text in texts:
            word = normalize_arabic(text)
            if not word:
                continue
            count += 1
            at = len(index.norm)
            index.norm.append(word)
            index.verse.append(v["verse_key"])
            index.position.append(count)
            index.by_word.setdefault(word, []).append(at)
        index.word_count[v["verse_key"]] = count
    return index


def _similarity(a: str, b: str) -> float:
    """1 for the same word, 0 for a different one, and in between for a close spelling."""
    if a == b:
        return 1.0
    la, lb = len(a), len(b)
    # Short words are too alike each other to allow a slip.
    if min(la, lb) <= 3 or abs(la - lb) > 2:
        return 0.0
    previous = list(range(lb + 1))
    for i in range(1, la + 1):
        row = [i]
        for j in range(1, lb + 1):
            row.append(min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (0 if a[i - 1] == b[j - 1] else 1)))
        previous = row
    return 1 - previous[lb] / max(la, lb)


MATCH_AT_LEAST = 0.7
ANCHOR_WORDS = 16
COMMON_WORD = 1500  # a word in more places than this says nothing about where we are
ANCHOR_EVIDENCE = 20  # how much the words that line up must tell us together, in nats
LOST_AFTER = 6
BACK_MISSES = 2
LEAD_SECONDS = 0.15  # a little before the word is heard, since a model places a word as it ends

TAAWWUDH = ["اعوذ", "بالله", "من", "الشيطان", "الرجيم"]
BASMALAH = ["بسم", "الله", "الرحمن", "الرحيم"]


def _find_anchor(heard: list[str], start: int, index: WordIndex) -> int | None:
    """Quran word index minus heard word index, where most of the heard words from `start` on agree."""
    votes: list[tuple[int, float, int]] = []
    for i in range(start, min(len(heard), start + ANCHOR_WORDS)):
        places = index.by_word.get(heard[i])
        if not places or len(places) > COMMON_WORD:
            continue
        # A word found in few places says more about where we are than a common one.
        weight = math.log(len(index.norm) / len(places))
        votes.extend((p - i, weight, i) for p in places)
    if not votes:
        return None
    votes.sort(key=lambda vote: vote[0])

    best_offset: int | None = None
    best_weight = 0.0
    left = 0
    weight = 0.0
    in_window: dict[int, int] = {}
    for right in range(len(votes)):
        weight += votes[right][1]
        in_window[votes[right][2]] = in_window.get(votes[right][2], 0) + 1
        # The offsets that agree are within a few words of each other (a heard word may be missing or extra).
        while votes[right][0] - votes[left][0] > 12:
            weight -= votes[left][1]
            remaining = in_window.get(votes[left][2], 1) - 1
            if remaining <= 0:
                in_window.pop(votes[left][2], None)
            else:
                in_window[votes[left][2]] = remaining
            left += 1
        if len(in_window) >= 3 and (best_offset is None or weight > best_weight):
            best_offset = _js_round((votes[left][0] + votes[right][0]) / 2)
            best_weight = weight
    return best_offset if best_offset is not None and best_weight >= ANCHOR_EVIDENCE else None


def _find_preface(heard: list[str]) -> tuple[set[int], int]:
    """
    The heard words that are the taʿawwudh or the basmalah, and where the
    basmalah starts (or -1). Both are made of words that begin the Quran
    itself, so left in they send the search to the wrong place.
    """
    skip: set[int] = set()

    def hits(start: int, words: list[str]) -> int:
        return sum(1 for k, w in enumerate(words) if start + k < len(heard) and _similarity(heard[start + k], w) >= MATCH_AT_LEAST)

    end = 0
    best_from = -1
    best_hits = 0
    start = 0
    while start <= 8 and start < len(heard):
        n = hits(start, TAAWWUDH)
        if n > best_hits:
            best_hits = n
            best_from = start
        start += 1
    if best_hits >= 3:
        for k in range(len(TAAWWUDH)):
            if best_from + k < len(heard):
                skip.add(best_from + k)
        end = min(len(heard), best_from + len(TAAWWUDH))

    basmalah_at = -1
    start = end
    while start <= end + 5 and start + 2 < len(heard):
        # The first word has three letters, so it is only ever taken exactly.
        if heard[start] == BASMALAH[0] and hits(start + 1, BASMALAH[1:]) >= 2:
            basmalah_at = start
            for k in range(len(BASMALAH)):
                if start + k < len(heard):
                    skip.add(start + k)
            break
        start += 1
    return skip, basmalah_at


def _best_match(word: str, index: WordIndex, start: int, stop: int, expected: int) -> int:
    """The Quran word this heard word most plausibly is, preferring places near `expected`; -1 when none is close."""
    found = -1
    found_score = 0.0
    for p in range(max(0, start), min(len(index.norm) - 1, stop) + 1):
        sim = _similarity(word, index.norm[p])
        if sim < MATCH_AT_LEAST:
            continue
        score = sim - 0.004 * abs(p - expected)
        if score > found_score:
            found_score = score
            found = p
    return found


def _follow_forward(heard: list[str], index: WordIndex) -> list[int]:
    assigned = [-1] * len(heard)
    expected = -1
    misses = 0
    anchored_at = 0
    matched_since_anchor = 0
    for i in range(len(heard)):
        if not heard[i]:
            continue
        # Words ahead of the first match (a preface, a greeting) are not a sign of being lost.
        lost = misses >= LOST_AFTER and (matched_since_anchor > 0 or i - anchored_at >= ANCHOR_WORDS + 4)
        if expected < 0 or lost:
            offset = _find_anchor(heard, i, index)
            if offset is not None:
                expected = offset + i
                misses = 0
                matched_since_anchor = 0
                anchored_at = i
            elif expected < 0:
                continue
        found = _best_match(heard[i], index, expected - 3 - misses * 2, expected + 25 + misses * 3, expected)
        if found >= 0:
            assigned[i] = found
            expected = found + 1
            misses = 0
            matched_since_anchor += 1
        else:
            misses += 1
    return assigned


def _drop_strays(assigned: list[int]) -> None:
    """A match is believed only with company: another close by in both the heard words and the Quran."""
    keep = []
    for i, p in enumerate(assigned):
        kept = False
        if p >= 0:
            for j in range(max(0, i - 3), min(len(assigned) - 1, i + 3) + 1):
                if j != i and assigned[j] >= 0 and abs(assigned[j] - p - (j - i)) <= 3:
                    kept = True
                    break
        keep.append(kept)
    for i, kept in enumerate(keep):
        if not kept:
            assigned[i] = -1


def _runs_of(assigned: list[int]) -> list[list[int]]:
    """Stretches of heard words matched to consecutive places in the Quran, as [start, end]."""
    runs: list[list[int]] = []
    last = -1
    for i in range(len(assigned)):
        if assigned[i] < 0:
            continue
        if runs and i - last <= 3 and abs(assigned[i] - assigned[last] - (i - last)) <= 3:
            runs[-1][1] = i
        else:
            runs.append([i, i])
        last = i
    return runs


def _refit_once(heard: list[str], index: WordIndex, assigned: list[int]) -> bool:
    runs = _runs_of(assigned)
    for k in range(len(runs) - 1):
        small_start, small_end = runs[k]
        long_start, long_end = runs[k + 1]
        small_length = small_end - small_start + 1
        long_length = long_end - long_start + 1
        if small_length > 8 or long_length < 3 * small_length:
            continue
        if long_start - small_end > 8:
            continue

        refit: dict[int, int] = {}
        expected = assigned[long_start] - 1
        misses = 0
        j = long_start - 1
        while j >= small_start and misses < LOST_AFTER:
            if heard[j]:
                found = _best_match(heard[j], index, expected - 25 - misses * 3, expected + 3 + misses * 2, expected)
                if found >= 0:
                    refit[j] = found
                    expected = found - 1
                    misses = 0
                else:
                    misses += 1
            j -= 1
        changes = any(assigned[at] != place for at, place in refit.items())
        if len(refit) >= 2 and len(refit) * 2 >= small_length and changes:
            for at in range(small_start, long_start):
                assigned[at] = refit.get(at, -1)
            return True
        # Two or three words that fit nowhere near, ahead of a long stretch elsewhere, were a chance match.
        if small_length <= 3:
            for at in range(small_start, small_end + 1):
                assigned[at] = -1
            return True
    return False


def _extend_backward(heard: list[str], index: WordIndex, assigned: list[int]) -> None:
    """The follow pass can only reach words once it has its bearings: what came before is matched backwards."""
    for start in range(len(heard)):
        if assigned[start] < 0 or (start > 0 and assigned[start - 1] >= 0):
            continue
        expected = assigned[start] - 1
        misses = 0
        j = start - 1
        while j >= 0 and misses < BACK_MISSES:
            if assigned[j] >= 0:
                break
            if heard[j]:
                # Tighter than going forward: the words behind a stretch are only believed when they sit right against it.
                found = _best_match(heard[j], index, expected - 8 - misses * 2, expected + 2 + misses, expected)
                if found >= 0:
                    assigned[j] = found
                    expected = found - 1
                    misses = 0
                else:
                    misses += 1
            j -= 1


def _next_verse_key(key: str, index: WordIndex) -> str | None:
    chapter, verse = (int(part) for part in key.split(":"))
    same = f"{chapter}:{verse + 1}"
    if same in index.word_count:
        return same
    next_chapter = f"{chapter + 1}:1"
    return next_chapter if next_chapter in index.word_count else None


@dataclass
class _Group:
    verse_key: str
    first: int
    count: int
    start: int  # Quran word index of its first word
    stop: int  # and of its last


def mark_ayat(heard_words: list[Any], index: WordIndex) -> tuple[list[dict[str, Any]], float]:
    """Where each ayah begins, in the order recited, and the share of heard words that were matched (0 to 1)."""
    heard = [normalize_arabic(w.word) for w in heard_words]
    skip, basmalah_at = _find_preface(heard)
    for i in skip:
        heard[i] = ""
    assigned = _follow_forward(heard, index)
    _drop_strays(assigned)
    for _ in range(5):  # each refit can leave the stretch before it next to the long one
        if not _refit_once(heard, index, assigned):
            break
    _extend_backward(heard, index, assigned)

    # Runs of words in the same ayah.
    groups: list[_Group] = []
    for i, place in enumerate(assigned):
        if place < 0:
            continue
        verse_key = index.verse[place]
        # Going back inside the same ayah is the reciter saying it again, not more of the same pass.
        if groups and groups[-1].verse_key == verse_key and place > groups[-1].stop - 2:
            groups[-1].count += 1
            groups[-1].stop = max(groups[-1].stop, place)
        else:
            groups.append(_Group(verse_key, i, 1, place, place))

    # A lone word is believed only if it is the next ayah along, or the ayah is that short.
    kept: list[_Group] = []
    for g, group in enumerate(groups):
        is_next = bool(kept) and _next_verse_key(kept[-1].verse_key, index) == group.verse_key
        # A lone, uncommon word right before the next ayah is probably that ayah's own beginning.
        rare = len(index.by_word.get(index.norm[group.start], [0] * 999)) <= 60
        leads_next = rare and g + 1 < len(groups) and _next_verse_key(group.verse_key, index) == groups[g + 1].verse_key
        short = index.word_count.get(group.verse_key, 9) <= 2
        if group.count >= 2 or is_next or leads_next or short:
            kept.append(group)
    # A few words from an ayah that the recitation then goes back before are a stray match, not an ayah.
    kept = [
        group
        for i, group in enumerate(kept)
        if not (i + 1 < len(kept) and group.count <= 3 and kept[i + 1].start < group.start and kept[i + 1].count >= 2 * group.count)
    ]
    # Pieces of one ayah split by a stray word in between are one ayah again.
    merged: list[_Group] = []
    for group in kept:
        if merged and merged[-1].verse_key == group.verse_key and (group.start > merged[-1].stop - 2 or group.count <= 2):
            merged[-1].count += group.count
            merged[-1].stop = max(merged[-1].stop, group.stop)
        else:
            merged.append(_Group(group.verse_key, group.first, group.count, group.start, group.stop))
    kept = merged

    # The basmalah is the first ayah of the Fatiha, but before any other surah it is not part of it.
    if len(kept) >= 2 and kept[0].verse_key == "1:1" and kept[1].verse_key.split(":")[0] != "1":
        kept.pop(0)
    # When what follows the basmalah is the Fatiha's second ayah, it was recited as its first.
    basmalah_first = basmalah_at >= 0 and bool(kept) and kept[0].verse_key == "1:2"

    def word_times(group: _Group, starts_at: float) -> list[float] | None:
        """When each word of a group's ayah starts: heard words where heard, the rest spread between them."""
        total = index.word_count.get(group.verse_key, 0)
        if not total:
            return None
        known: dict[int, float] = {}
        n = 0
        i = group.first
        while n < group.count and i < len(assigned):
            if assigned[i] >= 0 and index.verse[assigned[i]] == group.verse_key:
                n += 1
                known.setdefault(index.position[assigned[i]], heard_words[i].start)
            i += 1
        points = sorted(known.items())
        if not points:
            return None
        first_pos, first_at = points[0]
        last_pos, last_at = points[-1]
        per_word = max(0.25, (last_at - first_at) / (last_pos - first_pos)) if last_pos > first_pos else 0.5
        times: list[float] = []
        p = 0
        for position in range(1, total + 1):
            while p + 1 < len(points) and points[p + 1][0] <= position:
                p += 1
            if position <= first_pos:
                at = first_at if position == first_pos else starts_at
            elif position >= last_pos:
                at = last_at + (position - last_pos) * per_word
            else:
                a_pos, a_at = points[p]
                b_pos, b_at = points[p + 1]
                at = a_at + ((position - a_pos) / (b_pos - a_pos)) * (b_at - a_at)
            # Never earlier than the word before it, nor than the ayah itself.
            at = max(at, starts_at, times[-1] if times else 0)
            times.append(_js_round(at * 10) / 10)
        return times

    timeline: list[dict[str, Any]] = []
    if basmalah_first:
        timeline.append({"verseKey": "1:1", "atSeconds": _js_round(max(0, heard_words[basmalah_at].start - LEAD_SECONDS) * 10) / 10})
    for group in kept:
        at = max(0, heard_words[group.first].start - LEAD_SECONDS)
        floor = timeline[-1]["atSeconds"] + 0.1 if timeline else 0
        at_seconds = _js_round(max(at, floor) * 10) / 10
        entry: dict[str, Any] = {"verseKey": group.verse_key, "atSeconds": at_seconds}
        words = word_times(group, at_seconds)
        if words is not None:
            entry["words"] = words
        timeline.append(entry)

    kept_words: set[int] = set()
    for group in kept:
        n = 0
        i = group.first
        while n < group.count and i < len(assigned):
            if assigned[i] >= 0 and index.verse[assigned[i]] == group.verse_key:
                kept_words.add(i)
                n += 1
            i += 1
    counted = sum(1 for word in heard if word)
    return timeline, (len(kept_words) / counted if counted else 0.0)


# ------------------------------------------------------------------ word times


@dataclass
class EmissionPiece:
    """The model's scores for one stretch of the recording."""

    start: float  # where the stretch starts in the recording, in seconds
    step_seconds: float  # audio each step stands for
    logprobs: np.ndarray  # normalised log-probabilities, (steps, vocab)

    @property
    def steps(self) -> int:
        return self.logprobs.shape[0]


_NEG = -1e30


def align_words(emissions: list[EmissionPiece], start: float, stop: float, words: list[list[int]], blank: int) -> tuple[list[float], float] | None:
    """
    Where each of `words` (each as vocabulary ids) starts, looking only at the
    recording between `start` and `stop`, and how well the text fits the sound
    (average log-probability, 0 is perfect). The words may start anywhere in
    that window and need not fill it. None when nothing fits.
    """
    # The steps in the window, from every piece of the recording it touches.
    parts: list[np.ndarray] = []
    time_parts: list[np.ndarray] = []
    for piece in emissions:
        first = max(0, math.floor((start - piece.start) / piece.step_seconds))
        last = min(piece.steps - 1, math.ceil((stop - piece.start) / piece.step_seconds))
        if last >= first:
            parts.append(piece.logprobs[first : last + 1])
            time_parts.append(piece.start + np.arange(first, last + 1) * piece.step_seconds)

    tokens = [token for ids in words for token in ids]
    word_of = [w for w, ids in enumerate(words) for _ in ids]
    T = sum(len(p) for p in parts)
    L = len(tokens)
    if L == 0 or T < L:
        return None
    scores = np.concatenate(parts).astype(np.float64)
    times = np.concatenate(time_parts)

    # States: blank, token 0, blank, token 1, ... blank.
    S = 2 * L + 1
    labels = np.full(S, blank, dtype=np.int64)
    labels[1::2] = tokens
    # A token may follow the one before with no blank between them, unless they are the same token.
    skippable = np.array([s for s in range(3, S, 2) if tokens[(s - 1) >> 1] != tokens[(s - 3) >> 1]], dtype=np.int64)

    # Steps before and after the words are scored as whatever the model thought likeliest there,
    # so a word cannot gain by starting a step later or ending a step sooner.
    garbage = scores.max(axis=1)
    after = np.zeros(T + 1)
    for t in range(T - 1, -1, -1):
        after[t] = after[t + 1] + garbage[t]

    prev = np.full(S, _NEG)
    # Where each state came from: 0 stay, 1 from the state before, 2 skipping a blank, 3 starting here.
    back = np.zeros((T, S), dtype=np.uint8)
    before = 0.0
    best = _NEG
    best_t = -1
    best_s = -1

    for t in range(T):
        score = prev.copy()
        came = back[t]
        advanced = prev[:-1] > score[1:]
        score[1:][advanced] = prev[:-1][advanced]
        came[1:][advanced] = 1
        if skippable.size:
            chosen = skippable[prev[skippable - 2] > score[skippable]]
            score[chosen] = prev[chosen - 2]
            came[chosen] = 2
        for s in (0, 1):
            if before > score[s]:
                score[s] = before
                came[s] = 3
        curr = np.where(score <= _NEG / 2, _NEG, score + scores[t][labels])
        for end in (S - 1, S - 2):
            total = curr[end] + after[t + 1]
            if total > best:
                best = float(total)
                best_t = t
                best_s = end
        before += float(garbage[t])
        prev = curr
    if best_t < 0 or best <= _NEG / 2:
        return None

    # Back through the path: the first step of each word's first token is when the word starts.
    starts = [math.nan] * len(words)
    path_score = 0.0
    path_steps = 0
    s = best_s
    t = best_t
    while t >= 0:
        path_score += float(scores[t][labels[s]])
        path_steps += 1
        if s % 2 == 1:
            starts[word_of[(s - 1) >> 1]] = float(times[t])
        how = back[t][s]
        if how == 3:
            break
        if how == 1:
            s -= 1
        elif how == 2:
            s -= 2
        t -= 1
    if any(math.isnan(v) for v in starts):
        return None
    return starts, path_score / max(1, path_steps)


WORD_LEAD = 0.1  # how far ahead of the sound a word is shown, so it never lags the voice
MIN_SCORE = -2.5  # below this the text does not fit the sound well enough to trust
MIN_FOUND_SCORE = -1.2  # a missed ayah is only added on a much better fit: it was not heard at all
MAX_MISSING = 6  # at most this many missed ayat are looked for in one gap
MAX_WORD_GAP = 6  # no two words of one ayah are this far apart; a placement needing more borrowed a word from elsewhere


def _round2(value: float) -> float:
    return _js_round(value * 100) / 100


def _surah_of(key: str) -> str:
    return key.split(":")[0]


class Marker:
    """Turns what the model heard into the ayat of a recitation. Built once: it holds the whole Quran."""

    def __init__(self, verses: list[dict[str, Any]], pieces: list[str], blank: int, min_coverage: float = 0.45):
        self.index = build_word_index(verses)
        self.blank = blank
        self.min_coverage = min_coverage
        self.order = sorted((v["verse_key"] for v in verses), key=_verse_order)
        self.position = {key: i for i, key in enumerate(self.order)}
        self.ayah_words: dict[str, list[str]] = {}
        for v in verses:
            words = v.get("words")
            if words:
                self.ayah_words[v["verse_key"]] = [w.get("text_uthmani") for w in words if w.get("char_type_name") == "word"]
            else:
                self.ayah_words[v["verse_key"]] = [t for t in _SPACES.split(v.get("text_uthmani") or "") if t]

        self.piece_ids: dict[str, int] = {}
        self.longest_piece = 1
        for piece_id, piece in enumerate(pieces):
            if piece_id == 0 or piece in self.piece_ids:
                continue
            self.piece_ids[piece] = piece_id
            self.longest_piece = max(self.longest_piece, len(piece))
        self._spelt: dict[str, list[list[int]] | None] = {}

    # ------------------------------------------------------------------ spelling

    def encode_word(self, word: str) -> list[int] | None:
        """The ids spelling `word` as a whole word (longest pieces first), or None if a letter has no piece."""
        text = WORD_BOUNDARY + word
        out: list[int] = []
        at = 0
        while at < len(text):
            size = min(self.longest_piece, len(text) - at)
            found = -1
            while size > 0:
                found = self.piece_ids.get(text[at : at + size], -1)
                if found >= 0:
                    break
                size -= 1
            if found < 0:
                return None
            out.append(found)
            at += size
        return out

    def spell_for_model(self, uthmani: str) -> list[int] | None:
        """One mushaf word in the model's vocabulary. A few are stored as two pieces, each spelt as the word it is."""
        ids: list[int] = []
        for part in to_model_spelling(uthmani).split(" "):
            if not part:
                continue
            spelt = self.encode_word(part)
            if spelt is None:
                return None
            ids.extend(spelt)
        return ids or None

    def words_of(self, key: str) -> list[list[int]] | None:
        """The ayah's words in the model's vocabulary, or None if one cannot be spelt."""
        if key not in self._spelt:
            ids = [self.spell_for_model(text) for text in self.ayah_words.get(key, [])]
            self._spelt[key] = ids if ids and all(ids) else None  # type: ignore[assignment]
        return self._spelt[key]

    # ------------------------------------------------------------------ word times

    def _align_run(self, emissions: list[EmissionPiece], keys: list[str], start: float, stop: float) -> tuple[list[dict[str, Any]], float] | None:
        """Aligns a run of consecutive ayat as one, so they share out the stretch between them."""
        per_ayah = [self.words_of(key) for key in keys]
        if any(not words for words in per_ayah):
            return None
        aligned = align_words(emissions, start, stop, [w for words in per_ayah for w in words], self.blank)  # type: ignore[union-attr]
        if aligned is None:
            return None
        starts, score = aligned
        entries: list[dict[str, Any]] = []
        at = 0
        for key, words in zip(keys, per_ayah):
            count = len(words)  # type: ignore[arg-type]
            ayah_starts = starts[at : at + count]
            at += count
            for w in range(1, len(ayah_starts)):
                if ayah_starts[w] - ayah_starts[w - 1] > MAX_WORD_GAP:
                    return None
            word_times = [_round2(max(0, t - WORD_LEAD)) for t in ayah_starts]
            entries.append({"verseKey": key, "atSeconds": word_times[0], "words": word_times})
        return entries, score

    def align_recitation(self, timeline: list[dict[str, Any]], emissions: list[EmissionPiece], duration: float) -> list[dict[str, Any]]:
        """Exact word times for the ayat found, plus the ayat listening missed."""
        if not emissions or not timeline:
            return timeline

        # Each ayah that was found, on its own stretch: from just before it to just after the next
        # begins, never reaching halfway into its neighbours (a repeated ayah must not find its other recitation).
        found: list[dict[str, Any]] = []
        for i, entry in enumerate(timeline):
            previous = timeline[i - 1] if i > 0 else None
            following = timeline[i + 1] if i + 1 < len(timeline) else None
            after_next = timeline[i + 2] if i + 2 < len(timeline) else None
            start = max(entry["atSeconds"] - 1.5, (previous["atSeconds"] + entry["atSeconds"]) / 2 if previous else 0)
            end = following["atSeconds"] if following else duration
            stop = min(end + 1.5, (following["atSeconds"] + after_next["atSeconds"]) / 2 if following and after_next else end + 1.5)
            run = self._align_run(emissions, [entry["verseKey"]], start, stop)
            found.append(run[0][0] if run and run[1] >= MIN_SCORE else entry)

        def missing_before(i: int) -> list[str]:
            """The ayat between two found ones (or before the first) that were not heard."""
            here = self.position.get(found[i]["verseKey"])
            if here is None:
                return []
            keys: list[str] = []
            previous = self.position.get(found[i - 1]["verseKey"]) if i > 0 else None
            p = here - 1
            while p >= 0 and len(keys) < MAX_MISSING:
                key = self.order[p]
                if _surah_of(key) != _surah_of(found[i]["verseKey"]):
                    break
                if previous is not None and p <= previous:
                    break
                keys.insert(0, key)
                p -= 1
            # Between two found ayat, only when the earlier one really comes before.
            if previous is not None and (previous >= here or _surah_of(found[i - 1]["verseKey"]) != _surah_of(found[i]["verseKey"])):
                return []
            return keys

        out: list[dict[str, Any]] = []
        for i in range(len(found)):
            keys = missing_before(i)
            if keys:
                before = out[-1] if out else None
                if before:
                    start = (before["words"][-1] if before.get("words") else before["atSeconds"]) + 0.3
                else:
                    start = 0
                stop = found[i]["atSeconds"] + 0.5
                # The longest run that fits, dropping the earliest ayat first: a recitation may begin partway through.
                for first in range(len(keys)):
                    run = self._align_run(emissions, keys[first:], start, stop)
                    if run and run[1] >= MIN_FOUND_SCORE:
                        out.extend(run[0])
                        break
            out.append(found[i])

        # In order, a little apart, and every word at or after its ayah's start.
        for i in range(len(out)):
            floor = out[i - 1]["atSeconds"] + 0.1 if i > 0 else 0
            at_seconds = _round2(max(out[i]["atSeconds"], floor))
            entry = {**out[i], "atSeconds": at_seconds}
            if out[i].get("words"):
                entry["words"] = [max(w, at_seconds) for w in out[i]["words"]]
            out[i] = entry
        return out

    # ------------------------------------------------------------------ public

    def mark(self, words: list[Any], emissions: list[EmissionPiece], duration: float) -> tuple[list[dict[str, Any]] | None, float]:
        """The ayat recited, or None when nothing could be matched to the Quran with confidence; and the coverage."""
        timeline, coverage = mark_ayat(words, self.index)
        if not timeline or coverage < self.min_coverage:
            return None, coverage
        return self.align_recitation(timeline, emissions, duration), coverage


def load_marker(pieces: list[str], blank: int) -> Marker:
    model_dir = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "model"))
    path = os.environ.get("QURAN_DATA") or os.path.join(model_dir, "quran-data.json")
    with open(path, encoding="utf-8") as f:
        verses = json.load(f)["verses"]
    return Marker(verses, pieces, blank)

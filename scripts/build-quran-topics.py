"""
Builds lib/quran-topics.json, Read's Topic tab, from QUL's "Topics" database (Tarteel's Quranic
Universal Library, https://qul.tarteel.ai/resources/ayah-topics/45, downloaded as SQLite).

Only its thematic tree is kept: the topics of The Clear Quran, under Aqidah, Qasas and Al-Ghayb
(belief, stories, the unseen), each with its ayat. A topic with no ayat under it is left out; the
prophets and others get the names Muslims know them by, and spelling slips are tidied.

    python scripts/build-quran-topics.py path/to/topics.db
"""

from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
import sys
from pathlib import Path

ROOTS = [1882, 1883, 1884]  # Doctrine, Stories, The Unseen

# Topics added to the thematic tree, as id: (name, Arabic name, the topic they go under, their ayat:
# verse keys, or QUL general topics whose ayat they gather). The ids are this script's own, outside
# QUL's range. Zina, under Major Sins, follows QUL's "Marriage > adultery" and the topics under it;
# the rest of QUL's "Adultery" topic follows as its other ayat.
EXTRA = {
    900001: ("Zina (adultery and fornication)", "الزنا", 2491, ["17:32", "25:68"]),
    900002: ("Its punishment", None, 900001, ["24:2"]),
    900003: ("Four witnesses required", None, 900001, ["24:4"]),
    900004: ("Without four witnesses (li'an)", None, 900001, ["24:6", "24:7", "24:8", "24:9"]),
    900005: ("Punishment of false accusers", None, 900001, ["24:4", "24:19", "24:23"]),
    900006: ("Marriage after it", None, 900001, ["24:3"]),
    900007: ("Other ayat about it", None, 900001, [1258]),
    # Ayyub has no topic of his own in the thematic tree; his story was filed under Isa (see REPARENT).
    900010: ("Ayyub", "أيوب", 2284, ["4:163", "6:84"]),
}

# ---------------------------------------------------------------------------------------------------
# Corrections from reading every topic against its ayat (Saheeh International), November 2026. QUL
# builds many topics from a word's root, so some gather ayat that only share a word with the topic
# ("right hand" under Oaths, "pure boy" under Purification); and a few point at the wrong passage.
# ---------------------------------------------------------------------------------------------------


def span(surah: int, first: int, last: int) -> list[str]:
    return [f"{surah}:{a}" for a in range(first, last + 1)]


# A topic's own ayat, replaced.
SET_AYAHS: dict[int, list[str]] = {
    2035: span(3, 123, 127) + span(8, 5, 19) + span(8, 41, 44),  # Badr (3:121-122 are Uhud)
    2042: span(48, 1, 7) + span(48, 18, 27),  # Hudaybiyah
    2174: ["2:23", "2:24", "10:38", "11:13", "17:88", "52:34"],  # No one can produce its like
    1080: ["4:163", "17:55", "21:105"],  # Zabur: the ayat naming it, not every "written record"
    97: ["8:43", "48:27"],  # Dreams of the Prophet ﷺ (was every ayah about him)
    1043: ["37:102", "37:105"],  # Ibrahim's dream (was his supplications)
    2282: ["2:270", "22:29", "76:7"],  # Vows (was 7:31, on clothing)
    2283: ["7:31", "17:26", "17:27", "17:29", "25:67"],  # Wasting and stinginess
    2305: span(7, 85, 93) + span(11, 84, 95) + span(26, 176, 191) + ["29:36", "29:37"],  # Shuayb (had Hud, Salih, Lut, Ilyas)
    2316: ["21:87", "21:88"] + span(37, 139, 148) + span(68, 48, 50),  # Yunus and the whale (was 10:98)
    2313: ["21:83", "21:84"] + span(38, 41, 44),  # Ayyub tested then rewarded
    819: ["21:83", "38:41"],  # Ayyub's supplication (was all about him)
    821: ["21:87", "21:88"],  # Yunus's supplication (was all about him)
    2507: ["49:12"],  # Backbiting (49:11 is mockery)
    2427: ["69:1", "79:34", "80:33", "88:1", "101:1"],  # Names of the Hour (was 1:3)
    2401: ["15:27", "55:15"],  # Jinn created from fire (was 15:25)
    2411: ["58:19"],  # The party of Shaytan (was 53:14-19)
    2016: ["16:120", "16:121", "16:122", "16:123", "60:4", "60:6"],  # Ibrahim a role model (33:21 is the Prophet ﷺ)
    1678: ["2:222", "4:43", "5:6", "8:11", "9:108", "56:79", "74:4"],  # Purification (was every "pure")
    1737: [],  # Separation: its subtopics only (its own ayat only shared the word)
    2154: ["6:93", "32:11"],  # Angels of death
}

# Ayat taken out of a topic: they share a word with it, but are not about it.
REMOVE_AYAHS: dict[int, list[str]] = {
    620: ["9:122", "48:17"],  # Fasting exemptions: these excuse from fighting
    388: ["79:1"],  # Stars: 79:1 is the angels
    17: ["3:180"],  # Children of Israel
    1730: ["21:104", "81:10"],  # Scriptures: the folding of the sky, the records of deeds
    61: ["5:3", "7:20", "7:21", "7:22", "7:23", "7:24", "56:75", "77:1"],  # Quran
    2213: ["2:183"],  # Bequests: 2:183 is fasting
    2246: ["2:238", "2:239"],  # Dowry and waiting period: these are prayer
    2201: ["4:145"],  # Parables > Hypocrites: not a parable
    900007: ["4:19", "4:22", "4:23", "4:27", "60:10", "60:11"],  # Zina, other ayat: marriage rules
    1428: ["5:95", "6:50", "13:16", "16:76", "17:22", "17:75", "26:136", "35:12", "36:10", "40:40", "50:26", "99:7"],
    1013: [  # Oaths: "yamin" is also "right hand"
        "4:3", "4:24", "4:25", "4:33", "4:36", "7:17", "16:71", "17:71", "19:52", "20:69", "20:80", "23:6",
        "24:31", "24:33", "24:58", "28:30", "30:28", "33:50", "33:55", "57:12", "66:8", "70:30",
    ],
}

# Ayat added to a topic.
ADD_AYAHS: dict[int, list[str]] = {
    2036: ["3:121", "3:122"],  # Uhud
    2097: ["5:95"],  # Hunting while in ihram
    2308: span(19, 7, 15),  # Yahya's birth and prophethood
}

# Topics moved: Insects and Sea animals sat under Birds; Ayyub's story under Isa.
REPARENT: dict[int, int] = {1991: 1967, 1988: 1967, 2313: 900010}

# Spelling slips and clearer names.
RENAME_MORE = {
    1940: "Scientific signs",
    1981: "Reptiles and amphibians",
    2145: "Religious titles",
    2238: "Family and society",
    2263: "Interpretation of dreams",
    2277: "Social etiquette",
    1659: "Hajj (pilgrimage)",
    2099: "Umrah (minor pilgrimage)",
    2100: "Completing Hajj and Umrah",
    2094: "An obligation on those who are able",
    2502: "Intimacy during menstruation",
    1903: "The only one worthy of worship",
    1920: "Wrote everything in the Record (the Preserved Tablet)",
    2250: "If she nurses the ex-husband's child",
    2253: "Encouraging good and forbidding evil",
    2240: "Kindness to non-Muslims",
    97: "Dreams of the Prophet ﷺ",
    1043: "Ibrahim's dream",
    2316: "Swallowed by the whale, then saved",
    819: "Ayyub",
    821: "Yunus",
    1837: "The Unseen",
    1885: "Foundations of Islam",
    1891: "Faith in Allah and doing good",
    1886: "The religion perfected",
    1887: "Islam, the only religion accepted by Allah",
    1888: "No compulsion in religion",
    1889: "One faith, different laws",
    1890: "The prophets of Islam",
    1892: "Protecting faith",
    1893: "Protecting life",
    1894: "Protecting wealth",
    1895: "Protecting honour",
    1896: "Protecting the mind",
}
TYPOS = {"Chief Minster": "Chief Minister", "eventhing": "everything", "Ettiquette": "Etiquette", "ettiquette": "etiquette"}
OUT = Path(__file__).resolve().parent.parent / "lib" / "quran-topics.json"

RENAME = {
    1882: "Aqidah (Belief)",
    1883: "Qasas (Stories)",
    1884: "Al-Ghayb (The Unseen)",
    2361: "Other stories",
    2380: "Parables",
    2284: "Prophets",
    2350: "Muhammad",
    2307: "Isaac",
    # The source's "Job the Baptist" holds Yahya's birth (3:38-40), and its "John" the whale (10:98).
    2314: "Yahya",
    2315: "Yunus",
    2473: "Desperate pleas",
}

# The names Muslims know them by, in place of the English (Bible) ones the source uses.
ISLAMIC_NAMES = {
    "Moses": "Musa", "Abraham": "Ibrahim", "Jesus": "Isa", "Mary": "Maryam", "Noah": "Nuh",
    "Joseph": "Yusuf", "Jacob": "Yaqub", "Isaac": "Ishaq", "Ishmael": "Ismail", "Aaron": "Harun",
    "David": "Dawud", "Solomon": "Sulayman", "Jonah": "Yunus", "Job": "Ayyub", "John": "Yahya",
    "Zachariah": "Zakariya", "Elias": "Ilyas", "Elisha": "Al-Yasa", "Enoch": "Idris", "Lot": "Lut",
    "Shuaib": "Shuayb", "Shu’aib": "Shuayb", "Pharaoh": "Fir'awn", "Gabriel": "Jibril",
    "Michael": "Mika'il", "Satan": "Shaytan", "Torah": "Tawrah", "Gospel": "Injil", "Psalms": "Zabur",
    "Ezra": "Uzayr", "Saul": "Talut", "Korah": "Qarun", "Cain": "Qabil", "Abel": "Habil",
    "Sheba": "Saba", "Al-Khaḍir": "Al-Khidr", "Ⱬul-Qarnain": "Dhul-Qarnayn", "Hârût": "Harut",
    "Mârût": "Marut", "Zul-kifl": "Dhul-Kifl", "Luqmân": "Luqman", "Sâmiri": "Samiri", "Ramaḍân": "Ramadan", "Muḥammad": "Muhammad",
}
NAME_RE = re.compile(r"(?<!\w)(" + "|".join(map(re.escape, sorted(ISLAMIC_NAMES, key=len, reverse=True))) + r")(?!\w)")
# ﷺ is said for the Prophet Muhammad; the other prophets are followed by (AS), "peace be upon him".
PRAISE_RE = re.compile(r"\s*(?:\(ﷺ\)|ﷺ)")
MUHAMMAD_RE = re.compile(r"(Muhammad|Prophet|prophet)\s*\(AS\)")


def tidy(topic_id: int, name: str) -> str:
    name = RENAME_MORE.get(topic_id, RENAME.get(topic_id, name))
    name = " ".join(name.replace("\t", " ").split())
    for wrong, right in TYPOS.items():
        name = name.replace(wrong, right)
    # Plain letters for the transliterations ("Tabûk", "Ḥunain"): accents removed, ﷺ left alone.
    name = "".join(c for c in unicodedata.normalize("NFD", name) if not unicodedata.combining(c))
    name = name.replace("Ḥ", "H").replace("ʿ", "'")
    name = name.replace("(mentioned passingly)", " (mentioned briefly)").replace("  ", " ")
    name = NAME_RE.sub(lambda m: ISLAMIC_NAMES[m.group(1)], name)
    name = PRAISE_RE.sub(" (AS)", name)
    name = MUHAMMAD_RE.sub(lambda m: f"{m.group(1)} ﷺ", name)
    return name[:1].upper() + name[1:]


def verse_order(key: str) -> tuple[int, int]:
    surah, ayah = key.split(":")
    return int(surah), int(ayah)


def main(db_path: str) -> None:
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = {
        r[0]: {"name": r[1], "ar": r[2], "parent": r[3], "ayahs": r[4]}
        for r in db.execute("select topic_id, name, arabic_name, thematic_parent_id, ayahs from topics")
    }
    # Topics the thematic tree leaves out, made from QUL's general topics (each with the ones under it).
    general: dict[int, list[int]] = {}
    for tid, parent in db.execute("select topic_id, parent_id from topics where parent_id is not null"):
        general.setdefault(parent, []).append(tid)

    def general_ayahs(tid: int) -> list[str]:
        keys = [k.strip() for k in (rows[tid]["ayahs"] or "").split(",") if k.strip()]
        for kid in general.get(tid, []):
            keys += general_ayahs(kid)
        return keys

    listed: set[str] = set()
    for extra_id, (name, ar, parent, sources) in EXTRA.items():
        keys = {k for s in sources for k in ([s] if isinstance(s, str) else general_ayahs(s))}
        # "Other ayat": what a gathered QUL topic has beyond those already listed under the same topic.
        if any(isinstance(s, int) for s in sources):
            keys -= listed
        listed |= keys
        rows[extra_id] = {"name": name, "ar": ar, "parent": parent, "ayahs": ", ".join(sorted(keys, key=verse_order))}

    for child, parent in REPARENT.items():
        rows[child]["parent"] = parent

    children: dict[int, list[int]] = {}
    for tid, row in rows.items():
        if row["parent"] is not None:
            children.setdefault(row["parent"], []).append(tid)

    topics: dict[str, dict] = {}

    def build(tid: int, seen: frozenset[int]) -> set[str]:
        """Adds the topic and those under it; returns every ayah anywhere under it."""
        if tid in seen:
            return set()
        row = rows[tid]
        own_set = {k.strip() for k in (row["ayahs"] or "").split(",") if k.strip() and ":" in k}
        if tid in SET_AYAHS:
            own_set = set(SET_AYAHS[tid])
        own_set = (own_set - set(REMOVE_AYAHS.get(tid, []))) | set(ADD_AYAHS.get(tid, []))
        own = sorted(own_set, key=verse_order)
        kids = []
        everything = set(own)
        # A to Z, except topics added here, which keep their own order after QUL's.
        for kid in sorted(children.get(tid, []), key=lambda k: (1, f"{k:09d}") if k in EXTRA else (0, tidy(k, rows[k]["name"]).lower())):
            under = build(kid, seen | {tid})
            if under:
                kids.append(kid)
                everything |= under
        if not everything:
            return set()
        entry = {"name": tidy(tid, row["name"]), "count": len(everything)}
        if row["ar"]:
            entry["ar"] = row["ar"].strip()
        if own:
            entry["ayahs"] = own
        if kids:
            entry["children"] = kids
        topics[str(tid)] = entry
        return everything

    for root in ROOTS:
        build(root, frozenset())

    out = {
        "source": "QUL (Tarteel), Topics, thematic: https://qul.tarteel.ai/resources/ayah-topics/45",
        "roots": [r for r in ROOTS if str(r) in topics],
        "topics": topics,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(topics)} topics written to {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main(sys.argv[1])

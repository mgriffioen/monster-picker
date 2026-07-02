#!/usr/bin/env python3
"""Generate data/monsters.json for the Monster Picker web tool.

The monster stat blocks come from the `dungeonsheets` package, which bundles
the Dungeons & Dragons 5th Edition System Reference Document (SRD 5.1) content
released by Wizards of the Coast under the Creative Commons Attribution 4.0
International License (CC-BY-4.0).

We introspect every Monster subclass, normalise the fields, parse the
free-text docstring into structured trait/action/reaction/legendary/lair
entries, derive XP + proficiency bonus from Challenge Rating, and heuristically
tag each monster with the environments where it is likely to be encountered
(the SRD does not ship environment data, so this is a best-effort mapping).

Usage:
    pip install dungeonsheets
    python tools/build_monsters.py

Output:
    data/monsters.json  (consumed directly by the browser; no runtime API)
"""
from __future__ import annotations

import inspect
import json
import os
import re
import sys
from fractions import Fraction

# --------------------------------------------------------------------------
# Locate the dungeonsheets monster classes
# --------------------------------------------------------------------------
try:
    from dungeonsheets.monsters.monsters import Monster
    from dungeonsheets import monsters as monsters_pkg
except Exception:  # pragma: no cover - allow running from an extracted sdist
    for guess in (
        os.environ.get("DUNGEONSHEETS_SRC", ""),
        os.path.join(os.path.dirname(__file__), "..", "vendor", "dungeonsheets"),
    ):
        if guess and os.path.isdir(guess):
            sys.path.insert(0, guess)
    from dungeonsheets.monsters.monsters import Monster
    from dungeonsheets import monsters as monsters_pkg


# --------------------------------------------------------------------------
# Challenge Rating -> XP  (SRD / DMG table)
# --------------------------------------------------------------------------
CR_XP = {
    0: 10, Fraction(1, 8): 25, Fraction(1, 4): 50, Fraction(1, 2): 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
    9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000,
    22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000,
    28: 120000, 29: 135000, 30: 155000,
}


def cr_to_fraction(cr) -> Fraction:
    return Fraction(cr).limit_denominator(8)


def cr_display(fr: Fraction) -> str:
    if fr.denominator == 1:
        return str(fr.numerator)
    return f"{fr.numerator}/{fr.denominator}"


def cr_xp(fr: Fraction) -> int:
    if fr in CR_XP:
        return CR_XP[fr]
    # nearest known key by value
    key = min(CR_XP, key=lambda k: abs(float(k) - float(fr)))
    return CR_XP[key]


def proficiency_bonus(fr: Fraction) -> int:
    cr = float(fr)
    for hi, pb in ((4, 2), (8, 3), (12, 4), (16, 5), (20, 6), (24, 7), (28, 8), (30, 9)):
        if cr <= hi:
            return pb
    return 9


# --------------------------------------------------------------------------
# Parse the "description" line -> size / type / alignment
# --------------------------------------------------------------------------
SIZES = ["Gargantuan", "Huge", "Large", "Medium", "Small", "Tiny"]
TYPES = [
    "aberration", "beast", "celestial", "construct", "dragon", "elemental",
    "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant",
    "swarm", "undead",
]


def parse_description(desc: str):
    desc = (desc or "").strip()
    size = next((s for s in SIZES if re.search(rf"\b{s}\b", desc, re.I)), "Medium")
    low = desc.lower()
    mtype = next((t for t in TYPES if t in low), "monstrosity")
    if "swarm" in low and mtype == "swarm":
        # swarms read "Medium swarm of Tiny beasts"
        inner = next((t for t in TYPES if t != "swarm" and t in low), "beast")
        mtype = inner
        is_swarm = True
    else:
        is_swarm = "swarm of" in low
    # alignment = everything after the first comma
    alignment = ""
    if "," in desc:
        alignment = desc.split(",", 1)[1].strip()
    return size, mtype, alignment, is_swarm


# --------------------------------------------------------------------------
# Parse the docstring into structured sections
# --------------------------------------------------------------------------
SECTION_ALIASES = {
    "actions": "actions",
    "reactions": "reactions",
    "legendary actions": "legendary_actions",
    "lair actions": "lair_actions",
    "regional effects": "regional_effects",
}


def parse_entries(block: str):
    """A block is a run of `Title.\n  body...` entries. Returns [{name, desc}]."""
    entries = []
    cur = None
    for raw in block.splitlines():
        if not raw.strip():
            if cur:
                cur["desc"] += "\n"
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        # A new entry title sits at column 0 and looks like "Some Name."
        is_title = (
            indent == 0
            and cur is None
            or (indent == 0 and re.match(r"^[A-Z0-9][^\n]{0,60}\.\s*$", line) is not None)
        )
        if indent == 0 and re.match(r"^[A-Z0-9][^\n]{0,60}\.$", line):
            if cur:
                entries.append(cur)
            cur = {"name": line[:-1].strip(), "desc": ""}
        else:
            if cur is None:
                cur = {"name": "", "desc": ""}
            cur["desc"] += (" " if cur["desc"] and not cur["desc"].endswith("\n") else "") + line
    if cur:
        entries.append(cur)
    # tidy whitespace
    for e in entries:
        e["desc"] = re.sub(r"[ \t]+", " ", e["desc"]).strip()
        e["desc"] = re.sub(r"\n{2,}", "\n\n", e["desc"]).strip()
    return [e for e in entries if e["name"] or e["desc"]]


ATTACK_RE = re.compile(r"(Melee|Ranged)[^.]{0,25}(Weapon|Spell)?\s*Attack:", re.I)


def is_action_entry(entry) -> bool:
    """Heuristically decide whether a parsed entry is an action (attack)."""
    if entry["name"].strip().lower() == "multiattack":
        return True
    desc = entry["desc"]
    return "Hit:" in desc or ATTACK_RE.search(desc) is not None


def parse_docstring(doc: str):
    doc = inspect.cleandoc(doc or "")
    # A handful of monsters use Markdown emphasis (**Name.**, *Hit:*); strip it
    # so titles and body text parse the same as the plain-text majority.
    doc = doc.replace("**", "").replace("*", "")
    sections = {"traits": [], "actions": [], "reactions": [],
                "legendary_actions": [], "lair_actions": [], "regional_effects": []}
    current = "traits"
    buff = []

    def flush():
        nonlocal buff
        text = "\n".join(buff)
        sections[current].extend(parse_entries(text))
        buff = []

    for line in doc.splitlines():
        m = re.match(r"^#\s*(.+?)\s*$", line)
        if m:
            flush()
            key = SECTION_ALIASES.get(m.group(1).strip().lower())
            current = key if key else "traits"
        else:
            buff.append(line)
    flush()

    # Some SRD entries (werecreatures, a few cult monsters) list their attacks
    # without an explicit "# Actions" header, so everything lands in traits.
    # If there is no actions section, promote attack-like entries out of traits.
    if not sections["actions"]:
        kept, promoted = [], []
        for e in sections["traits"]:
            (promoted if is_action_entry(e) else kept).append(e)
        if promoted:
            sections["traits"] = kept
            sections["actions"] = promoted
    return sections


# --------------------------------------------------------------------------
# Environment tagging (heuristic; SRD ships no environment data)
# --------------------------------------------------------------------------
ENVIRONMENTS = ["Arctic", "Coastal", "Desert", "Forest", "Grassland", "Hill",
                "Mountain", "Swamp", "Underdark", "Underwater", "Urban", "Planar"]

# name-substring -> environments
NAME_ENV = [
    (r"\b(shark|octopus|crab|squid|whale|reef|merfolk|sahuagin|sea |kraken|hippocampus|storm giant)\b", ["Coastal", "Underwater"]),
    (r"\b(crocodile|frog|toad|lizardfolk|hydra|bullywug|will-o|black dragon)\b", ["Swamp"]),
    (r"\b(polar|frost|ice|white dragon|mammoth|yeti|winter)\b", ["Arctic"]),
    (r"\b(camel|scorpion|blue dragon|brass dragon|mummy|sand|jackal|vulture)\b", ["Desert"]),
    (r"\b(kobold|drow|duergar|derro|grimlock|hook horror|mind flayer|beholder|gelatinous|ochre|grick|carrion crawler|myconid|troglodyte|rust monster|purple worm|umber hulk)\b", ["Underdark"]),
    (r"\b(dryad|pixie|sprite|satyr|blink dog|treant|awakened tree|green dragon|unicorn|centaur|owlbear|stirge|ape|giant spider|panther|boar)\b", ["Forest"]),
    (r"\b(cloud giant|stone giant|fire giant|griffon|roc|manticore|wyvern|red dragon|gold dragon|silver dragon|goat|eagle|pegasus)\b", ["Mountain"]),
    (r"\b(hill giant|ogre|orc|goblin|hobgoblin|bugbear|worg|gnoll|hyena|wolf|hawk|elk|deer|lion|bear|ettin)\b", ["Hill", "Grassland"]),
    (r"\b(cult|guard|noble|knight|thug|bandit|spy|priest|commoner|assassin|mage|veteran|scout|acolyte|gladiator|rat|cat|mastiff|mimic|doppelganger|wererat|animated|homunculus)\b", ["Urban"]),
    (r"\b(zombie|skeleton|ghoul|ghast|wight|wraith|specter|ghost|vampire|lich|shadow|revenant|will-o|poltergeist|banshee)\b", ["Swamp", "Urban", "Underdark"]),
    (r"\b(demon|devil|imp|quasit|hell|balor|pit fiend|glabrezu|vrock|barbed|bearded|erinyes|horned|chain|bone devil|nalfeshnee|marilith|dretch)\b", ["Planar", "Underdark"]),
    (r"\b(angel|deva|planetar|solar|couatl|pegasus|celestial|unicorn)\b", ["Planar"]),
    (r"\b(elemental|mephit|salamander|azer|xorn|gargoyle|invisible stalker|air |water |earth |fire )\b", ["Planar", "Mountain"]),
]

# type -> default environments when nothing else matched
TYPE_ENV = {
    "aberration": ["Underdark"],
    "beast": ["Forest", "Grassland", "Hill"],
    "celestial": ["Planar"],
    "construct": ["Urban", "Underdark"],
    "dragon": ["Mountain", "Hill"],
    "elemental": ["Planar"],
    "fey": ["Forest"],
    "fiend": ["Planar", "Underdark"],
    "giant": ["Hill", "Mountain"],
    "humanoid": ["Grassland", "Urban", "Hill"],
    "monstrosity": ["Hill", "Forest", "Mountain"],
    "ooze": ["Underdark"],
    "plant": ["Forest", "Swamp"],
    "undead": ["Urban", "Swamp"],
}

DRAGON_COLOR_ENV = {
    "white": ["Arctic"], "black": ["Swamp"], "green": ["Forest"],
    "blue": ["Desert"], "red": ["Mountain"], "brass": ["Desert"],
    "copper": ["Hill"], "bronze": ["Coastal"], "silver": ["Mountain"],
    "gold": ["Mountain", "Grassland"],
}


def tag_environments(name: str, mtype: str) -> list[str]:
    low = name.lower()
    envs: list[str] = []
    for pattern, tags in NAME_ENV:
        if re.search(pattern, low):
            for t in tags:
                if t not in envs:
                    envs.append(t)
    if mtype == "dragon":
        for color, tags in DRAGON_COLOR_ENV.items():
            if color in low:
                for t in tags:
                    if t not in envs:
                        envs.append(t)
    if not envs:
        envs = list(TYPE_ENV.get(mtype, ["Grassland"]))
    return envs


# --------------------------------------------------------------------------
# Field helpers
# --------------------------------------------------------------------------
def ability(inst, which):
    v = getattr(inst, which)
    return int(v.value) if hasattr(v, "value") else int(v)


def clean_str(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def build_speed(inst):
    parts = []
    base = getattr(inst, "speed", 0) or 0
    parts.append(f"{int(base)} ft.")
    for attr, label in (("burrow_speed", "burrow"), ("climb_speed", "climb"),
                        ("fly_speed", "fly"), ("swim_speed", "swim")):
        val = getattr(inst, attr, 0) or 0
        if val:
            parts.append(f"{label} {int(val)} ft.")
    return ", ".join(parts)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def collect_classes():
    seen = {}
    for name in dir(monsters_pkg):
        obj = getattr(monsters_pkg, name)
        if inspect.isclass(obj) and issubclass(obj, Monster) and obj is not Monster:
            seen[obj.__name__] = obj
    return seen


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    classes = collect_classes()
    out = []
    for cls in classes.values():
        try:
            inst = cls()
        except Exception as exc:  # pragma: no cover
            print(f"skip {cls.__name__}: {exc}", file=sys.stderr)
            continue
        name = clean_str(getattr(inst, "name", cls.__name__)) or cls.__name__
        size, mtype, alignment, is_swarm = parse_description(getattr(inst, "description", ""))
        fr = cr_to_fraction(getattr(inst, "challenge_rating", 0) or 0)
        sections = parse_docstring(cls.__doc__)
        abilities = {k: ability(inst, a) for k, a in (
            ("str", "strength"), ("dex", "dexterity"), ("con", "constitution"),
            ("int", "intelligence"), ("wis", "wisdom"), ("cha", "charisma"))}
        monster = {
            "slug": slugify(name),
            "name": name,
            "size": size,
            "type": mtype,
            "isSwarm": is_swarm,
            "alignment": alignment,
            "cr": float(fr),
            "crDisplay": cr_display(fr),
            "xp": cr_xp(fr),
            "proficiency": proficiency_bonus(fr),
            "ac": int(getattr(inst, "armor_class", 10) or 10),
            "hp": int(getattr(inst, "hp_max", 1) or 1),
            "hitDice": clean_str(getattr(inst, "hit_dice", "")),
            "speed": build_speed(inst),
            "abilities": abilities,
            "savingThrows": clean_str(getattr(inst, "saving_throws", "")),
            "skills": clean_str(getattr(inst, "skills", "")),
            "damageVulnerabilities": clean_str(getattr(inst, "damage_vulnerabilities", "")),
            "damageResistances": clean_str(getattr(inst, "damage_resistances", "")),
            "damageImmunities": clean_str(getattr(inst, "damage_immunities", "")),
            "conditionImmunities": clean_str(getattr(inst, "condition_immunities", "")),
            "senses": clean_str(getattr(inst, "senses", "")),
            "languages": clean_str(getattr(inst, "languages", "")),
            "environments": tag_environments(name, mtype),
            "traits": sections["traits"],
            "actions": sections["actions"],
            "reactions": sections["reactions"],
            "legendaryActions": sections["legendary_actions"],
            "lairActions": sections["lair_actions"],
        }
        out.append(monster)

    out.sort(key=lambda m: (m["cr"], m["name"]))

    payload = {
        "meta": {
            "source": "dungeonsheets (D&D 5e SRD 5.1)",
            "license": "CC-BY-4.0",
            "attribution": "This work includes material from the System Reference "
                           "Document 5.1 by Wizards of the Coast LLC, available "
                           "under the Creative Commons Attribution 4.0 "
                           "International License.",
            "count": len(out),
            "environments": ENVIRONMENTS,
            "types": TYPES,
            "sizes": SIZES,
        },
        "monsters": out,
    }

    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "data", "monsters.json")
    with open(dest, "w") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print(f"wrote {len(out)} monsters -> {os.path.normpath(dest)}")


if __name__ == "__main__":
    main()

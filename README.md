# 🔮 The Summoning Circle — D&D 5e Monster Picker

A visual, zero-dependency web tool for picking a fitting **Dungeons & Dragons
5th Edition** monster for your party. Set your party level, size, target
difficulty, environment, creature type, size and CR range, then **summon** — an
arcane ritual circle spins through the candidates and lands on one, complete
with its full SRD stat block.

Each monster gets a unique, procedurally-generated **arcane sigil** (original
vector art, seeded by the monster's name and coloured by creature type). Click
the sigil to view it **full-screen and razor-sharp at any resolution** — because
it's SVG, it never pixelates.

## Features

- **373 SRD monsters** with complete stat blocks (traits, actions, reactions,
  legendary & lair actions, ability scores, senses, resistances, etc.).
- **DMG-accurate encounter math** — difficulty is computed from the official XP
  thresholds, and each result tells you roughly how many of that monster make an
  Easy / Medium / Hard / Deadly fight for *your* party (accounting for the
  encounter multiplier).
- **Filters**: party level & size, difficulty, environment, creature type, size,
  and a CR range. The live match count updates as you tweak.
- **Summon animation**, **Re-summon**, and a **Browse matches** grid to pick by
  hand.
- **Click-to-fullscreen** high-resolution portrait view.
- **Optional real artwork**: an off-by-default toggle tries to fetch
  official-style art from a public API when the site is online, and silently
  falls back to the generated sigil if it isn't available.
- **100% static & offline-capable** — no build step, no server, no runtime API
  dependency. The monster data is bundled as JSON.
- Settings persist in `localStorage`; respects `prefers-reduced-motion`.

## Run it

It's a static site — just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` won't work because ES modules and
`fetch()` require an `http(s)` origin — any static server will do, including
GitHub Pages.)

## Project layout

```
index.html            App shell
css/styles.css        Arcane "summoning circle" theme
js/
  app.js              UI orchestration: filters, summon animation, lightbox
  data.js             Loads data/monsters.json, filtering
  encounter.js        DMG XP thresholds, difficulty & encounter multipliers
  portrait.js         Procedural SVG sigil generator (seeded, type-coloured)
  statblock.js        Renders a classic 5e stat block
data/monsters.json    Bundled monster dataset (generated; committed)
tools/build_monsters.py  Regenerates data/monsters.json from the SRD
```

## Regenerating the data

`data/monsters.json` is committed so the app needs nothing else. To rebuild it
from source (e.g. after tweaking environment tags):

```bash
pip install dungeonsheets
python tools/build_monsters.py
```

The script introspects the SRD monster classes bundled with `dungeonsheets`,
normalises the fields, parses the stat-block text into structured
trait/action/legendary entries, derives XP + proficiency bonus from Challenge
Rating, and heuristically tags each monster with likely environments (the SRD
ships no environment data, so those tags are best-effort).

## Attribution & licensing

This tool includes material from the **System Reference Document 5.1** ("SRD
5.1") by Wizards of the Coast LLC, available under the
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode).

The SRD monster data was extracted via the
[`dungeonsheets`](https://pypi.org/project/dungeonsheets/) Python package (its
own code is GPLv3; the SRD content it bundles is the CC-BY-4.0 material above).
The generated sigils and all application code in this repository are original
work.

*Dungeons & Dragons and D&D are trademarks of Wizards of the Coast. This is an
unofficial fan tool and is not affiliated with or endorsed by Wizards of the
Coast.*

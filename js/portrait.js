// Procedurally generates a unique, resolution-independent SVG "arcane portrait"
// for a monster. Because it is vector art it stays razor-sharp at any size,
// which is exactly what the click-to-fullscreen high-res view needs.
//
// Everything is seeded from the monster name, so a given monster always looks
// the same, and colour is driven by creature type for at-a-glance readability.

// -- Type palettes: [deep background, mid, accent glow] -----------------------
const TYPE_PALETTE = {
  aberration:  ["#0c1f2b", "#0f4c5c", "#4de0d0"],
  beast:       ["#1c1710", "#4a3a1e", "#c9a35b"],
  celestial:   ["#2a2410", "#7a6318", "#ffe08a"],
  construct:   ["#1a1712", "#5a4a2e", "#d9a441"],
  dragon:      ["#2a0d0a", "#7a1f14", "#ff6a3d"],
  elemental:   ["#0c1a2a", "#1f5a7a", "#4fd0ff"],
  fey:         ["#1e0f2a", "#5a1f7a", "#e07aff"],
  fiend:       ["#230608", "#7a1010", "#ff3b30"],
  giant:       ["#141a22", "#3a4a5a", "#9fb8d0"],
  humanoid:    ["#151a22", "#3a4a66", "#7fa8d9"],
  monstrosity: ["#1a0f22", "#4a2a5a", "#b06ad0"],
  ooze:        ["#0f1a08", "#3a5a10", "#9ade2b"],
  plant:       ["#0d1a0d", "#1f5a2a", "#5fd06a"],
  undead:      ["#0e1512", "#274a38", "#5fe0a0"],
  default:     ["#161327", "#3a2f66", "#a78bfa"],
};

// -- Type glyphs: simple emblematic SVG paths in a 0..100 box -----------------
// Kept intentionally iconographic (heraldic silhouettes), not literal art.
const TYPE_GLYPH = {
  dragon: "M50 12 C60 22 74 22 82 34 C70 32 66 40 70 50 C82 52 88 66 80 78 C74 66 62 66 58 76 C56 64 44 64 42 76 C38 66 26 66 20 78 C12 66 18 52 30 50 C34 40 30 32 18 34 C26 22 40 22 50 12 Z",
  undead: "M50 16 C34 16 24 28 24 44 C24 54 30 60 30 66 L34 66 L34 58 L40 66 L44 58 L48 66 L52 58 L56 66 L60 58 L66 66 L70 66 C70 60 76 54 76 44 C76 28 66 16 50 16 Z M38 40 A5 5 0 1 0 39 40 M62 40 A5 5 0 1 0 63 40",
  beast: "M30 30 L22 18 L34 26 C40 22 60 22 66 26 L78 18 L70 30 C78 40 76 60 62 70 C54 76 46 76 38 70 C24 60 22 40 30 30 Z M42 46 A3 3 0 1 0 43 46 M58 46 A3 3 0 1 0 59 46",
  fiend: "M26 20 C34 26 38 22 42 28 C46 20 54 20 58 28 C62 22 66 26 74 20 C72 34 78 40 74 52 C68 72 56 82 50 82 C44 82 32 72 26 52 C22 40 28 34 26 20 Z",
  celestial: "M50 10 L58 34 L84 34 L63 50 L71 76 L50 60 L29 76 L37 50 L16 34 L42 34 Z",
  fey: "M50 14 C58 30 74 30 82 24 C74 38 74 44 84 52 C70 52 62 62 62 78 C56 66 44 66 38 78 C38 62 30 52 16 52 C26 44 26 38 18 24 C26 30 42 30 50 14 Z",
  elemental: "M50 12 C58 30 76 36 72 56 C70 74 58 82 50 82 C42 82 30 74 28 56 C24 36 42 30 50 12 Z",
  ooze: "M28 44 C24 30 40 26 50 30 C60 26 78 32 72 48 C80 58 72 74 58 72 C52 80 40 80 36 70 C24 70 22 54 28 44 Z",
  plant: "M50 84 L50 44 M50 52 C40 52 30 44 30 32 C42 32 50 40 50 52 M50 46 C60 46 70 38 70 26 C58 26 50 34 50 46 M50 84 C46 84 44 80 44 76 L56 76 C56 80 54 84 50 84 Z",
  construct: "M34 24 L66 24 L66 34 L74 34 L74 66 L66 66 L66 78 L34 78 L34 66 L26 66 L26 34 L34 34 Z M42 44 A4 4 0 1 0 43 44 M58 44 A4 4 0 1 0 59 44 M42 62 L58 62",
  giant: "M50 16 A8 8 0 1 0 50 32 A8 8 0 1 0 50 16 M38 36 L62 36 L58 60 L54 60 L54 84 L46 84 L46 60 L42 60 Z",
  humanoid: "M50 18 A8 8 0 1 0 50 34 A8 8 0 1 0 50 18 M40 38 L60 38 L58 62 L52 62 L52 82 L48 82 L48 62 L42 62 Z",
  aberration: "M50 50 m-28 0 a28 22 0 1 0 56 0 a28 22 0 1 0 -56 0 M38 46 A5 6 0 1 0 39 46 M62 46 A5 6 0 1 0 63 46 M50 44 A4 5 0 1 0 51 44 M34 62 Q50 72 66 62",
  monstrosity: "M50 14 L60 30 L78 26 L68 42 L82 52 L64 56 L66 74 L50 64 L34 74 L36 56 L18 52 L32 42 L22 26 L40 30 Z",
  default: "M50 12 L61 39 L90 39 L67 57 L75 86 L50 68 L25 86 L33 57 L10 39 L39 39 Z",
};

// -- Deterministic hashing / PRNG --------------------------------------------
function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function palette(type) {
  return TYPE_PALETTE[type] || TYPE_PALETTE.default;
}

function glyphFor(type) {
  return TYPE_GLYPH[type] || TYPE_GLYPH.default;
}

// Build a set of short rune-like strokes around a ring (unique per monster).
function runeRing(rand, cx, cy, radius, count, color) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(ang) * radius;
    const y = cy + Math.sin(ang) * radius;
    const seg = 2 + Math.floor(rand() * 3);
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    let px = x, py = y;
    for (let s = 0; s < seg; s++) {
      const len = 3 + rand() * 6;
      const dir = ang + Math.PI / 2 + (rand() - 0.5) * 2;
      px += Math.cos(dir) * len;
      py += Math.sin(dir) * len;
      d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>`;
  }
  return out;
}

// A "magical signature": points on a circle connected into a star polygon.
function sigil(rand, cx, cy, radius, color) {
  const n = 5 + Math.floor(rand() * 4);
  const pts = [];
  const offset = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const ang = offset + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius]);
  }
  const step = 1 + Math.floor(rand() * (Math.floor(n / 2)));
  let d = "";
  let idx = 0;
  for (let i = 0; i <= n; i++) {
    const [x, y] = pts[idx % n];
    d += (i === 0 ? "M" : "L") + ` ${x.toFixed(1)} ${y.toFixed(1)} `;
    idx += step;
  }
  let dots = "";
  for (const [x, y] of pts) {
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${color}"/>`;
  }
  return `<path d="${d}Z" fill="none" stroke="${color}" stroke-width="1" opacity="0.55"/>${dots}`;
}

/**
 * Returns an SVG string for the given monster.
 * @param {object} monster - a monster record from monsters.json
 * @param {object} [opts]  - { size: number }
 */
export function monsterPortrait(monster, opts = {}) {
  const size = opts.size || 320;
  const [bg0, bg1, accent] = palette(monster.type);
  const seed = hashStr(monster.name + "|" + monster.type);
  const rand = mulberry32(seed);
  const uid = "p" + seed.toString(36);
  const cx = 100, cy = 100;

  // subtle per-monster hue rotation of the accent for variety
  const hueShift = Math.floor(rand() * 40) - 20;

  const glyph = glyphFor(monster.type);
  const rings = runeRing(rand, cx, cy, 84, 20 + Math.floor(rand() * 12), accent);
  const inner = runeRing(rand, cx, cy, 66, 14 + Math.floor(rand() * 8), accent);
  const sig = sigil(rand, cx, cy, 52, accent);
  const rot = (rand() * 360).toFixed(0);

  return `
<svg viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttr(monster.name)} sigil">
  <defs>
    <radialGradient id="${uid}-bg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="70%" stop-color="${bg0}"/>
      <stop offset="100%" stop-color="#05060a"/>
    </radialGradient>
    <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="${uid}-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
    <filter id="${uid}-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>

  <rect width="200" height="200" fill="url(#${uid}-bg)"/>
  <circle cx="${cx}" cy="${cy}" r="70" fill="url(#${uid}-glow)" filter="url(#${uid}-blur)"/>

  <g style="filter:hue-rotate(${hueShift}deg)">
    <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="${accent}" stroke-width="1" opacity="0.35"/>
    <circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.30"/>
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.30"/>
    <g transform="rotate(${rot} ${cx} ${cy})">${rings}</g>
    <g transform="rotate(${-rot} ${cx} ${cy})">${inner}</g>
    ${sig}
    <g transform="translate(50 50) scale(1.0)" fill="${accent}" stroke="${accent}" stroke-width="1.2" stroke-linejoin="round" opacity="0.96" filter="url(#${uid}-soft)">
      <path d="${glyph}"/>
    </g>
  </g>
</svg>`.trim();
}

// Turn the SVG string into a data URL (handy for <img> / CSS backgrounds).
export function portraitDataUrl(monster, opts) {
  const svg = monsterPortrait(monster, opts);
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

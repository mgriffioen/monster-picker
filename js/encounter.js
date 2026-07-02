// Encounter math from the D&D 5e Dungeon Master's Guide.
// XP thresholds are *per character*; multiply by party size for the party total.

// [easy, medium, hard, deadly] per character level (1-20)
export const XP_THRESHOLDS = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1300, 2000],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4800],
  13: [1100, 2200, 3400, 5200],
  14: [1250, 2500, 3800, 5900],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 6800],
  17: [2000, 3900, 5900, 7200],
  18: [2100, 4200, 6300, 7600],
  19: [2400, 4900, 7300, 8500],
  20: [2800, 5700, 8500, 12700],
};

export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Deadly"];

// Encounter multiplier as a function of the number of monsters (DMG p.82).
export function encounterMultiplier(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

// Party thresholds as absolute XP: {Easy, Medium, Hard, Deadly}
export function partyThresholds(level, partySize) {
  const row = XP_THRESHOLDS[level] || XP_THRESHOLDS[1];
  return {
    Easy: row[0] * partySize,
    Medium: row[1] * partySize,
    Hard: row[2] * partySize,
    Deadly: row[3] * partySize,
  };
}

// Classify a single monster's solo difficulty against a party.
export function soloDifficulty(monsterXp, level, partySize) {
  const t = partyThresholds(level, partySize);
  if (monsterXp >= t.Deadly * 2) return "Lethal";
  if (monsterXp >= t.Deadly) return "Deadly";
  if (monsterXp >= t.Hard) return "Hard";
  if (monsterXp >= t.Medium) return "Medium";
  if (monsterXp >= t.Easy) return "Easy";
  return "Trivial";
}

// How many copies of one monster produce the target difficulty for this party,
// accounting for the encounter multiplier. Returns the largest count whose
// adjusted XP is <= the target's *next* band (i.e. still reads as `target`).
export function suggestedCount(monsterXp, level, partySize, target) {
  const t = partyThresholds(level, partySize);
  const order = ["Easy", "Medium", "Hard", "Deadly"];
  const idx = order.indexOf(target);
  const floor = t[target];
  const ceil = idx < 3 ? t[order[idx + 1]] : t.Deadly * 1.6; // headroom past deadly
  let best = 0;
  for (let n = 1; n <= 30; n++) {
    const adj = monsterXp * n * encounterMultiplier(n);
    if (adj >= floor && adj < ceil) best = n;
    if (adj >= ceil) break;
  }
  // If a single one already exceeds the ceiling, one is the honest answer.
  if (best === 0 && monsterXp >= floor) best = 1;
  return best;
}

// Adjusted XP for an encounter of `count` identical monsters.
export function adjustedXp(monsterXp, count) {
  return Math.round(monsterXp * count * encounterMultiplier(count));
}

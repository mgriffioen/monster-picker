// Loads the bundled monster dataset and exposes filtering helpers.
import { soloDifficulty } from "./encounter.js";

let DATA = null;

export async function loadData() {
  if (DATA) return DATA;
  const res = await fetch("./data/monsters.json");
  if (!res.ok) throw new Error(`Failed to load monster data (${res.status})`);
  DATA = await res.json();
  return DATA;
}

export function allMonsters() {
  return DATA ? DATA.monsters : [];
}

export function meta() {
  return DATA ? DATA.meta : null;
}

/**
 * Filter monsters by the current picker parameters.
 * @param {object} f
 *   level, partySize, difficulty (or "Any"),
 *   environment (or "Any"), types (Set|null), sizes (Set|null),
 *   crMin, crMax
 */
export function filterMonsters(f) {
  return allMonsters().filter((m) => {
    if (f.environment && f.environment !== "Any" &&
        !m.environments.includes(f.environment)) return false;
    if (f.types && f.types.size && !f.types.has(m.type)) return false;
    if (f.sizes && f.sizes.size && !f.sizes.has(m.size)) return false;
    if (f.crMin != null && m.cr < f.crMin) return false;
    if (f.crMax != null && m.cr > f.crMax) return false;
    if (f.difficulty && f.difficulty !== "Any") {
      const d = soloDifficulty(m.xp, f.level, f.partySize);
      if (d !== f.difficulty) return false;
    }
    return true;
  });
}

export function getBySlug(slug) {
  return allMonsters().find((m) => m.slug === slug) || null;
}

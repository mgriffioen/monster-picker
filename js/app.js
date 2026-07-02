import { loadData, meta, filterMonsters } from "./data.js";
import { monsterPortrait } from "./portrait.js";
import { renderStatBlock } from "./statblock.js";
import { soloDifficulty, suggestedCount, adjustedXp, partyThresholds } from "./encounter.js";

const $ = (sel) => document.querySelector(sel);
const el = (id) => document.getElementById(id);

const STORE_KEY = "monster-picker:v1";
const ART_BASE = "https://www.dnd5eapi.co/api/images/monsters/"; // {slug}.png

const state = {
  level: 5,
  partySize: 4,
  difficulty: "Any",
  environment: "Any",
  types: new Set(),
  sizes: new Set(),
  crMin: 0,
  crMax: 30,
  tryArt: false,
  current: null,
  spinning: false,
};

const CR_STEPS = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const crLabel = (v) => (v === 0.125 ? "1/8" : v === 0.25 ? "1/4" : v === 0.5 ? "1/2" : String(v));

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------
init();

async function init() {
  restore();
  try {
    await loadData();
  } catch (err) {
    el("stageLabel").textContent = "Could not load monster data.";
    console.error(err);
    return;
  }
  buildControls();
  bindEvents();
  refreshMatchCount();
  idleStage();
}

// --------------------------------------------------------------------------
// Controls
// --------------------------------------------------------------------------
function buildControls() {
  const m = meta();

  el("level").value = state.level;
  el("levelOut").textContent = state.level;
  el("partySize").value = state.partySize;
  el("partySizeOut").textContent = state.partySize;

  fillSelect(el("difficulty"), ["Any", "Easy", "Medium", "Hard", "Deadly"], state.difficulty);
  fillSelect(el("environment"), ["Any", ...m.environments], state.environment);

  fillSelect(el("crMin"), CR_STEPS.map((v) => ({ value: v, label: crLabel(v) })), state.crMin);
  fillSelect(el("crMax"), CR_STEPS.map((v) => ({ value: v, label: crLabel(v) })), state.crMax);

  el("typeChips").innerHTML = m.types.map((t) =>
    chip(t, "type", state.types.has(t))).join("");
  el("sizeChips").innerHTML = m.sizes.map((s) =>
    chip(s, "size", state.sizes.has(s))).join("");

  el("artToggle").checked = state.tryArt;
}

function chip(value, group, active) {
  return `<button type="button" class="chip${active ? " chip--on" : ""}"
    data-group="${group}" data-value="${value}">${cap(value)}</button>`;
}

function fillSelect(select, items, selected) {
  select.innerHTML = items.map((it) => {
    const value = typeof it === "object" ? it.value : it;
    const label = typeof it === "object" ? it.label : it;
    const sel = String(value) === String(selected) ? " selected" : "";
    return `<option value="${value}"${sel}>${label}</option>`;
  }).join("");
}

function bindEvents() {
  el("level").addEventListener("input", (e) => {
    state.level = +e.target.value; el("levelOut").textContent = state.level;
    onParamChange();
  });
  el("partySize").addEventListener("input", (e) => {
    state.partySize = +e.target.value; el("partySizeOut").textContent = state.partySize;
    onParamChange();
  });
  el("difficulty").addEventListener("change", (e) => { state.difficulty = e.target.value; onParamChange(); });
  el("environment").addEventListener("change", (e) => { state.environment = e.target.value; onParamChange(); });
  el("crMin").addEventListener("change", (e) => { state.crMin = +e.target.value; onParamChange(); });
  el("crMax").addEventListener("change", (e) => { state.crMax = +e.target.value; onParamChange(); });

  document.querySelectorAll("#typeChips, #sizeChips").forEach((host) => {
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const set = btn.dataset.group === "type" ? state.types : state.sizes;
      const v = btn.dataset.value;
      if (set.has(v)) set.delete(v); else set.add(v);
      btn.classList.toggle("chip--on");
      onParamChange();
    });
  });

  el("artToggle").addEventListener("change", (e) => {
    state.tryArt = e.target.checked; persist();
    if (state.current) upgradeArt(state.current);
  });

  el("summonBtn").addEventListener("click", summon);
  el("resummonBtn").addEventListener("click", summon);
  el("browseBtn").addEventListener("click", toggleBrowse);
  el("copyBtn").addEventListener("click", copyStatBlock);
  el("resetBtn").addEventListener("click", resetFilters);

  el("portraitHost").addEventListener("click", () => {
    if (state.current) openLightbox(state.current);
  });
  el("portraitHost").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && state.current) {
      e.preventDefault();
      openLightbox(state.current);
    }
  });
  el("lightboxClose").addEventListener("click", closeLightbox);
  el("lightbox").addEventListener("click", (e) => {
    if (e.target === el("lightbox")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function onParamChange() {
  persist();
  refreshMatchCount();
}

function resetFilters() {
  Object.assign(state, {
    difficulty: "Any", environment: "Any", crMin: 0, crMax: 30,
    types: new Set(), sizes: new Set(),
  });
  buildControls();
  onParamChange();
}

// --------------------------------------------------------------------------
// Matching
// --------------------------------------------------------------------------
function candidates() {
  return filterMonsters({
    level: state.level, partySize: state.partySize,
    difficulty: state.difficulty, environment: state.environment,
    types: state.types, sizes: state.sizes,
    crMin: state.crMin, crMax: state.crMax,
  });
}

function refreshMatchCount() {
  const n = candidates().length;
  el("matchCount").textContent = n;
  el("summonBtn").disabled = n === 0;
  el("browseBtn").disabled = n === 0;
  el("noMatch").hidden = n !== 0;
}

// --------------------------------------------------------------------------
// Summon animation
// --------------------------------------------------------------------------
function summon() {
  if (state.spinning) return;
  const pool = candidates();
  if (!pool.length) return;

  state.spinning = true;
  el("stage").classList.add("is-spinning");
  el("stage").classList.remove("is-idle", "is-revealed");
  el("resultPanel").hidden = true;
  el("browsePanel").hidden = true;

  const host = el("portraitHost");
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const final = pick();

  // Decelerating reel: intervals grow from ~55ms to ~260ms over ~2.1s.
  const delays = [];
  let t = 55;
  while (t < 260) { delays.push(t); t = Math.round(t * 1.14); }
  delays.push(300, 360);

  let i = 0;
  const step = () => {
    const m = i >= delays.length ? final : pick();
    host.innerHTML = monsterPortrait(m, { size: 300 });
    el("stageLabel").textContent = i >= delays.length ? "" : "summoning…";
    if (i >= delays.length) {
      land(final);
      return;
    }
    setTimeout(step, delays[i++]);
  };
  step();
}

function land(m) {
  state.current = m;
  state.spinning = false;
  el("stage").classList.remove("is-spinning");
  el("stage").classList.add("is-revealed");
  el("portraitHost").innerHTML = monsterPortrait(m, { size: 300 });
  el("stageLabel").textContent = "";
  renderResult(m);
  if (state.tryArt) upgradeArt(m);
}

// --------------------------------------------------------------------------
// Result rendering
// --------------------------------------------------------------------------
function renderResult(m) {
  const panel = el("resultPanel");
  panel.hidden = false;

  el("resultName").textContent = m.name;
  el("resultSub").textContent =
    `${m.size} ${m.type}${m.isSwarm ? " (swarm)" : ""}${m.alignment ? ", " + m.alignment : ""}`;

  const diff = soloDifficulty(m.xp, state.level, state.partySize);
  const badge = el("difficultyBadge");
  badge.textContent = `${diff} solo`;
  badge.className = "badge badge--" + diff.toLowerCase();

  // Suggested count for the chosen difficulty (or for Medium if "Any").
  const target = state.difficulty === "Any" ? "Medium" : state.difficulty;
  const n = suggestedCount(m.xp, state.level, state.partySize, target);
  const adj = n ? adjustedXp(m.xp, n) : 0;
  el("countHint").innerHTML = n
    ? `For a <strong>${target}</strong> fight: about <strong>${n}× ${escapeHtml(m.name)}</strong>
       <span class="muted">(~${adj.toLocaleString()} adjusted XP)</span>`
    : `A single <strong>${escapeHtml(m.name)}</strong> already exceeds a ${target} encounter for this party.`;

  el("crChip").textContent = `CR ${m.crDisplay}`;
  el("xpChip").textContent = `${m.xp.toLocaleString()} XP`;
  el("envChips").innerHTML = m.environments
    .map((e) => `<span class="tag">${e}</span>`).join("");

  el("statblockHost").innerHTML = renderStatBlock(m);
  el("artBadge").hidden = true;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --------------------------------------------------------------------------
// Optional real-art upgrade (best effort; needs internet + coverage)
// --------------------------------------------------------------------------
function upgradeArt(m) {
  const url = ART_BASE + m.slug + ".png";
  const img = new Image();
  img.onload = () => {
    if (state.current !== m) return;
    const host = el("portraitHost");
    host.innerHTML =
      `<img class="real-art" src="${url}" alt="${escapeHtml(m.name)} artwork">`;
    host.dataset.artUrl = url;
    el("artBadge").hidden = false;
  };
  img.onerror = () => { delete el("portraitHost").dataset.artUrl; };
  img.src = url;
}

// --------------------------------------------------------------------------
// Browse matches
// --------------------------------------------------------------------------
function toggleBrowse() {
  const panel = el("browsePanel");
  if (!panel.hidden) { panel.hidden = true; return; }
  const pool = candidates().slice().sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name));
  el("browseGrid").innerHTML = pool.map((m) => `
    <button class="browse-card" data-slug="${m.slug}" title="${escapeHtml(m.name)} — CR ${m.crDisplay}">
      ${monsterPortrait(m, { size: 96 })}
      <span class="browse-name">${escapeHtml(m.name)}</span>
      <span class="browse-cr">CR ${m.crDisplay}</span>
    </button>`).join("");
  panel.hidden = false;
  el("browseGrid").onclick = (e) => {
    const card = e.target.closest(".browse-card");
    if (!card) return;
    const m = pool.find((x) => x.slug === card.dataset.slug);
    if (m) { el("stage").classList.add("is-revealed"); land(m); }
  };
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --------------------------------------------------------------------------
// Lightbox (full-screen high-res)
// --------------------------------------------------------------------------
function openLightbox(m) {
  const box = el("lightbox");
  const artUrl = el("portraitHost").dataset.artUrl;
  el("lightboxArt").innerHTML = artUrl
    ? `<img class="lightbox-real" src="${artUrl}" alt="${escapeHtml(m.name)} artwork">`
    : monsterPortrait(m, { size: 900 });
  el("lightboxName").textContent = m.name;
  el("lightboxMeta").textContent =
    `${m.size} ${m.type} · CR ${m.crDisplay} · ${m.xp.toLocaleString()} XP`;
  box.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  el("lightbox").hidden = true;
  document.body.style.overflow = "";
}

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------
function copyStatBlock() {
  if (!state.current) return;
  navigator.clipboard.writeText(statBlockText(state.current)).then(() => {
    flash(el("copyBtn"), "Copied!");
  }).catch(() => flash(el("copyBtn"), "Copy failed"));
}

function statBlockText(m) {
  const L = [];
  L.push(m.name);
  L.push(`${m.size} ${m.type}${m.alignment ? ", " + m.alignment : ""}`);
  L.push(`Armor Class ${m.ac}`);
  L.push(`Hit Points ${m.hp}${m.hitDice ? ` (${m.hitDice})` : ""}`);
  L.push(`Speed ${m.speed}`);
  L.push(`STR ${m.abilities.str} DEX ${m.abilities.dex} CON ${m.abilities.con} INT ${m.abilities.int} WIS ${m.abilities.wis} CHA ${m.abilities.cha}`);
  const kv = [["Saving Throws", m.savingThrows], ["Skills", m.skills],
    ["Damage Resistances", m.damageResistances], ["Damage Immunities", m.damageImmunities],
    ["Condition Immunities", m.conditionImmunities], ["Senses", m.senses],
    ["Languages", m.languages], ["Challenge", `${m.crDisplay} (${m.xp} XP)`]];
  for (const [k, v] of kv) if (v) L.push(`${k} ${v}`);
  const sec = (title, arr) => {
    if (!arr || !arr.length) return;
    if (title) L.push(`\n${title}`);
    for (const e of arr) L.push(`${e.name ? e.name + ". " : ""}${e.desc}`);
  };
  L.push("");
  sec("", m.traits);
  sec("ACTIONS", m.actions);
  sec("REACTIONS", m.reactions);
  sec("LEGENDARY ACTIONS", m.legendaryActions);
  sec("LAIR ACTIONS", m.lairActions);
  return L.join("\n");
}

function flash(node, msg) {
  const prev = node.textContent;
  node.textContent = msg;
  setTimeout(() => { node.textContent = prev; }, 1400);
}

function idleStage() {
  el("stage").classList.add("is-idle");
  el("stageLabel").textContent = "Set your parameters, then summon.";
}

function persist() {
  const payload = {
    level: state.level, partySize: state.partySize, difficulty: state.difficulty,
    environment: state.environment, crMin: state.crMin, crMax: state.crMax,
    types: [...state.types], sizes: [...state.sizes], tryArt: state.tryArt,
  };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); } catch {}
}

function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    Object.assign(state, {
      level: p.level ?? state.level,
      partySize: p.partySize ?? state.partySize,
      difficulty: p.difficulty ?? state.difficulty,
      environment: p.environment ?? state.environment,
      crMin: p.crMin ?? state.crMin,
      crMax: p.crMax ?? state.crMax,
      tryArt: !!p.tryArt,
      types: new Set(p.types || []),
      sizes: new Set(p.sizes || []),
    });
  } catch {}
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

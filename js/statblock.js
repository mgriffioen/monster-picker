// Renders a classic 5e-style stat block as an HTML string.

const ABIL = [
  ["str", "STR"], ["dex", "DEX"], ["con", "CON"],
  ["int", "INT"], ["wis", "WIS"], ["cha", "CHA"],
];

function mod(score) {
  const m = Math.floor((score - 10) / 2);
  return (m >= 0 ? "+" : "") + m;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Bold the leading "Name." of an action/trait, keep the rest as text.
function entryHtml(entry) {
  const name = entry.name ? `<strong>${esc(entry.name)}.</strong> ` : "";
  const body = esc(entry.desc).replace(/\n\n/g, "<br><br>").replace(/\n/g, " ");
  return `<p class="sb-entry">${name}${body}</p>`;
}

function line(label, value) {
  if (!value) return "";
  return `<div class="sb-line"><span class="sb-label">${label}</span> ${esc(value)}</div>`;
}

function section(title, entries, extraClass = "") {
  if (!entries || !entries.length) return "";
  return `<div class="sb-section ${extraClass}">
    ${title ? `<h4 class="sb-section-title">${title}</h4>` : ""}
    ${entries.map(entryHtml).join("")}
  </div>`;
}

export function renderStatBlock(m) {
  const typeLine = `${m.size} ${m.type}${m.isSwarm ? " (swarm)" : ""}${m.alignment ? ", " + m.alignment : ""}`;
  const abilities = ABIL.map(([k, lbl]) => {
    const score = m.abilities[k];
    return `<div class="sb-ability"><div class="sb-ability-name">${lbl}</div>
      <div class="sb-ability-score">${score} <span>(${mod(score)})</span></div></div>`;
  }).join("");

  return `
  <article class="statblock" aria-label="${esc(m.name)} stat block">
    <header class="sb-head">
      <h2 class="sb-name">${esc(m.name)}</h2>
      <p class="sb-type">${esc(typeLine)}</p>
    </header>
    <div class="sb-rule"></div>
    <div class="sb-top">
      ${line("Armor Class", m.ac)}
      ${line("Hit Points", `${m.hp}${m.hitDice ? ` (${m.hitDice})` : ""}`)}
      ${line("Speed", m.speed)}
    </div>
    <div class="sb-rule"></div>
    <div class="sb-abilities">${abilities}</div>
    <div class="sb-rule"></div>
    <div class="sb-details">
      ${line("Saving Throws", m.savingThrows)}
      ${line("Skills", m.skills)}
      ${line("Damage Vulnerabilities", m.damageVulnerabilities)}
      ${line("Damage Resistances", m.damageResistances)}
      ${line("Damage Immunities", m.damageImmunities)}
      ${line("Condition Immunities", m.conditionImmunities)}
      ${line("Senses", m.senses)}
      ${line("Languages", m.languages || "—")}
      ${line("Challenge", `${m.crDisplay} (${m.xp.toLocaleString()} XP)`)}
      ${line("Proficiency Bonus", `+${m.proficiency}`)}
    </div>
    <div class="sb-rule"></div>
    ${section("", m.traits)}
    ${section("Actions", m.actions, "sb-actions")}
    ${section("Reactions", m.reactions, "sb-actions")}
    ${section("Legendary Actions", m.legendaryActions, "sb-actions")}
    ${section("Lair Actions", m.lairActions, "sb-actions")}
  </article>`;
}

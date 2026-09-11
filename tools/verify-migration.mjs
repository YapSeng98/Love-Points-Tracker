#!/usr/bin/env node
// Compares the migrated Supabase data against ServiceNow, field by field.
// Read-only on both sides. Run after tools/migrate-to-supabase.mjs.
//
//   node tools/verify-migration.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SN_BASE = "https://dev405150.service-now.com/api/x_887486_love_app/love_score";
const SB = "https://yvllstktmjoedfsgojgs.supabase.co/functions/v1";
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";

let pass = 0, fail = 0; const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
function eq(name, a, b) { check(`${name}: ${JSON.stringify(a)}`, JSON.stringify(a) === JSON.stringify(b), `SN=${JSON.stringify(a)} SB=${JSON.stringify(b)}`); }

function unwrap(j) {
  let d = j && j.result !== undefined ? j.result : j;
  if (d && typeof d === "object" && !Array.isArray(d) && d.result !== undefined) d = d.result;
  return d;
}
const snKey = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/backup.local.json"), "utf8")).char1.apiKey;
const sn = async (p) => unwrap(await (await fetch(SN_BASE + p, {
  headers: { Authorization: "Bearer " + snKey, Accept: "application/json" },
})).json());

let token;
const sb = async (p, opts = {}) => {
  const res = await fetch(SB + p, {
    ...opts,
    headers: { apikey: SB_KEY, "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
};

async function main() {
  const creds = fs.readFileSync(path.join(ROOT, ".migration-credentials.txt"), "utf8");
  const m = /^\s{2}(\S+)\s+(\S+)$/m.exec(creds);
  const [, username, password] = m;

  const login = await (await fetch(`${SB}/auth-login`, {
    method: "POST",
    headers: { apikey: SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })).json();
  if (!login.accessToken) throw new Error("supabase login failed: " + JSON.stringify(login));
  token = login.accessToken;
  console.log(`logged into Supabase as ${username} (${login.charId})\n`);

  // ------------------------------------------------------------- config
  console.log("=== config ===");
  const snCfg = await sn("/config"), sbCfg = await sb("/config");
  for (const k of ["mode", "rewardTarget", "punishThreshold", "startDate", "char1Name", "char2Name",
    "goalName", "goalIcon", "goalTarget", "petName", "petSpecies", "petExp", "petBase", "petEquipped"]) {
    eq(k, snCfg[k], sbCfg[k]);
  }
  check("avatars carried over", (!!snCfg.charImg1) === (!!sbCfg.charImg1) && (!!snCfg.charImg2) === (!!sbCfg.charImg2));

  // ------------------------------------------------------------ entries
  console.log("\n=== entries (the couple's actual score) ===");
  const snUn = await sn("/entries"), sbUn = await sb("/entries");
  eq("unsettled entry count", snUn.length, sbUn.length);
  const sum = (rows, c) => rows.filter((e) => (e.charId || "char1") === c).reduce((s, e) => s + e.pts, 0);
  eq("char1 current score", sum(snUn, "char1"), sum(sbUn, "char1"));
  eq("char2 current score", sum(snUn, "char2"), sum(sbUn, "char2"));

  // Compare meaning, not encoding (CLAUDE.md §9.1): ServiceNow returns null
  // for an empty note, Postgres returns "" — same thing to every consumer.
  // Entries are counted as a multiset because the same person legitimately
  // logs the same category twice in a day, so keys are not unique.
  const norm = (e) => `${e.date}|${e.pts}|${e.catName || ""}|${e.desc || ""}|${e.charId || "char1"}|${e.month}`;
  const tally = (rows) => {
    const m = new Map();
    for (const e of rows) m.set(norm(e), (m.get(norm(e)) || 0) + 1);
    return m;
  };
  const years = [2024, 2025, 2026];
  const snRows = [], sbRows = [];
  for (const y of years) {
    snRows.push(...await sn(`/entries?year=${y}`));
    sbRows.push(...await sb(`/entries?year=${y}`));
  }
  eq("total entries ever (settled + unsettled)", snRows.length, sbRows.length);
  const snT = tally(snRows), sbT = tally(sbRows);
  const missing = [...snT.entries()].filter(([k, n]) => (sbT.get(k) || 0) !== n);
  check("every ServiceNow entry exists in Supabase, same multiplicity", missing.length === 0,
    `${missing.length} differing, e.g. ${missing.slice(0, 2).map(([k, n]) => `${k} SN×${n} SB×${sbT.get(k) || 0}`)}`);
  eq("lifetime points total", snRows.reduce((s, e) => s + e.pts, 0), sbRows.reduce((s, e) => s + e.pts, 0));

  // ----------------------------------------------------------- history
  console.log("\n=== settled history ===");
  const snH = await sn("/history"), sbH = await sb("/history");
  eq("settled month count", snH.length, sbH.length);
  for (const h of snH) {
    const match = sbH.find((x) => x.month === h.month);
    check(`${h.month} archived`, !!match);
    if (match) {
      eq(`${h.month} char1Pts`, h.char1Pts, match.char1Pts);
      eq(`${h.month} char2Pts`, h.char2Pts, match.char2Pts);
      eq(`${h.month} result1`, h.result1, match.result1);
      eq(`${h.month} result2`, h.result2, match.result2);
    }
  }

  // -------------------------------------------- categories / shop / rewards
  console.log("\n=== catalogs ===");
  const pairs = [["categories", "/categories", (x) => `${x.name}|${x.pts}|${x.icon}`],
                 ["shop", "/shop", (x) => `${x.name}|${x.ptsCost}`],
                 ["rewards", "/rewards", (x) => `${x.name}|${x.minPts}`],
                 ["punishments", "/punishments", (x) => `${x.name}|${x.minPts}`]];
  for (const [label, p, keyf] of pairs) {
    const a = await sn(p), b = await sb(p);
    eq(`${label} count`, a.length, b.length);
    const bKeys = new Set(b.map(keyf));
    check(`${label} all present with same values`, a.every((x) => bKeys.has(keyf(x))),
      `missing: ${a.filter((x) => !bKeys.has(keyf(x))).map(keyf).slice(0, 3)}`);
  }
  const snR = await sn("/rewards"), sbR = await sb("/rewards");
  for (const r of snR) {
    const b = sbR.find((x) => x.name === r.name);
    if (b) check(`reward "${r.name}" claim flags preserved`, r.claimed1 === b.claimed1 && r.claimed2 === b.claimed2,
      `SN ${r.claimed1}/${r.claimed2} SB ${b.claimed1}/${b.claimed2}`);
  }

  // ----------------------------------------------------------- letters
  console.log("\n=== letters ===");
  const snL = await sn("/letters"), sbL = await sb("/letters");
  eq("letter count", snL.length, sbL.length);
  const sbLKeys = new Set(sbL.map((l) => `${l.text}|${l.charId}`));
  check("every letter's text + sender preserved", snL.every((l) => sbLKeys.has(`${l.text}|${l.charId}`)));
  eq("opened-letter count", snL.filter((l) => l.opened).length, sbL.filter((l) => l.opened).length);
  const snDates = snL.map((l) => l.date).sort(), sbDates = sbL.map((l) => l.date).sort();
  check("letter timestamps unchanged (no tz shift)", JSON.stringify(snDates) === JSON.stringify(sbDates),
    `first differing: ${snDates.find((d, i) => d !== sbDates[i])} vs ${sbDates.find((d, i) => d !== snDates[i])}`);

  // ------------------------------------------------------------ photos
  console.log("\n=== photos ===");
  const snP = await sn("/photos"), sbP = await sb("/photos");
  eq("photo count", snP.length, sbP.length);
  const sbPKeys = new Set(sbP.map((p) => `${p.caption}|${p.date}`));
  check("captions + dates preserved", snP.every((p) => sbPKeys.has(`${p.caption}|${p.date}`)));
  check("all photos now served as signed URLs", sbP.every((p) => p.image.startsWith("http")));
  let bytesOk = 0;
  for (const p of sbP) {
    const r = await fetch(p.image);
    if (r.ok && (await r.arrayBuffer()).byteLength > 0) bytesOk++;
  }
  eq("photos that actually download", snP.length, bytesOk);

  // ------------------------------------------------- furniture / keepsakes
  console.log("\n=== 小窝 furniture (incl. year-locked keepsakes) ===");
  const snD = await sn("/bag?type=decor"), sbD = await sb("/bag?type=decor");
  eq("furniture count", snD.length, sbD.length);
  const sbIds = new Set(sbD.map((d) => d.itemId));
  const missingDecor = snD.filter((d) => !sbIds.has(d.itemId));
  check("every furniture catalog id preserved", missingDecor.length === 0,
    `missing: ${missingDecor.map((d) => d.itemId)}`);
  eq("total 小窝币 spent (the coin ledger)",
    snD.reduce((s, d) => s + d.ptsSpent, 0), sbD.reduce((s, d) => s + d.ptsSpent, 0));
  check("pet room layout (pet_equipped) preserved", snCfg.petEquipped === sbCfg.petEquipped);

  // --------------------------------------------------------------- bag
  console.log("\n=== bag ===");
  const snB = await sn("/bag"), sbB = await sb("/bag");
  eq("active bag count (char1)", snB.length, sbB.length);
  const snBH = await sn("/bag/history"), sbBH = await sb("/bag-history");
  eq("used bag count (char1)", snBH.length, sbBH.length);

  console.log(`\n${"=".repeat(52)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log(`  failing:\n   - ${failures.join("\n   - ")}`);
  console.log(`${"=".repeat(52)}`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("✖", e); process.exit(1); });

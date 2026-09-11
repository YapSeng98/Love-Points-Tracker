#!/usr/bin/env node
// ServiceNow → Supabase migration driver.
//
// READ-ONLY against ServiceNow: it only ever issues GETs through the app's
// own API with the key already in tools/backup.local.json. No SN script,
// table or record is modified, and the instance stays live throughout.
//
//   node tools/migrate-to-supabase.mjs --dry     # pull + report, write nothing
//   node tools/migrate-to-supabase.mjs           # pull + import into Supabase
//   node tools/migrate-to-supabase.mjs --reset   # wipe the couple first, then import
//
// Optional: --bag-csv <file>   char2's bag exported from the app (see
//                              supabase/import-bag-template.csv)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SN_BASE = "https://dev405150.service-now.com/api/x_887486_love_app/love_score";
const SB_FN = "https://yvllstktmjoedfsgojgs.supabase.co/functions/v1";
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const RESET = args.includes("--reset");
const BAG_CSV = args.includes("--bag-csv") ? args[args.indexOf("--bag-csv") + 1] : null;

const secretFile = path.join(ROOT, ".migration-secret");
const MIGRATION_SECRET = fs.existsSync(secretFile)
  ? fs.readFileSync(secretFile, "utf8").trim() : "";

// ── ServiceNow side (identical unwrap quirk handling to tools/backup.js) ──
function unwrap(json) {
  let data = json && json.result !== undefined ? json.result : json;
  if (data !== null && typeof data === "object" && !Array.isArray(data) && data.result !== undefined) {
    data = data.result;
  }
  return data;
}

async function sn(pathname, apiKey) {
  const res = await fetch(SN_BASE + pathname, {
    headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${JSON.stringify(body)}`);
  return unwrap(body);
}

async function sb(payload) {
  const res = await fetch(`${SB_FN}/migrate-import`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      "Content-Type": "application/json",
      "x-migration-secret": MIGRATION_SECRET,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`migrate-import(${payload.op}) → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function parseBagCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || "").trim(); });
    return {
      owner: row.char || "char2",
      itemName: row.item_name,
      itemIcon: row.item_icon,
      ptsSpent: parseInt(row.pts_spent) || 0,
      sourceType: row.source_type || "purchase",
      itemId: row.decor_item_id || "",
      month: row.month,
      acquiredDate: row.acquired_date,
      usedDate: row.used_date || "",
    };
  });
}

function tempPassword() {
  // readable but unguessable — the couple changes these in-app afterwards
  return "LP-" + crypto.randomBytes(6).toString("base64url");
}

async function main() {
  const cfgFile = path.join(ROOT, "tools", "backup.local.json");
  const local = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
  const primary = local.char1?.apiKey ? local.char1 : local.char2;
  if (!primary?.apiKey) throw new Error("no ServiceNow apiKey in tools/backup.local.json");

  console.log("▸ pulling from ServiceNow (read-only)…");
  const config = await sn("/config", primary.apiKey);
  const [categories, rewards, punishments, shop, history, letters, photos, decor] = await Promise.all([
    sn("/categories", primary.apiKey),
    sn("/rewards", primary.apiKey),
    sn("/punishments", primary.apiKey),
    sn("/shop", primary.apiKey),
    sn("/history", primary.apiKey),
    sn("/letters", primary.apiKey),
    sn("/photos", primary.apiKey),
    sn("/bag?type=decor", primary.apiKey),
  ]);

  // Every entry ever logged: ?year= gives settled+unsettled for one year.
  const startYear = /^\d{4}/.test(config.startDate || "")
    ? +config.startDate.slice(0, 4) : new Date().getFullYear();
  const thisYear = new Date().getFullYear();
  const byId = new Map();
  for (let y = startYear; y <= thisYear; y++) {
    for (const e of await sn(`/entries?year=${y}`, primary.apiKey)) byId.set(e.id, e);
  }
  // Whatever /entries still returns is, by definition, the unsettled set —
  // so settled = everything else. That distinction cannot be derived from
  // the month alone, because a month can be settled and then added to again.
  const unsettledIds = new Set();
  for (const e of await sn("/entries", primary.apiKey)) {
    byId.set(e.id, e);
    unsettledIds.add(e.id);
  }
  const entries = [...byId.values()].map((e) => ({ ...e, settled: !unsettledIds.has(e.id) }));

  // char1's own bag; char2's comes from the CSV since /bag is per-caller
  const bagOwn = await sn("/bag", primary.apiKey);
  const bagUsed = await sn("/bag/history", primary.apiKey);
  const myChar = local.char1?.apiKey ? "char1" : "char2";
  const bag = [
    ...bagOwn.map((b) => ({ ...b, owner: b.owner || myChar })),
    ...bagUsed.map((b) => ({ ...b, owner: b.owner || myChar })),
    ...decor.map((b) => ({ ...b, sourceType: "decor" })),
    ...(BAG_CSV ? parseBagCsv(BAG_CSV) : []),
  ];

  const summary = {
    entries: entries.length,
    "  └ settled": entries.filter((e) => e.settled).length,
    "  └ unsettled": entries.filter((e) => !e.settled).length,
    categories: categories.length, rewards: rewards.length,
    punishments: punishments.length, shop: shop.length,
    history: history.length, letters: letters.length,
    photos: photos.length, decor: decor.length,
    "bag rows": bag.length,
  };
  console.log("\n▸ pulled from ServiceNow:");
  for (const [k, v] of Object.entries(summary)) console.log(`    ${k.padEnd(14)} ${v}`);
  console.log(`    couple:        ${config.char1Name} & ${config.char2Name}  (since ${config.startDate})`);
  console.log(`    pet:           ${config.petName || "(none)"} ${config.petSpecies || ""} exp=${config.petExp}`);

  if (DRY) {
    console.log("\n▸ --dry: nothing written to Supabase.");
    fs.writeFileSync(path.join(ROOT, ".migration-preview.json"),
      JSON.stringify({ summary, config, counts: summary }, null, 2));
    return;
  }

  const usernames = [process.env.CHAR1_USERNAME || "CS", process.env.CHAR2_USERNAME || "YY"];

  if (RESET) {
    console.log("\n▸ resetting any previous import…");
    console.log("   ", await sb({ op: "reset", usernames }));
  }

  console.log("\n▸ creating Supabase accounts…");
  const pw1 = tempPassword(), pw2 = tempPassword();
  const acct = await sb({
    op: "accounts",
    char1: { username: usernames[0], password: pw1 },
    char2: { username: usernames[1], password: pw2 },
  });
  const matchId = acct.matchId;
  console.log(`    matchId ${matchId}`);

  console.log("\n▸ importing core data…");
  const core = await sb({
    op: "core", matchId, config, categories, rewards, punishments,
    shop, history, entries, letters, bag,
  });
  console.log("    ", JSON.stringify(core.counts));

  console.log(`\n▸ uploading ${photos.length} photos to Storage…`);
  let ok = 0;
  for (const [i, p] of photos.entries()) {
    try {
      await sb({ op: "photo", matchId, photo: p });
      ok++;
      process.stdout.write(`\r    ${ok}/${photos.length}`);
    } catch (e) {
      console.log(`\n    ⚠️  photo ${i + 1} failed: ${e.message}`);
    }
  }
  console.log(`\n    ${ok}/${photos.length} uploaded`);

  const creds = [
    `Supabase login credentials (TEMPORARY — change in-app after first login)`,
    ``,
    `  ${usernames[0]}   ${pw1}`,
    `  ${usernames[1]}   ${pw2}`,
    ``,
    `matchId: ${matchId}`,
    `imported: ${JSON.stringify(core.counts)}, photos: ${ok}/${photos.length}`,
    `at: ${new Date().toISOString()}`,
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, ".migration-credentials.txt"), creds + "\n");

  console.log("\n" + "=".repeat(56));
  console.log(creds);
  console.log("=".repeat(56));
  console.log("\n(also saved to .migration-credentials.txt — gitignored)");
  console.log("ServiceNow was not modified: every SN call above was a GET.");
}

main().catch((e) => { console.error("\n✖", e.message); process.exit(1); });

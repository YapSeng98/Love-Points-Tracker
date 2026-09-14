#!/usr/bin/env node
// Removes the throwaway couples the test suites leave behind.
//
// The suites deliberately don't hold a service key — they run with the
// publishable key, exactly like the app, so they can't delete auth users.
// This does that cleanup separately. Run it after a test session:
//
//   node supabase/cleanup-test-accounts.mjs          # list what it would remove
//   node supabase/cleanup-test-accounts.mjs --yes    # actually remove it
//
// Real accounts are protected by an explicit allowlist rather than by the
// pattern alone: a pattern that accidentally matched "CS" would delete the
// couple's entire history, so the destructive path refuses to touch anything
// on KEEP no matter what.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_BASE = "https://yvllstktmjoedfsgojgs.supabase.co";

// never delete these, whatever the pattern says
const KEEP = new Set(["CS", "YY"]);
// throwaway prefixes used by the suites
const TEST = /^(t|f|bk|bkflow|pwui|pwtest|CaseTest|e2e_test)[_0-9]/i;

const key = process.env.SUPABASE_SECRET_KEY
  || JSON.parse(fs.readFileSync(path.join(ROOT, "tools/backup.local.json"), "utf8")).serviceKey;
if (!key) { console.error("no service key"); process.exit(1); }

const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = async (p, init = {}) => {
  const r = await fetch(`${URL_BASE}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} → ${r.status}: ${t}`);
  try { return JSON.parse(t); } catch { return t; }
};

const apply = process.argv.includes("--yes");

const profiles = await rest("profiles?select=id,username,char_id,match_id");
const doomed = profiles.filter((p) => !KEEP.has(p.username) && TEST.test(p.username));
const kept = profiles.filter((p) => !doomed.includes(p));

console.log(`${profiles.length} profiles: ${doomed.length} throwaway, ${kept.length} real`);
for (const p of kept) console.log(`  keep    ${p.char_id.padEnd(6)} ${p.username}`);
for (const p of doomed) console.log(`  remove  ${p.char_id.padEnd(6)} ${p.username}`);

if (!doomed.length) { console.log("\nnothing to do."); process.exit(0); }
if (!apply) { console.log("\ndry run — pass --yes to actually remove these."); process.exit(0); }

const matchIds = [...new Set(doomed.map((p) => p.match_id).filter(Boolean))];
// a match is only removable if every profile on it is throwaway
const realMatches = new Set(kept.map((p) => p.match_id));
const removableMatches = matchIds.filter((m) => !realMatches.has(m));

for (const m of removableMatches) {
  const photos = await rest(`photos?match_id=eq.${m}&select=storage_path`);
  const paths = photos.map((p) => p.storage_path).filter(Boolean);
  if (paths.length) {
    await fetch(`${URL_BASE}/storage/v1/object/photos`, {
      method: "DELETE", headers: H, body: JSON.stringify({ prefixes: paths }),
    });
  }
  for (const t of ["entries", "photos", "letters", "bag", "monthly", "categories", "rewards", "punishments", "shop", "config"]) {
    await rest(`${t}?match_id=eq.${m}`, { method: "DELETE" });
  }
}

for (const p of doomed) {
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${p.id}`, { method: "DELETE", headers: H });
  if (!r.ok) console.warn(`  ⚠️  ${p.username}: ${r.status} ${await r.text()}`);
}
for (const m of removableMatches) await rest(`matches?id=eq.${m}`, { method: "DELETE" });

const after = await rest("profiles?select=username");
console.log(`\nremoved ${doomed.length} accounts and ${removableMatches.length} couples.`);
console.log(`remaining: ${after.map((p) => p.username).join(", ") || "(none)"}`);

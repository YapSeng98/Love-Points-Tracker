#!/usr/bin/env node
/**
 * Pulls every table this couple owns off the ServiceNow instance and writes
 * one timestamped JSON snapshot to backups/.
 *
 * WHY THIS EXISTS: dev405150.service-now.com is a free Personal Developer
 * Instance. PDIs hibernate after a few idle days and can be reclaimed
 * outright if left inactive — there is no vendor backup to fall back on.
 * Years of entries, letters and photos live ONLY on that instance until this
 * script runs. Treat weekly runs as load-bearing, not optional.
 *
 * SETUP (once — no password ever touches disk):
 *   node tools/backup.js login char1 <username> <password>
 * That's the SAME app login you already use, nothing new to remember. It
 * calls /auth/login and keeps only the returned apiKey.
 *
 * ONE MORE PASTE, for a complete backup in a single call with NOTHING split
 * between partners: paste servicenow/resources/r41_GET_backup_full.js into
 * ServiceNow Studio (new resource, GET, path /backup/full — same as every
 * other resource in this project). It authenticates with the same apiKey
 * above but — unlike /bag — does not filter by character, so either
 * partner's login alone pulls BOTH partners' bag rows. No second app login,
 * no ServiceNow admin password, ever.
 *
 * Until r41 is pasted, this script still works — it falls back to pulling
 * everything it can with whichever login(s) you've saved, and only the
 * logged-in partner's own bag comes along for the ride.
 *
 * RUN:
 *   node tools/backup.js
 * Writes backups/<timestamp>.json. Also gitignored — it contains private
 * letters and photos.
 *
 * WEEKLY, WITHOUT REMEMBERING: tools/install-backup-schedule.sh installs a
 * macOS launchd job that runs this every 7 days while the Mac is on.
 */
const fs = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'backup.local.json');
const BACKUP_DIR  = path.join(ROOT, 'backups');
const SN_INSTANCE = 'dev405150.service-now.com';
const API_PATH    = '/api/x_887486_love_app/love_score';
const BASE         = `https://${SN_INSTANCE}${API_PATH}`;

// Caps mirrored from the resource scripts (r10/r33/r37) — a backup that
// exactly hits one of these is a sign the server-side setLimit needs raising,
// not that the couple magically stopped generating data. Only relevant to
// the fallback path — /backup/full reads the raw tables and isn't capped.
const CAPS = { history: 24, letters: 500, photos: 100 };

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return { char1: null, char2: null };
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n');
}

async function api(pathname, apiKey) {
  const res = await fetch(BASE + pathname, {
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && (body.error || JSON.stringify(body))) || res.statusText;
    const err = new Error(`${pathname} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return unwrap(body);
}

// Mirrors app.js's own _snUnwrap exactly: some resources (categories,
// punishments, history — confirmed live, not a guess) come back
// double-wrapped as {result:{result:[...]}}, others single. The app already
// carries this workaround; the backup has to match it or those endpoints
// silently land as {result:[...]} objects instead of arrays.
function unwrap(json) {
  let data = json && json.result !== undefined ? json.result : json;
  if (data !== null && typeof data === 'object' && !Array.isArray(data) && data.result !== undefined) {
    data = data.result;
  }
  return data;
}

async function login(username, password) {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const raw = await res.json().catch(() => null);
  const body = unwrap(raw);
  if (!res.ok || !body || !body.success) {
    throw new Error((body && body.error) || `login failed: HTTP ${res.status}`);
  }
  return body; // { apiKey, charId, username, matchId, partnerName }
}

async function runLogin(slot, username, password) {
  if (slot !== 'char1' && slot !== 'char2') {
    console.error(`  slot must be "char1" or "char2", got "${slot}"`);
    process.exit(1);
  }
  console.log(`  logging in as ${username}…`);
  const result = await login(username, password);
  if (result.charId !== slot) {
    console.warn(`  ⚠️  ${username} is actually ${result.charId}, not ${slot} — saving under ${result.charId} instead.`);
  }
  const realSlot = result.charId;
  const cfg = loadConfig();
  cfg[realSlot] = { username, apiKey: result.apiKey };
  saveConfig(cfg);
  console.log(`  ✅ saved ${realSlot} (${username}) to ${path.relative(ROOT, CONFIG_FILE)}`);
  console.log(`     password was never written to disk — only the API key.`);
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = snapshot.meta.generatedAt.replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  const bytes = fs.statSync(file).size;
  console.log(`\n  ✅ wrote ${path.relative(ROOT, file)}  (${(bytes / 1024).toFixed(0)} KB)`);
  return file;
}

/* ── Preferred path: r41 GET /backup/full ──
   One call, either partner's existing apiKey, both partners' bag rows in the
   same response (each tagged with its own u_char). Only falls through to the
   split path below if the resource hasn't been pasted into ServiceNow yet.
   ServiceNow's own quirk to work around: an undefined resource path under
   this Scripted REST API returns 401 "not authenticated", same as a genuinely
   bad key — NOT 404. So a bare 401 is ambiguous on its own. Disambiguate by
   re-checking the same key against /config, a resource guaranteed to exist:
   if THAT also 401s, the key itself is bad and this should be a real error;
   if /config is fine, /backup/full's 401 just means r41 isn't pasted yet. */
async function tryFullBackup(apiKey) {
  try {
    return await api('/backup/full', apiKey);
  } catch (e) {
    if (e.status !== 401) throw e;
    await api('/config', apiKey);   // throws for real if the key is actually bad
    return null;                    // key's fine → /backup/full just doesn't exist yet
  }
}

async function runBackupViaResource(apiKey, username) {
  console.log(`  pulling everything via /backup/full as ${username} — one call, both partners, nothing split…`);
  const data = await tryFullBackup(apiKey);
  if (!data) {
    console.log('  (r41 not pasted into ServiceNow yet — falling back to the split path.)');
    return false;
  }

  const snapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      snInstance: SN_INSTANCE,
      method: 'resource r41 (unified — both partners in one call)',
    },
    ...data,
  };
  writeSnapshot(snapshot);

  console.log('\n  counts:');
  for (const [k, v] of Object.entries(data)) {
    console.log(`    ${k.padEnd(14)} ${Array.isArray(v) ? v.length : '—'}`);
  }
  if (Array.isArray(data.bag)) {
    const byChar = data.bag.reduce((m, r) => ((m[r.u_char] = (m[r.u_char] || 0) + 1), m), {});
    console.log(`    bag breakdown   ${JSON.stringify(byChar)}`);
  }
  return true;
}

// Pull every entry ever logged, settled or not. /entries?year=YYYY covers one
// year at a time (both settled + unsettled); loop from the couple's start
// date through this year and de-dupe by id in case of overlap at the edges.
// Only used by the fallback path — /backup/full has no such cap.
async function allEntries(apiKey, startDateStr) {
  const startYear = /^\d{4}/.test(startDateStr || '') ? +startDateStr.slice(0, 4) : new Date().getFullYear();
  const thisYear  = new Date().getFullYear();
  const byId = new Map();
  for (let y = startYear; y <= thisYear; y++) {
    const rows = await api(`/entries?year=${y}`, apiKey);
    for (const e of rows) byId.set(e.id, e);
  }
  for (const e of await api('/entries', apiKey)) byId.set(e.id, e);
  return [...byId.values()];
}

/* ── Fallback path: per-account apiKeys against the existing resources ──
   Works today with zero ServiceNow changes, but /bag is personal — a
   partner's bag only appears if THAT partner is the one logged in. */
async function runBackupSplit() {
  const cfg = loadConfig();
  if (!cfg.char1 && !cfg.char2) {
    console.error('  No API keys saved yet. Run this once first:');
    console.error('    node tools/backup.js login char1 <username> <password>');
    process.exit(1);
  }
  const primary = cfg.char1 || cfg.char2;
  console.log('  (tip: paste servicenow/resources/r41_GET_backup_full.js into ServiceNow —');
  console.log('   one call then covers both partners\' bags, no second login needed.)');
  if (!cfg.char1 || !cfg.char2) {
    console.warn(`  ⚠️  Only ${primary === cfg.char1 ? 'char1' : 'char2'} is logged in — the other`);
    console.warn(`     partner's bag / bag-history will be missing from this backup.`);
  }

  console.log('  pulling shared data…');
  const config      = await api('/config', primary.apiKey);
  const [categories, rewards, punishments, shop, history, letters, photos, decor] =
    await Promise.all([
      api('/categories', primary.apiKey),
      api('/rewards', primary.apiKey),
      api('/punishments', primary.apiKey),
      api('/shop', primary.apiKey),
      api('/history', primary.apiKey),
      api('/letters', primary.apiKey),
      api('/photos', primary.apiKey),
      api('/bag?type=decor', primary.apiKey),
    ]);

  console.log('  pulling every entry (looping years since ' + (config.startDate || 'this year') + ')…');
  const entries = await allEntries(primary.apiKey, config.startDate);

  console.log('  pulling each partner\'s bag…');
  const bag = {};
  for (const slot of ['char1', 'char2']) {
    if (!cfg[slot]) continue;
    const [active, used] = await Promise.all([
      api('/bag', cfg[slot].apiKey),
      api('/bag/history', cfg[slot].apiKey),
    ]);
    bag[slot] = { username: cfg[slot].username, active, used };
  }

  const snapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      snInstance: SN_INSTANCE,
      method: 'fallback (split per-account — paste r41 to avoid this)',
      partners: Object.fromEntries(
        Object.entries(cfg).filter(([, v]) => v).map(([k, v]) => [k, v.username])
      ),
    },
    config, categories, rewards, punishments, shop, history,
    letters, photos, decor, entries, bag,
  };
  writeSnapshot(snapshot);

  console.log('\n  counts:');
  const counts = {
    categories: categories.length, rewards: rewards.length, punishments: punishments.length,
    shop: shop.length, history: history.length, letters: letters.length,
    photos: photos.length, decor: decor.length, entries: entries.length,
    'bag(char1) active/used': bag.char1 ? `${bag.char1.active.length}/${bag.char1.used.length}` : '—',
    'bag(char2) active/used': bag.char2 ? `${bag.char2.active.length}/${bag.char2.used.length}` : '—',
  };
  for (const [k, v] of Object.entries(counts)) console.log(`    ${k.padEnd(24)} ${v}`);

  for (const [key, cap] of Object.entries(CAPS)) {
    if (snapshot[key] && snapshot[key].length >= cap) {
      console.warn(`\n  ⚠️  ${key} returned ${snapshot[key].length}, which is the server's setLimit(${cap}).`);
      console.warn(`     Older rows may be getting cut off — raise the cap in that resource script.`);
    }
  }
}

async function runBackup() {
  const cfg = loadConfig();
  const primary = cfg.char1 || cfg.char2;
  if (primary && await runBackupViaResource(primary.apiKey, primary.username)) return;
  await runBackupSplit();
}

(async () => {
  const [cmd, slot, username, password] = process.argv.slice(2);
  try {
    if (cmd === 'login') await runLogin(slot, username, password);
    else if (!cmd) await runBackup();
    else { console.error(`  unknown command "${cmd}". Use "login <char1|char2> <user> <pass>" or no args to back up.`); process.exit(1); }
  } catch (e) {
    console.error('  ❌ ' + e.message);
    process.exit(1);
  }
})();

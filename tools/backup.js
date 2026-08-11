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
 * SETUP (once per partner, no password ever touches disk):
 *   node tools/backup.js login char1 <username> <password>
 *   node tools/backup.js login char2 <username> <password>
 * This calls the same /auth/login the app uses, keeps only the returned
 * apiKey (stable until someone resets it — login never rotates it), and
 * writes tools/backup.local.json. That file is gitignored: it is a live
 * credential for a repo that deploys PUBLICLY on every push, so it must
 * never be committed.
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
// not that the couple magically stopped generating data.
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
    throw new Error(`${pathname} → ${res.status}: ${msg}`);
  }
  return unwrap(body);
}

// Mirrors app.js's own _snUnwrap exactly: some resources (categories,
// punishments, history — confirmed live, not a guess) come back
// double-wrapped as {result:{result:[...]}}, others single. The app already
// carries this workaround; the backup has to match it or those three
// endpoints silently land as {result:[...]} objects instead of arrays.
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

// Pull every entry ever logged, settled or not. /entries?year=YYYY covers one
// year at a time (both settled + unsettled); loop from the couple's start
// date through this year and de-dupe by id in case of overlap at the edges.
async function allEntries(apiKey, startDateStr) {
  const startYear = /^\d{4}/.test(startDateStr || '') ? +startDateStr.slice(0, 4) : new Date().getFullYear();
  const thisYear  = new Date().getFullYear();
  const byId = new Map();
  for (let y = startYear; y <= thisYear; y++) {
    const rows = await api(`/entries?year=${y}`, apiKey);
    for (const e of rows) byId.set(e.id, e);
  }
  // Defensive extra pass: the plain (unsettled-only) call, in case an entry's
  // u_month somehow doesn't STARTSWITH its own year.
  for (const e of await api('/entries', apiKey)) byId.set(e.id, e);
  return [...byId.values()];
}

async function runBackup() {
  const cfg = loadConfig();
  if (!cfg.char1 && !cfg.char2) {
    console.error('  No API keys saved yet. Run this once per partner first:');
    console.error('    node tools/backup.js login char1 <username> <password>');
    console.error('    node tools/backup.js login char2 <username> <password>');
    process.exit(1);
  }
  const primary = cfg.char1 || cfg.char2;
  if (!cfg.char1 || !cfg.char2) {
    console.warn(`  ⚠️  Only ${primary === cfg.char1 ? 'char1' : 'char2'} is logged in — the other`);
    console.warn(`     partner's bag / bag-history will be missing from this backup.`);
    console.warn(`     Run "node tools/backup.js login ${cfg.char1 ? 'char2' : 'char1'} <username> <password>" to complete it.`);
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
      partners: Object.fromEntries(
        Object.entries(cfg).filter(([, v]) => v).map(([k, v]) => [k, v.username])
      ),
    },
    config, categories, rewards, punishments, shop, history,
    letters, photos, decor, entries, bag,
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = snapshot.meta.generatedAt.replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));

  const bytes = fs.statSync(file).size;
  console.log(`\n  ✅ wrote ${path.relative(ROOT, file)}  (${(bytes / 1024).toFixed(0)} KB)`);
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
      console.warn(`     Older rows may be getting cut off — raise the cap in the r${key} resource script.`);
    }
  }
}

(async () => {
  const [cmd, a, b, c] = process.argv.slice(2);
  try {
    if (cmd === 'login') await runLogin(a, b, c);
    else if (!cmd) await runBackup();
    else { console.error(`  unknown command "${cmd}". Use "login <char1|char2> <user> <pass>" or no args to back up.`); process.exit(1); }
  } catch (e) {
    console.error('  ❌ ' + e.message);
    process.exit(1);
  }
})();

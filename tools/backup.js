#!/usr/bin/env node
/**
 * Pulls everything this couple owns out of Supabase and writes one
 * timestamped JSON snapshot to backups/.
 *
 * WHY THIS EXISTS: the app's data used to live on a free ServiceNow PDI that
 * could be reclaimed without warning, and this script was the only copy.
 * Supabase is a sturdier home, but a managed database is still not a backup:
 * an accidental delete, a bad migration or a closed account all lose data
 * just as completely. Treat weekly runs as load-bearing, not optional.
 *
 * SETUP (once — no password is ever written to disk):
 *   node tools/backup.js login <username> <password>
 * That's the same app login you already use. It keeps only the refresh
 * token, which is swapped for a short-lived access token on each run.
 *
 * RUN:
 *   node tools/backup.js
 * Writes backups/<timestamp>.json — gitignored, since it holds private
 * letters and photos.
 *
 * ONE CALL, BOTH BAGS: this reads /backup-full, which deliberately does not
 * filter the bag by character. The old ServiceNow /bag returned only the
 * caller's own rows, so a backup silently missed whichever partner wasn't
 * logged in — that gap is why YY's items had to be re-entered by hand during
 * the migration. Either partner's login now backs up both.
 *
 * WEEKLY, WITHOUT REMEMBERING: tools/install-backup-schedule.sh installs a
 * macOS launchd job that runs this every 7 days while the Mac is on.
 */
const fs = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'backup.local.json');
const BACKUP_DIR  = path.join(ROOT, 'backups');

const SB_URL = 'https://yvllstktmjoedfsgojgs.supabase.co';
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n');
  fs.chmodSync(CONFIG_FILE, 0o600);
}

async function fn(pathname, token) {
  const res = await fetch(`${SB_URL}/functions/v1${pathname}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

/* ── auth ───────────────────────────────────────────────────────────────
   Access tokens last about an hour, which is useless to a weekly job, so
   only the refresh token is kept. Supabase rotates it on every use, so the
   replacement is written back immediately — losing it means logging in
   again, which is recoverable but annoying at 3am on a schedule.          */
async function accessTokenFromRefresh(refreshToken) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d || !d.access_token) {
    throw new Error('refresh token rejected — run: node tools/backup.js login <username> <password>');
  }
  return d;
}

async function runLogin(username, password) {
  if (!username || !password) {
    console.error('  usage: node tools/backup.js login <username> <password>');
    process.exit(1);
  }
  console.log(`  logging in as ${username}…`);
  const res = await fetch(`${SB_URL}/functions/v1/auth-login`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.refreshToken) {
    throw new Error((body && body.error) || `login failed: HTTP ${res.status}`);
  }
  saveConfig({ username: body.username, charId: body.charId, refreshToken: body.refreshToken });
  console.log(`  ✅ saved ${body.username} (${body.charId}) to ${path.relative(ROOT, CONFIG_FILE)}`);
  console.log('     the password was not written to disk — only a refresh token.');
}

/* ── backup ─────────────────────────────────────────────────────────── */
async function runBackup() {
  const cfg = loadConfig();
  if (!cfg.refreshToken) {
    console.error('  Not logged in yet. Run this once:');
    console.error('    node tools/backup.js login <username> <password>');
    process.exit(1);
  }

  console.log('  refreshing session…');
  const session = await accessTokenFromRefresh(cfg.refreshToken);
  if (session.refresh_token && session.refresh_token !== cfg.refreshToken) {
    saveConfig({ ...cfg, refreshToken: session.refresh_token });
  }

  console.log('  pulling everything…');
  const snap = await fn('/backup-full', session.access_token);

  // Signed URLs expire, so pull the actual bytes into the snapshot —
  // otherwise the backup degrades into a list of dead links.
  const photos = snap.photos || [];
  if (photos.length) {
    console.log(`  downloading ${photos.length} photos…`);
    let ok = 0;
    for (const p of photos) {
      try {
        const r = await fetch(p.downloadUrl);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        p.imageBase64 = `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
        ok++;
      } catch (e) {
        p.imageBase64 = '';
        console.warn(`    ⚠️  photo ${p.id} failed: ${e.message}`);
      }
      delete p.downloadUrl;   // expires anyway; keep it out of the archive
    }
    console.log(`  ${ok}/${photos.length} photo files embedded`);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = snap.meta.generatedAt.replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);

  const bagByChar = (snap.bag || []).reduce((m, b) => ((m[b.char] = (m[b.char] || 0) + 1), m), {});
  console.log(`\n  ✅ wrote ${path.relative(ROOT, file)}  (${kb} KB)`);
  console.log(`     entries ${(snap.entries || []).length} · letters ${(snap.letters || []).length}` +
              ` · photos ${photos.length} · settled months ${(snap.monthly || []).length}`);
  console.log(`     categories ${(snap.categories || []).length} · rewards ${(snap.rewards || []).length}` +
              ` · punishments ${(snap.punishments || []).length} · shop ${(snap.shop || []).length}`);
  console.log(`     bag rows ${(snap.bag || []).length} — ` +
              Object.entries(bagByChar).map(([c, n]) => `${c}: ${n}`).join(', ') || '(none)');

  // Both partners present is the signal that the old split-bag gap is gone
  const chars = new Set((snap.profiles || []).map((p) => p.char_id));
  if (chars.size < 2) {
    console.warn('     ⚠️  only one partner profile found — expected both.');
  }
  return file;
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'login') await runLogin(rest[0], rest[1]);
    else if (!cmd)       await runBackup();
    else {
      console.error(`  unknown command "${cmd}"`);
      console.error('  usage: node tools/backup.js [login <username> <password>]');
      process.exit(1);
    }
  } catch (e) {
    console.error('\n  ✖', e.message);
    process.exit(1);
  }
})();

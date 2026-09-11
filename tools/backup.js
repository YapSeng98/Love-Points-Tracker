#!/usr/bin/env node
/**
 * Pulls everything out of Supabase and writes one timestamped JSON snapshot
 * to backups/.
 *
 * WHY THIS EXISTS: the app's data used to live on a free ServiceNow PDI that
 * could be reclaimed without warning, and this script was the only copy.
 * Supabase is a sturdier home, but a managed database is still not a backup:
 * an accidental delete, a bad migration or a closed account lose data just as
 * completely. Treat weekly runs as load-bearing, not optional.
 *
 * AUTH: a service key in tools/backup.local.json (gitignored, chmod 600), or
 * SUPABASE_SECRET_KEY in the environment. Deliberately NOT a user login —
 * a scheduled job should not be authenticating as a person:
 *   · it would need someone's password to set up,
 *   · sessions expire, and this runs weekly,
 *   · and Supabase revokes every session when a password changes, so the
 *     backup would silently stop the next time either partner changed theirs.
 * The key also bypasses RLS, which is what lets one run capture BOTH
 * partners' bags — the old ServiceNow /bag returned only the caller's own
 * rows, so backups silently dropped whoever wasn't logged in.
 *
 * RUN:
 *   node tools/backup.js
 * Writes backups/<timestamp>.json — gitignored, since it holds private
 * letters and photos.
 *
 * WEEKLY, WITHOUT REMEMBERING: tools/install-backup-schedule.sh installs a
 * macOS launchd job that runs this every 7 days while the Mac is on.
 */
const fs = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'backup.local.json');
const BACKUP_DIR  = path.join(ROOT, 'backups');
const SB_URL      = 'https://yvllstktmjoedfsgojgs.supabase.co';
const BUCKET      = 'photos';

// Every table the couple's data lives in. Order is irrelevant for a read,
// but this doubles as the checklist of what a complete snapshot contains —
// if a table is ever added to the schema, add it here too.
const TABLES = [
  'matches', 'profiles', 'config', 'categories', 'rewards', 'punishments',
  'shop', 'monthly', 'entries', 'letters', 'photos', 'bag',
];

function serviceKey() {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (cfg.serviceKey) return cfg.serviceKey;
  }
  throw new Error(
    'no service key found.\n' +
    '     Put one in tools/backup.local.json as {"serviceKey":"…"}, or set\n' +
    '     SUPABASE_SECRET_KEY. Get it from the Supabase dashboard under\n' +
    '     Project Settings → API Keys, or: npx supabase projects api-keys'
  );
}

async function table(name, key) {
  // PostgREST caps a response at 1000 rows by default, and this couple is
  // already past 500 entries — page explicitly rather than silently truncate
  // the archive at a round number.
  const PAGE = 1000;
  let from = 0, out = [];
  for (;;) {
    const res = await fetch(`${SB_URL}/rest/v1/${name}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE - 1}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`${name} → ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out = out.concat(rows);
    if (rows.length < PAGE) return out;
    from += PAGE;
  }
}

async function signedUrls(paths, key) {
  if (!paths.length) return {};
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 1800, paths }),
  });
  if (!res.ok) throw new Error(`sign → ${res.status}: ${await res.text()}`);
  const list = await res.json();
  return Object.fromEntries(list.map((s) => [s.path, s.signedURL || s.signedUrl]));
}

async function run() {
  const key = serviceKey();

  console.log('  pulling every table…');
  const data = {};
  for (const t of TABLES) {
    data[t] = await table(t, key);
    process.stdout.write(`\r    ${t}: ${data[t].length}          `);
  }
  console.log('\r' + ' '.repeat(40));

  // Photos live in Storage, so pull the actual bytes into the snapshot.
  // An archive full of signed URLs expires into uselessness.
  if (data.photos.length) {
    console.log(`  downloading ${data.photos.length} photos…`);
    const urls = await signedUrls(data.photos.map((p) => p.storage_path).filter(Boolean), key);
    let ok = 0;
    for (const p of data.photos) {
      try {
        const u = urls[p.storage_path];
        if (!u) throw new Error('no signed url');
        const r = await fetch(u.startsWith('http') ? u : `${SB_URL}/storage/v1${u}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        p.imageBase64 = `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
        ok++;
      } catch (e) {
        p.imageBase64 = '';
        console.warn(`    ⚠️  photo ${p.id} failed: ${e.message}`);
      }
    }
    console.log(`  ${ok}/${data.photos.length} photo files embedded`);
    if (ok < data.photos.length) {
      console.warn('  ⚠️  some photos did not download — this snapshot is incomplete.');
    }
  }

  const snap = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'supabase',
      project: SB_URL,
      tables: TABLES,
    },
    ...data,
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = snap.meta.generatedAt.replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);

  const bagByChar = data.bag.reduce((m, b) => ((m[b.char] = (m[b.char] || 0) + 1), m), {});
  console.log(`\n  ✅ wrote ${path.relative(ROOT, file)}  (${kb} KB)`);
  console.log(`     entries ${data.entries.length} · letters ${data.letters.length}` +
              ` · photos ${data.photos.length} · settled months ${data.monthly.length}`);
  console.log(`     categories ${data.categories.length} · rewards ${data.rewards.length}` +
              ` · punishments ${data.punishments.length} · shop ${data.shop.length}`);
  console.log(`     bag ${data.bag.length} — ` +
              (Object.entries(bagByChar).map(([c, n]) => `${c}: ${n}`).join(', ') || '(none)'));

  // Both partners present is the signal that the old split-bag gap is gone
  if (new Set(data.profiles.map((p) => p.char_id)).size < 2) {
    console.warn('     ⚠️  only one partner profile found — expected both.');
  }
  return file;
}

run().catch((e) => { console.error('\n  ✖', e.message); process.exit(1); });

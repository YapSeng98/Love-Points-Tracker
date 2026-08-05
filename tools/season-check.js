#!/usr/bin/env node
/**
 * Seasonal health check for 恋爱小窝.
 *
 * The app needs no scheduled job to change theme — currentTheme() reads the
 * device clock. But two things DO rot silently over time, and both fail quiet:
 *
 *   1. LUNAR only lists 新年/中秋/端午 for a fixed set of years. Past the last
 *      one, _themeActive() returns false and those festivals simply stop
 *      happening. No error, no log — the room just never turns red again.
 *   2. A festival with only one piece of furniture (中秋 shipped like that)
 *      makes the season feel empty when it finally arrives.
 *
 * This runs on a schedule in GitHub Actions so it is caught months early,
 * with nobody's laptop involved.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const YEAR = new Date().getFullYear();
const LUNAR_HEADROOM = 2;   // years of festivals we insist on having in hand
const MIN_PER_SEASON  = 2;  // pieces before a season feels like an event

// Severity matters: a lunar table that has run out is a real breakage (the
// festival silently never fires). A thin season is only a content backlog —
// worth reporting every run, but not worth failing a build over.
const broken = [], thin = [], notes = [];

// ── 1. lunar coverage ──
const lunarBlock = /const LUNAR = \{([\s\S]*?)\n  \};/.exec(src);
if (!lunarBlock) broken.push('Could not find the LUNAR table in app.js — has it been renamed?');
else {
  for (const line of lunarBlock[1].split('\n')) {
    const m = /^\s*(\w+):\s*\{(.+)\},?\s*$/.exec(line);
    if (!m) continue;
    const years = [...m[2].matchAll(/(\d{4}):/g)].map(x => +x[1]);
    if (!years.length) continue;
    const last = Math.max(...years);
    const left = last - YEAR;
    (left < LUNAR_HEADROOM ? broken : notes).push(
      `${m[1]}: lunar dates run out after ${last} (${left} year${left === 1 ? '' : 's'} left)`);
  }
}

// ── 1b. year-locked keepsakes: how many years are pre-drawn? ──
// Each year gets its own one-off piece so the room becomes a memory box
// ("this lantern is from our first 中秋"). They are drawn AHEAD of time and
// sit dormant until their year, which is what makes the yearly refresh
// automatic with no job and no API. That runway has to be topped up before it
// runs out, exactly like LUNAR.
const KEEPSAKE_RUNWAY = 2;          // years of headroom we insist on
const years = {};
for (const m of src.matchAll(/year:(\d{4})/g)) years[m[1]] = (years[m[1]] || 0) + 1;
const yearList = Object.keys(years).map(Number).sort();
const lastYear = yearList.length ? Math.max(...yearList) : 0;
const runway = lastYear - YEAR;
if (!yearList.length) {
  thin.push('no year-locked keepsakes at all');
} else {
  const detail = yearList.map(y => `${y}:${years[y]}`).join(' ');
  (runway < KEEPSAKE_RUNWAY ? broken : notes).push(
    `keepsakes pre-drawn through ${lastYear} (${runway} year${runway === 1 ? '' : 's'} of runway) — ${detail}`);
}

// ── 2. every festival has enough furniture ──
const counts = {};
for (const m of src.matchAll(/season:'([^']+)'/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
if (!Object.keys(counts).length) broken.push('No seasonal furniture found at all.');
for (const [season, n] of Object.entries(counts)) {
  (n < MIN_PER_SEASON ? thin : notes).push(`${season}: ${n} piece${n === 1 ? '' : 's'}`);
}

const out = [];
out.push(`### 恋爱小窝 季节检查 — ${new Date().toISOString().slice(0, 10)}`, '');
if (broken.length) {
  out.push('**🚨 会坏掉 / Will break:**', ...broken.map(p => `- ${p}`), '');
}
if (thin.length) {
  out.push('**🎨 内容偏少 / Could use more furniture:**',
           ...thin.map(p => `- ${p}`),
           '', '_这些节日只有一件家具，到了当天房间会显得空。_', '');
}
out.push('<details><summary>全部状态</summary>', '', ...notes.map(n => `- ✅ ${n}`), '</details>');
const report = out.join('\n');

console.log(report.replace(/<\/?details>|<\/?summary>/g, ''));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

if (thin.length) {
  console.log(`\n${thin.length} season(s) could use more furniture — ask Claude to design some.`);
}
if (broken.length) {
  console.error(`\n${broken.length} thing(s) WILL BREAK — extend the lunar table and/or pre-draw more keepsake years.`);
  process.exit(1);
}
console.log('\nNothing is going to break.');

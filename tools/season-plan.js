#!/usr/bin/env node
/**
 * Works out whether a season needs attention soon, and emits a plan as JSON.
 *
 * Deliberately dumb about *design* — it only answers "which festival is coming,
 * how many pieces does it have, and what does the existing art look like".
 * Judgement about what to draw lives with whoever (or whatever) reads this.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const LEAD_DAYS = Number(process.env.LEAD_DAYS || 45);
const MIN_PER_SEASON = 2;
const TARGET = 3;

// ── parse the seasonal stock windows out of DECOR ──
const items = [];
const decor = /const DECOR = \{([\s\S]*?)\n  \};/.exec(src);
if (decor) {
  const re = /(\w+):\s*\{([^}]*?)\}/g;
  let m;
  while ((m = re.exec(decor[1]))) {
    const body = m[2];
    const g = (k) => (new RegExp(k + ":\\s*'([^']*)'").exec(body) || [, ''])[1];
    const season = g('season');
    if (!season) continue;
    items.push({ id: m[1], name: g('name'), season,
                 from: g('from'), to: g('to'), slot: g('slot'),
                 year: +((/year:\s*(\d{4})/.exec(body) || [, 0])[1]),
                 price: +((/price:\s*(\d+)/.exec(body) || [, 0])[1]) });
  }
}

// ── when does each season's shop window next open? ──
// Per PIECE, then grouped: a season's window is the union of its pieces'
// (圣诞's fireplace opens 12-05, its tree 12-10 — taking the first piece's
// dates reported 12-10). A year-locked keepsake only counts toward the
// occurrence in its own year, or 中秋 2026 looked like 7 pieces when 5 were
// on sale. A season that is open today says so instead of "338 days".
const now = new Date();
const DAY = 86400000;
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
function windowOf(it) {           // the window containing today, else the next one
  const [fm, fd] = it.from.split('-').map(Number), [tm, td] = it.to.split('-').map(Number);
  for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 3; y++) {
    const start = new Date(y, fm - 1, fd);
    let end = new Date(y, tm - 1, td);
    if (end < start) end = new Date(y + 1, tm - 1, td);        // wraps the new year
    if (end >= today && (!it.year || it.year === y)) return { start, end };
  }
  return null;                    // a keepsake whose year has passed
}
const md = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const seasons = {};
for (const it of items) {
  const w = it.from && it.to ? windowOf(it) : null;
  if (w) (seasons[it.season] ||= { season: it.season, pieces: [] }).pieces.push({ ...it, ...w });
}
const plan = Object.values(seasons).map(s => {
  const first = Math.min(...s.pieces.map(p => p.start));
  // pieces of THIS occurrence: opening within ~2 months of the earliest one
  const cur = s.pieces.filter(p => p.start - first < 60 * DAY);
  const start = new Date(first), end = new Date(Math.max(...cur.map(p => p.end)));
  const open = start <= today;
  return {
    season: s.season,
    have: cur.length,
    open,
    opensIn: open ? 0 : Math.round((start - today) / DAY),
    leftDays: Math.round((end - today) / DAY) + 1,
    window: `${md(start)} → ${md(end)}`,
    slots: [...new Set(cur.map(i => i.slot))],
    priceRange: [Math.min(...cur.map(i => i.price)), Math.max(...cur.map(i => i.price))],
    existing: cur.map(i => i.name),
  };
}).sort((a, b) => a.opensIn - b.opensIn);

const when = (p) => p.open ? `在售中，还剩 ${String(p.leftDays).padStart(3)} 天` : `${String(p.opensIn).padStart(4)} 天后上架    `;
const due = plan.filter(p => p.opensIn <= LEAD_DAYS && p.have < MIN_PER_SEASON);

const out = {
  checkedAt: now.toISOString().slice(0, 10),
  leadDays: LEAD_DAYS,
  needsWork: due.length > 0,
  due: due.map(p => ({ ...p, want: TARGET - p.have })),
  all: plan,
};

if (process.argv.includes('--issue')) {
  // Emitted to a file and passed to `gh issue create --body-file`. Building
  // this in YAML with a heredoc put the body at column 1, which breaks out of
  // the block scalar and makes the whole workflow unparseable.
  const j = out.due[0];
  if (!j) { console.log('都够用。'); process.exit(0); }
  console.log(
`**${j.season}** 的商店窗口${j.open ? '已经开了' : ` ${j.opensIn} 天后就开`}（${j.window}），现在只有 ${j.have} 件限定家具 —
到时候房间会显得空。

\`\`\`
${plan.map(x => `${x.season.padEnd(4)} ${String(x.have).padStart(2)} 件  ${when(x)}  ${x.window}`).join('\n')}
\`\`\`

---

**要做的事：** 跟 Claude 说一句就行，例如

> 帮我设计 ${j.season} 的限定家具，${j.want} 件，跟现有画风一致

它会画好、渲染图鉴给你看、跑完测试再提交。看图觉得不好看就让它重画。

_由 [季节检查](../../actions/workflows/season-check.yml) 自动开的，每月 1 号和 15 号跑一次。_`);
  process.exit(0);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`季节家具计划 — ${out.checkedAt} (未来 ${LEAD_DAYS} 天)\n`);
  for (const p of plan) {
    const flag = due.includes(p) ? '  ⚠️ 需要补货' : '';
    console.log(`  ${p.season.padEnd(4)} ${String(p.have).padStart(2)} 件  ${when(p)}  ${p.window}${flag}`);
  }
  console.log(due.length ? `\n${due.length} 个季节需要新家具。` : '\n都够用。');
}
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `needs_work=${out.needsWork}\n` +
    `season=${due[0] ? due[0].season : ''}\n`.replace('［','['));
}
module.exports = out;

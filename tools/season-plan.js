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
                 price: +((/price:\s*(\d+)/.exec(body) || [, 0])[1]) });
  }
}

// ── when does each season's shop window next open? ──
const now = new Date();
const seasons = {};
for (const it of items) {
  const s = (seasons[it.season] ||= { season: it.season, items: [], from: it.from, to: it.to });
  s.items.push(it);
}
const daysUntil = (md) => {
  if (!md) return null;
  const [m, d] = md.split('-').map(Number);
  let when = new Date(now.getFullYear(), m - 1, d);
  if (when < now) when = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.ceil((when - now) / 86400000);
};

const plan = Object.values(seasons).map(s => ({
  season: s.season,
  have: s.items.length,
  opensIn: daysUntil(s.from),
  window: `${s.from} → ${s.to}`,
  slots: [...new Set(s.items.map(i => i.slot))],
  priceRange: [Math.min(...s.items.map(i => i.price)), Math.max(...s.items.map(i => i.price))],
  existing: s.items.map(i => i.name),
})).sort((a, b) => a.opensIn - b.opensIn);

const due = plan.filter(p => p.opensIn <= LEAD_DAYS && p.have < MIN_PER_SEASON);

const out = {
  checkedAt: now.toISOString().slice(0, 10),
  leadDays: LEAD_DAYS,
  needsWork: due.length > 0,
  due: due.map(p => ({ ...p, want: TARGET - p.have })),
  all: plan,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`季节家具计划 — ${out.checkedAt} (未来 ${LEAD_DAYS} 天)\n`);
  for (const p of plan) {
    const flag = due.includes(p) ? '  ⚠️ 需要补货' : '';
    console.log(`  ${p.season.padEnd(4)} ${String(p.have).padStart(2)} 件  ${String(p.opensIn).padStart(4)} 天后上架  ${p.window}${flag}`);
  }
  console.log(due.length ? `\n${due.length} 个季节需要新家具。` : '\n都够用。');
}
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `needs_work=${out.needsWork}\n` +
    `season=${due[0] ? due[0].season : ''}\n`.replace('［','['));
}
module.exports = out;

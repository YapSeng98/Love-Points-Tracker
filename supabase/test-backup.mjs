#!/usr/bin/env node
// Tests /backup-full and the backup script's refresh-token flow against a
// throwaway couple. The thing that matters most here is the bag: the old
// ServiceNow endpoint only ever returned the caller's own rows, so a backup
// silently dropped the other partner's items. This proves that is fixed.
//
//   node supabase/test-backup.mjs

const BASE = "https://yvllstktmjoedfsgojgs.supabase.co";
const FN = `${BASE}/functions/v1`;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = "") => {
  if (c) { pass++; console.log(`  ok   ${n}`); }
  else { fail++; failures.push(n); console.log(`  FAIL ${n}${d ? ` — ${d}` : ""}`); }
};

const call = async (p, { method = "GET", token, body } = {}) => {
  const h = { apikey: KEY, "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(FN + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const stamp = Date.now();
const u = (n) => `bk${stamp}_${n}`;

async function run() {
  console.log("=== setup: couple with data in BOTH bags ===");
  const r1 = await call("/auth-register", { method: "POST", body: { username: u("a1"), password: "Pass123!", charId: "char1" } });
  const A1 = r1.data.accessToken, R1 = r1.data.refreshToken;
  const r2 = await call("/auth-register", { method: "POST", body: { username: u("a2"), password: "Pass123!", charId: "char2", pairCode: r1.data.pairCode } });
  const A2 = r2.data.accessToken;
  check("couple paired", r1.data.matchId === r2.data.matchId);

  // a real couple always has settings saved, and the pet lives on this row
  await call("/config", { method: "PUT", token: A1, body: { mode: "reward", rewardTarget: 300, charName1: "甲", charName2: "乙", petName: "测试宠", petSpecies: "dog", petBase: 5, petExp: 0 } });

  // give both partners points, then a shop item each so both bags fill
  for (const [tok, ch] of [[A1, "char1"], [A2, "char2"]]) {
    await call("/entries", { method: "POST", token: tok, body: { charId: ch, catName: "测试", icon: "💑", pts: 80, desc: ch + " 加分", month: "2026-09", date: "2026-09-11" } });
  }
  const shop = await call("/shop", { method: "POST", token: A1, body: { icon: "🍿", name: "电影票", ptsCost: 20 } });
  await call(`/shop-buy?id=${shop.data.id}`, { method: "POST", token: A1, body: { date: "2026-09-11", month: "2026-09" } });
  await call(`/shop-buy?id=${shop.data.id}`, { method: "POST", token: A2, body: { date: "2026-09-11", month: "2026-09" } });
  await call("/decor-buy", { method: "POST", token: A2, body: { itemId: "moon_rabbit_26", itemName: "月兔", itemIcon: "🐰", price: 40, date: "2026-09-11", month: "2026-09" } });
  await call("/letters", { method: "POST", token: A1, body: { charId: "char1", text: "备份测试情书", date: "2026-09-11T10:00:00.000Z" } });
  await call("/photos", { method: "POST", token: A1, body: { charId: "char1", image: PNG, caption: "备份测试", date: "2026-09-01" } });

  console.log("\n=== /backup-full ===");
  const noAuth = await call("/backup-full");
  check("without a session → 401", noAuth.status === 401, `got ${noAuth.status}`);

  const b = (await call("/backup-full", { token: A1 })).data;
  check("returns a snapshot", !!b && !!b.meta);
  check("entries present", (b.entries || []).length === 4, `got ${(b.entries || []).length}`);
  check("letters present", (b.letters || []).length === 1);
  check("photos present", (b.photos || []).length === 1);
  check("shop present", (b.shop || []).length === 1);
  check("config present", !!b.config);
  check("config carries the pet, which lives on that row", b.config && b.config.pet_name === "测试宠" && b.config.pet_species === "dog");
  check("config carries the couple's targets", b.config && b.config.reward_target === 300);
  check("both profiles present", new Set((b.profiles || []).map((p) => p.char_id)).size === 2);

  // the whole point of this endpoint
  const byChar = (b.bag || []).reduce((m, x) => ((m[x.char] = (m[x.char] || 0) + 1), m), {});
  check("char1's bag rows included", (byChar.char1 || 0) >= 1, JSON.stringify(byChar));
  check("char2's bag rows included — the old split-bag gap", (byChar.char2 || 0) >= 2, JSON.stringify(byChar));
  check("furniture carries its catalog id", (b.bag || []).some((x) => x.decor_item_id === "moon_rabbit_26"));

  check("photo has a downloadable url", !!(b.photos[0] || {}).downloadUrl);
  const img = await fetch(b.photos[0].downloadUrl);
  const bytes = new Uint8Array(await img.arrayBuffer());
  check("that url really serves the image", img.ok && bytes.length > 0 && bytes[0] === 0x89, `HTTP ${img.status}`);

  console.log("\n=== the partner's login backs up the same thing ===");
  const b2 = (await call("/backup-full", { token: A2 })).data;
  check("either partner sees both bags", (b2.bag || []).length === (b.bag || []).length);
  check("either partner sees all entries", (b2.entries || []).length === (b.entries || []).length);

  console.log("\n=== refresh-token flow (what the weekly job uses) ===");
  const rt = await fetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: R1 }),
  });
  const rtd = await rt.json();
  check("refresh token yields a fresh access token", rt.ok && !!rtd.access_token, `HTTP ${rt.status}`);
  const viaRefresh = await call("/backup-full", { token: rtd.access_token });
  check("that token can pull a backup", viaRefresh.status === 200);

  console.log("\n=== isolation ===");
  const rB = await call("/auth-register", { method: "POST", body: { username: u("b1"), password: "Pass123!", charId: "char1" } });
  const other = (await call("/backup-full", { token: rB.data.accessToken })).data;
  check("another couple's backup is empty of our data", (other.entries || []).length === 0 && (other.bag || []).length === 0);

  console.log(`\n${"=".repeat(46)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log(`  failing:\n   - ${failures.join("\n   - ")}`);
  console.log(`${"=".repeat(46)}`);
  console.log(`\nthrowaway accounts: ${u("a1")}, ${u("a2")}, ${u("b1")}`);
  process.exit(fail ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(1); });

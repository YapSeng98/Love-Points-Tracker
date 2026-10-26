#!/usr/bin/env node
// 生日惊喜 (surprise) — live checks against the real backend (CLAUDE.md §7.30).
//
// The feature is a secret kept until a moment, so most of this ATTACKS it:
// the birthday person asking early (with the phone's date moved forward),
// asking whether anything was prepared at all, writing for a day that is not
// a birthday, a third couple reading it, a session token going round the
// function to Postgres, rewriting after delivery, and opening it twice to get
// two coupons.
//
// A delivered surprise can't be created through the API (you can't write for a
// moment that has already passed), so those rows are seeded with the service
// key from tools/backup.local.json, the same way test-anniv.mjs does.
// Registers throwaway couples (prefix `t…`); remove them afterwards with
//   node supabase/cleanup-test-accounts.mjs --yes
//
//   node supabase/test-surprise.mjs

import fs from "node:fs";

const BASE = "https://yvllstktmjoedfsgojgs.supabase.co";
const FN = `${BASE}/functions/v1`;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";
const SERVICE = process.env.SUPABASE_SECRET_KEY
  || JSON.parse(fs.readFileSync(new URL("../tools/backup.local.json", import.meta.url))).serviceKey;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const section = (t) => console.log(`\n=== ${t} ===`);
async function call(path, { method = "GET", token, body } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const service = (path, init = {}) => fetch(`${BASE}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
});

const stamp = Date.now();
const u = (n) => `t${stamp}_bd_${n}`;
// Dates as a Singapore phone sees them (tz +480 is what the app sends there)
const sg = (days) => new Date(Date.now() + 8 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
const TODAY = sg(0), TOMORROW = sg(1), FUTURE = sg(20), FUTURE2 = sg(25);
const md = (d) => d.slice(5);
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function register(name, charId, pairCode) {
  const r = await call("/auth-register", { method: "POST", body: { username: u(name), password: "Pass123!", charId, pairCode } });
  return r.data;
}

async function run() {
  section("setup: two couples");
  const a1 = await register("a1", "char1");
  const a2 = await register("a2", "char2", a1.pairCode);
  const b1 = await register("b1", "char1");
  const A1 = a1.accessToken, A2 = a2.accessToken, B1 = b1.accessToken;
  check("couple A paired", a1.matchId && a1.matchId === a2.matchId);
  await call("/config", { method: "PUT", token: A1, body: { mode: "reward", charName1: "A1", charName2: "A2" } });
  await call("/config", { method: "PUT", token: B1, body: { mode: "reward" } });
  const photoA = (await call("/photos", { method: "POST", token: A1, body: { image: PIXEL, caption: "", date: TODAY } })).data.id;
  const photoA2 = (await call("/photos", { method: "POST", token: A2, body: { image: PIXEL, caption: "", date: TODAY } })).data.id;
  const photoB = (await call("/photos", { method: "POST", token: B1, body: { image: PIXEL, caption: "", date: TODAY } })).data.id;
  check("photos to choose from", !!(photoA && photoA2 && photoB));

  section("config: birthdays");
  let r = await call("/config", { method: "PUT", token: A1, body: { birthday2: "2001-02-30" } });
  check("a day that doesn't exist (2/30) → 400", r.status === 400, JSON.stringify(r.data));
  r = await call("/config", { method: "PUT", token: A1, body: { birthday2: "13-01" } });
  check("month 13 → 400", r.status === 400);
  r = await call("/config", { method: "PUT", token: A1, body: { birthday1: "1998-07-20", birthday2: md(FUTURE) } });
  check("either partner can set both birthdays", r.status === 200);
  const cfg2 = (await call("/config", { token: A2 })).data;
  check("both phones read the same birthdays", cfg2.birthday1 === "1998-07-20" && cfg2.birthday2 === md(FUTURE), JSON.stringify([cfg2.birthday1, cfg2.birthday2]));
  r = await call("/config", { method: "PUT", token: A1, body: { birthday1: "02-29" } });
  check("a bare 02-29 is a real birthday", r.status === 200);

  section("preparing (A1 for A2's birthday)");
  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE, tz: 480, letter: "生日快乐", couponTitle: "带你去看一次海", couponNote: "有效期：一辈子",
    couponIcon: "🌊", photoIds: [photoA, photoB, "not-a-uuid"], teaser: false } });
  check("PUT for the partner's birthday → 200", r.status === 200, JSON.stringify(r.data));
  check("another couple's photo and junk ids are dropped", JSON.stringify(r.data.photoIds) === JSON.stringify([photoA]), JSON.stringify(r.data.photoIds));
  r = await call(`/surprise?openOn=${FUTURE}&tz=480`, { token: A1 });
  check("the preparer reads their own draft back", r.data.mine && r.data.mine.letter === "生日快乐" && r.data.mine.couponTitle === "带你去看一次海" && r.data.mine.photos?.length === 1);
  check("…with a signed photo URL", /^https:\/\//.test(r.data.mine?.photos?.[0]?.image || ""));
  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE, tz: 480, letter: "长".repeat(900), couponTitle: "题".repeat(40) } });
  const long = (await call(`/surprise?openOn=${FUTURE}&tz=480`, { token: A1 })).data.mine;
  check("letter clipped to 800, coupon title to 30", [...long.letter].length === 800 && [...long.couponTitle].length === 30);
  await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE, tz: 480, letter: "生日快乐", couponTitle: "带你去看一次海", couponIcon: "🌊", photoIds: [photoA] } });

  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE2, tz: 480, letter: "x" } });
  check("PUT for a day that is not their birthday → 400", r.status === 400);
  r = await call("/surprise", { method: "PUT", token: A2, body: { openOn: FUTURE, tz: 480, letter: "我自己写给自己" } });
  check("the birthday person can't write for their own birthday → 400", r.status === 400);

  section("the birthday person asking early");
  const early = (await call(`/surprise?openOn=${FUTURE}&tz=480`, { token: A2 })).data;
  const nothing = (await call(`/surprise?openOn=${FUTURE2}&tz=480`, { token: A2 })).data;
  check("before it opens: theirs is null", early.theirs === null);
  check("…and the answer is identical to 'nothing prepared'", JSON.stringify({ ...early, openOn: 0 }) === JSON.stringify({ ...nothing, openOn: 0 }),
    JSON.stringify([early, nothing]));
  check("a phone date moved to the birthday doesn't make it the day (day: false)", early.day === false);
  r = await call(`/surprise?openOn=${FUTURE}&tz=840`, { token: A2 });
  check("claiming to be in UTC+14 doesn't open someone else's sealed surprise", r.data.theirs === null && r.data.day === false);
  check("the list of received surprises is empty", JSON.stringify((await call("/surprise?list=1", { token: A2 })).data) === "[]");

  section("other people");
  r = await call(`/surprise?openOn=${FUTURE}&tz=480`, { token: B1 });
  check("a third couple sees nothing", r.data.mine === null && r.data.theirs === null);
  r = await call("/surprise", { method: "POST", token: B1, body: { openOn: FUTURE } });
  check("a third couple can't open it", r.data.opened === false);
  r = await call(`/surprise?openOn=${FUTURE}`);
  check("no session → 401", r.status === 401);
  const direct = await fetch(`${BASE}/rest/v1/surprises?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${A2}` } });
  const directRows = await direct.json().catch(() => null);
  check("a logged-in session reading the table directly gets nothing", Array.isArray(directRows) ? directRows.length === 0 : direct.status >= 400, `${direct.status} ${JSON.stringify(directRows).slice(0, 80)}`);
  await fetch(`${BASE}/rest/v1/surprises?match_id=eq.${a1.matchId}`, { method: "PATCH", headers: { apikey: KEY, Authorization: `Bearer ${A2}`, "Content-Type": "application/json" },
    body: JSON.stringify({ open_on: TODAY }) });
  const after = await (await service(`surprises?match_id=eq.${a1.matchId}&select=open_on`)).json();
  check("…and a direct PATCH changes nothing", after.length === 1 && after[0].open_on === FUTURE, JSON.stringify(after));

  section("their birthday was edited after sealing");
  await call("/config", { method: "PUT", token: A2, body: { birthday2: md(FUTURE2) } });
  r = await call(`/surprise?openOn=${FUTURE2}&tz=480`, { token: A1 });
  check("the preparer is told (moved = the old date)", r.data.moved === FUTURE, JSON.stringify(r.data.moved));
  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE2, tz: 480, letter: "生日快乐", moveFrom: FUTURE } });
  const rows = await (await service(`surprises?match_id=eq.${a1.matchId}&select=open_on`)).json();
  check("moving it leaves one surprise, on the new date", rows.length === 1 && rows[0].open_on === FUTURE2, JSON.stringify(rows));

  section("the day itself (a delivered surprise, seeded)");
  await call("/config", { method: "PUT", token: A1, body: { birthday2: md(TODAY) } });
  const seeded = await service("surprises", { method: "POST", body: JSON.stringify({
    match_id: a1.matchId, from_char: "char1", open_on: TODAY, tz_min: 480, letter: "今天快乐", coupon_title: "请你吃那家火锅", coupon_note: "想吃几次都行",
    coupon_icon: "🍲", photo_ids: [photoA, photoA2], teaser: false }) });
  check("seeded a surprise that opened at 00:00 today (+8)", seeded.status === 201, String(seeded.status));
  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: TODAY, tz: 480, letter: "改一改" } });
  check("rewriting it after it has opened → 409", r.status === 409, JSON.stringify(r.data));
  const day = (await call(`/surprise?openOn=${TODAY}&tz=480`, { token: A2 })).data;
  check("the birthday person: day is true", day.day === true);
  check("…and gets the letter, the coupon and both photos", day.theirs?.letter === "今天快乐" && day.theirs.couponTitle === "请你吃那家火锅" && day.theirs.photos.length === 2);
  check("the preparer's day flag stays false (not their birthday)", (await call(`/surprise?openOn=${TODAY}&tz=480`, { token: A1 })).data.day === false);
  check("no receipt before it is opened", (await call(`/surprise?openOn=${TODAY}&tz=480`, { token: A1 })).data.mine.openedAt === null);

  r = await call("/surprise", { method: "POST", token: A1, body: { openOn: TODAY } });
  check("the preparer can't open their own surprise", r.data.opened === false);
  const [o1, o2, o3] = await Promise.all([1, 2, 3].map(() => call("/surprise", { method: "POST", token: A2, body: { openOn: TODAY, date: TODAY, month: TODAY.slice(0, 7) } })));
  const coupons = [o1, o2, o3].filter(x => x.data.coupon).length;
  check("opened three times at once → exactly one coupon", coupons === 1, JSON.stringify([o1.data, o2.data, o3.data]));
  const bag = (await call("/bag", { token: A2 })).data;
  const gifts = (bag || []).filter(b => b.sourceType === "gift");
  check("one 生日券 in the birthday person's 背包", gifts.length === 1 && gifts[0].itemName === "请你吃那家火锅" && gifts[0].itemIcon === "🍲" && gifts[0].ptsSpent === 0, JSON.stringify(gifts));
  check("nothing in the preparer's 背包", !((await call("/bag", { token: A1 })).data || []).some(b => b.sourceType === "gift"));
  const receipt = (await call(`/surprise?openOn=${TODAY}&tz=480`, { token: A1 })).data.mine.openedAt;
  check("the preparer gets the receipt (openedAt)", !!receipt);
  r = await call(`/bag-use?id=${gifts[0]?.id}`, { method: "POST", token: A2, body: { date: TODAY } });
  check("the coupon is used like any other reward", r.status === 200, JSON.stringify(r.data));
  const list = (await call("/surprise?list=1", { token: A2 })).data;
  check("it is listed for replay in 我们的时光", Array.isArray(list) && list.some(x => x.openOn === TODAY && x.opened), JSON.stringify(list));
  check("the preparer received nothing", JSON.stringify((await call("/surprise?list=1", { token: A1 })).data) === "[]");

  section("the teaser (the day before)");
  await service("surprises", { method: "POST", body: JSON.stringify({ match_id: a1.matchId, from_char: "char2", open_on: TOMORROW, tz_min: 480, letter: "明天见", teaser: true }) });
  r = await call(`/surprise?openOn=${TOMORROW}&tz=480`, { token: A1 });
  check("teaser on: the box shows the day before, its contents don't", r.data.teaser === true && r.data.theirs === null);
  await service(`surprises?match_id=eq.${a1.matchId}&open_on=eq.${TOMORROW}`, { method: "PATCH", body: JSON.stringify({ teaser: false }) });
  r = await call(`/surprise?openOn=${TOMORROW}&tz=480`, { token: A1 });
  check("teaser off: nothing at all", r.data.teaser === false && r.data.theirs === null);

  section("emptying a draft deletes it");
  await call("/config", { method: "PUT", token: A1, body: { birthday2: md(FUTURE2) } });
  r = await call("/surprise", { method: "PUT", token: A1, body: { openOn: FUTURE2, tz: 480, letter: "", couponTitle: "", photoIds: [] } });
  const left = await (await service(`surprises?match_id=eq.${a1.matchId}&open_on=eq.${FUTURE2}&select=id`)).json();
  check("all empty → the row is gone", r.data.deleted === true && left.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("FAILED:", failures.join(" | ")); process.exit(1); }
}
run().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// End-to-end test suite for the Supabase backend.
//
// Registers throwaway couples each run and deletes them at the end, so it is
// safe to re-run any time. Mirrors servicenow/test-full-system-v2.sh in
// spirit: assert behaviour through the real HTTP API, never the storage
// encoding (CLAUDE.md §9.1).
//
//   node supabase/test-api.mjs

const BASE = "https://yvllstktmjoedfsgojgs.supabase.co";
const FN = `${BASE}/functions/v1`;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

function section(title) { console.log(`\n=== ${title} ===`); }

async function call(path, { method = "GET", token, body } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${FN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const stamp = Date.now();
const u = (n) => `t${stamp}_${n}`;

const created = [];   // usernames to clean up
let matchIds = [];

async function run() {
  // ---------------------------------------------------------------- auth
  section("auth: register + pair");

  const r1 = await call("/auth-register", {
    method: "POST",
    body: { username: u("a1"), password: "Pass123!", charId: "char1" },
  });
  check("register char1 → 201", r1.status === 201, `got ${r1.status}`);
  check("register char1 returns a session", !!r1.data.accessToken);
  check("register char1 returns a 6-digit pair code", /^\d{6}$/.test(r1.data.pairCode || ""));
  created.push(u("a1"));
  matchIds.push(r1.data.matchId);
  const A1 = r1.data.accessToken;

  const r2 = await call("/auth-register", {
    method: "POST",
    body: { username: u("a2"), password: "Pass123!", charId: "char2", pairCode: r1.data.pairCode },
  });
  check("register char2 with pair code → 201", r2.status === 201, `got ${r2.status}`);
  check("char2 joins the SAME match", r2.data.matchId === r1.data.matchId);
  check("char2 sees partner name", r2.data.partnerName === u("a1"));
  created.push(u("a2"));
  const A2 = r2.data.accessToken;

  const dup = await call("/auth-register", {
    method: "POST",
    body: { username: u("a1"), password: "x", charId: "char1" },
  });
  check("duplicate username → 409", dup.status === 409, `got ${dup.status}`);

  const badCode = await call("/auth-register", {
    method: "POST",
    body: { username: u("bad"), password: "x", charId: "char2", pairCode: "000000" },
  });
  check("unknown pair code → 404", badCode.status === 404, `got ${badCode.status}`);

  const takenSlot = await call("/auth-register", {
    method: "POST",
    body: { username: u("a3"), password: "x", charId: "char2", pairCode: r1.data.pairCode },
  });
  check("char2 slot already taken → 409", takenSlot.status === 409, `got ${takenSlot.status}`);

  section("auth: login");
  const li = await call("/auth-login", { method: "POST", body: { username: u("a1"), password: "Pass123!" } });
  check("login correct password → 200", li.status === 200, `got ${li.status}`);
  check("login returns matching charId", li.data.charId === "char1");
  check("login returns partner name", li.data.partnerName === u("a2"));

  const liBad = await call("/auth-login", { method: "POST", body: { username: u("a1"), password: "WRONG" } });
  check("login wrong password → 401", liBad.status === 401, `got ${liBad.status}`);

  const liMissing = await call("/auth-login", { method: "POST", body: { username: "nope_nobody", password: "x" } });
  check("login unknown user → 404", liMissing.status === 404, `got ${liMissing.status}`);

  // -------------------------------------------------------------- config
  section("config");
  const noAuth = await call("/config");
  check("GET /config without session → 401", noAuth.status === 401, `got ${noAuth.status}`);

  const c0 = await call("/config", { token: A1 });
  check("GET /config before setup → configured:false", c0.data.configured === false);
  check("falls back to login usernames", c0.data.char1Name === u("a1") && c0.data.char2Name === u("a2"));

  await call("/config", {
    method: "PUT", token: A1,
    body: { mode: "reward", rewardTarget: 150, charName1: "小明", charName2: "小红", petSpecies: "cat", petBase: 10, petExp: 0 },
  });
  const c1 = await call("/config", { token: A1 });
  check("PUT then GET persists values", c1.data.configured === true && c1.data.rewardTarget === 150);
  check("custom display names override usernames", c1.data.char1Name === "小明");
  check("punishThreshold defaults to -80", c1.data.punishThreshold === -80);

  const c2 = await call("/config", { token: A2 });
  check("partner sees the SAME shared config", c2.data.rewardTarget === 150 && c2.data.char1Name === "小明");

  await call("/config", { method: "PUT", token: A2, body: { petExp: 50 } });
  const c3 = await call("/config", { token: A1 });
  check("pet EXP can rise (0 → 50)", c3.data.petExp === 50, `got ${c3.data.petExp}`);

  await call("/config", { method: "PUT", token: A1, body: { petExp: 5 } });
  const c4 = await call("/config", { token: A1 });
  check("pet EXP cannot fall (50 → 5 refused)", c4.data.petExp === 50, `got ${c4.data.petExp}`);

  await call("/config", { method: "PUT", token: A1, body: { petExp: 0, petBase: 99 } });
  const c5 = await call("/config", { token: A1 });
  check("adoption legitimately resets EXP to 0", c5.data.petExp === 0 && c5.data.petBase === 99);

  // ---------------------------------------------------------- categories
  section("categories");
  const catNew = await call("/categories", {
    method: "POST", token: A1, body: { icon: "💑", name: "陪伴时光", pts: 10 },
  });
  check("POST /categories → 201", catNew.status === 201, `got ${catNew.status}`);
  const catId = catNew.data.id;

  const catList = await call("/categories", { token: A2 });
  check("partner sees the new category", catList.data.some((c) => c.id === catId && c.name === "陪伴时光"));
  check("category shape: icon/name/pts/active", catList.data[0].icon === "💑" && catList.data[0].pts === 10 && catList.data[0].active === true);

  await call(`/categories-id?id=${catId}`, { method: "PUT", token: A2, body: { pts: 15, name: "陪伴时光2" } });
  const catList2 = await call("/categories", { token: A1 });
  const edited = catList2.data.find((c) => c.id === catId);
  check("PUT /categories/{id} edits", edited.pts === 15 && edited.name === "陪伴时光2");

  // ------------------------------------------------------------- entries
  section("entries");
  const e1 = await call("/entries", {
    method: "POST", token: A1,
    body: { charId: "char1", catId, catName: "陪伴时光2", icon: "💑", pts: 15, desc: "看电影", month: "2026-09", date: "2026-09-11" },
  });
  check("POST /entries → 201", e1.status === 201, `got ${e1.status}`);
  const entryId = e1.data.id;

  // an entry in an OLDER month, left unsettled — must still be returned
  const eOld = await call("/entries", {
    method: "POST", token: A2,
    body: { charId: "char2", catName: "旧月份", icon: "📌", pts: 7, desc: "上个月", month: "2026-07", date: "2026-07-04" },
  });
  check("POST older-month entry → 201", eOld.status === 201);

  const list = await call("/entries", { token: A2 });
  check("GET /entries returns both partners' entries", list.data.length === 2);
  check("older unsettled month is NOT hidden (CLAUDE.md §3)", list.data.some((e) => e.month === "2026-07"));
  check("entry shape: pts/desc/charId round-trip", list.data.some((e) => e.pts === 15 && e.desc === "看电影" && e.charId === "char1"));
  check("sorted newest date first", list.data[0].date >= list.data[1].date);

  const yearList = await call("/entries?year=2026", { token: A1 });
  check("?year=2026 returns the year's entries", yearList.data.length === 2);
  const yearNone = await call("/entries?year=1999", { token: A1 });
  check("?year=1999 returns nothing", yearNone.data.length === 0);

  await call(`/entries-id?id=${entryId}`, { method: "PUT", token: A2, body: { pts: 20, desc: "改了" } });
  const list2 = await call("/entries", { token: A1 });
  check("PUT /entries/{id} edits", list2.data.some((e) => e.id === entryId && e.pts === 20 && e.desc === "改了"));

  // -------------------------------------------------- cross-couple isolation
  section("cross-couple isolation");
  const rB = await call("/auth-register", {
    method: "POST", body: { username: u("b1"), password: "Pass123!", charId: "char1" },
  });
  created.push(u("b1"));
  matchIds.push(rB.data.matchId);
  const B1 = rB.data.accessToken;

  const bCfg = await call("/config", { token: B1 });
  check("other couple sees NONE of couple A's config", bCfg.data.configured === false);
  const bCats = await call("/categories", { token: B1 });
  check("other couple sees NONE of couple A's categories", bCats.data.length === 0, `got ${bCats.data.length}`);
  const bEntries = await call("/entries", { token: B1 });
  check("other couple sees NONE of couple A's entries", bEntries.data.length === 0, `got ${bEntries.data.length}`);

  const steal = await call(`/entries-id?id=${entryId}`, { method: "PUT", token: B1, body: { pts: 9999 } });
  check("other couple editing A's entry → 404", steal.status === 404, `got ${steal.status}`);
  const stealCat = await call(`/categories-id?id=${catId}`, { method: "DELETE", token: B1 });
  check("other couple deleting A's category → 404", stealCat.status === 404, `got ${stealCat.status}`);

  const afterSteal = await call("/entries", { token: A1 });
  check("A's entry is untouched after the attempt", afterSteal.data.some((e) => e.id === entryId && e.pts === 20));

  // --------------------------------------------- direct-to-Postgres bypass
  section("RLS: authenticated user cannot bypass the Edge Functions");
  const direct = await fetch(`${BASE}/rest/v1/entries?id=eq.${entryId}`, {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: `Bearer ${A1}`, "Content-Type": "application/json" },
    body: JSON.stringify({ points: 999999 }),
  });
  const afterDirect = await call("/entries", { token: A1 });
  check("direct PATCH changes nothing", afterDirect.data.find((e) => e.id === entryId).pts === 20, `HTTP ${direct.status}`);

  const directInsert = await fetch(`${BASE}/rest/v1/categories`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${A1}`, "Content-Type": "application/json" },
    body: JSON.stringify({ match_id: matchIds[0], name: "hacked", points: 1 }),
  });
  check("direct INSERT is rejected", directInsert.status >= 400, `HTTP ${directInsert.status}`);

  // ------------------------------------------------------------- cleanup
  section("cleanup");
  const del = await call("/entries", { token: A1 });
  for (const e of del.data) await call(`/entries-id?id=${e.id}`, { method: "DELETE", token: A1 });
  const afterDel = await call("/entries", { token: A1 });
  check("DELETE /entries/{id} removes them", afterDel.data.length === 0, `${afterDel.data.length} left`);

  await call(`/categories-id?id=${catId}`, { method: "DELETE", token: A1 });
  const catsAfter = await call("/categories", { token: A1 });
  check("DELETE /categories/{id} removes it", catsAfter.data.length === 0);

  console.log(`\n${"=".repeat(46)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log(`  failing: ${failures.join(", ")}`);
  console.log(`${"=".repeat(46)}`);
  console.log(`\nTest accounts left behind (delete with supabase/cleanup-test-users.sql):`);
  console.log(`  ${created.join(", ")}`);

  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });

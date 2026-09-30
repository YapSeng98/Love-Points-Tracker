#!/usr/bin/env node
// 周年悄悄话 (anniv-note) — live checks against the real backend.
//
// The whole point of this feature is a secret kept until a date, so most of
// these ATTACK it: the partner asking early, the partner writing over it, a
// third couple reading it, a logged-in session going round the function to
// Postgres directly, and rewriting it after it has been delivered.
//
// Registers throwaway couples (prefix `t…`, which cleanup-test-accounts.mjs removes), like the other suites.
// A delivered note can't be created through the API (you can't write for a
// day that has already begun), so one is seeded with the service key from
// tools/backup.local.json — the same key the backup uses. Nothing else here
// uses it.
//
//   node supabase/test-anniv.mjs

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

const stamp = Date.now();
const u = (n) => `t${stamp}_anv_${n}`;
const usernames = [];
const MSG = "这一路走来，有开心，也有难过。谢谢你出现在我的世界里。我爱你 ❤️";

// A date comfortably in the future and one comfortably past, in any zone.
const ymd = (d) => d.toISOString().slice(0, 10);
const FUTURE = ymd(new Date(Date.now() + 40 * 86400000));
const PAST = ymd(new Date(Date.now() - 3 * 86400000));

async function register(name, charId, pairCode) {
  const r = await call("/auth-register", { method: "POST", body: { username: u(name), password: "Pass123!", charId, pairCode } });
  usernames.push(u(name));
  return r.data;
}

async function run() {
  section("setup");
  const a1 = await register("a1", "char1");
  const a2 = await register("a2", "char2", a1.pairCode);
  const A1 = a1.accessToken, A2 = a2.accessToken;
  check("couple A paired", a1.matchId && a1.matchId === a2.matchId);
  const b1 = await register("b1", "char1");
  const b2 = await register("b2", "char2", b1.pairCode);
  const B1 = b1.accessToken, B2 = b2.accessToken;
  check("couple B paired", b1.matchId && b1.matchId === b2.matchId && b1.matchId !== a1.matchId);

  section("writing");
  const put = await call("/anniv-note", { method: "PUT", token: A1, body: { openOn: FUTURE, text: MSG, tz: 480 } });
  check("PUT own note → 200", put.status === 200 && put.data.text === MSG, `${put.status} ${JSON.stringify(put.data)}`);
  const own = await call(`/anniv-note?openOn=${FUTURE}`, { token: A1 });
  check("writer reads it back", own.data.mine === MSG && own.data.sealed === true);
  check("emoji survive the round trip", own.data.mine.endsWith("❤️"));

  section("sealed until the day");
  const early = await call(`/anniv-note?openOn=${FUTURE}`, { token: A2 });
  check("partner before the day gets nothing", early.status === 200 && early.data.theirs === "" && early.data.released === false, JSON.stringify(early.data));
  check("partner can't even tell one exists", early.data.sealed === false && early.data.mine === "");
  const rawEarly = JSON.stringify(early.data);
  check("the text is nowhere in the partner's response", !rawEarly.includes("谢谢你"));
  // The client date must not matter: the request carries none, but try anyway.
  const spoof = await call(`/anniv-note?openOn=${FUTURE}&date=${FUTURE}`, { token: A2 });
  check("claiming it is already the day changes nothing", spoof.data.theirs === "");

  section("each writes only their own");
  await call("/anniv-note", { method: "PUT", token: A2, body: { openOn: FUTURE, text: "YY 写的", tz: 480 } });
  const afterA2 = await call(`/anniv-note?openOn=${FUTURE}`, { token: A1 });
  check("partner's PUT did not touch CS's note", afterA2.data.mine === MSG);
  const a2own = await call(`/anniv-note?openOn=${FUTURE}`, { token: A2 });
  check("partner's PUT wrote their own", a2own.data.mine === "YY 写的");
  await call("/anniv-note", { method: "PUT", token: A2, body: { openOn: FUTURE, text: "", tz: 480 } });
  check("empty text removes your own", (await call(`/anniv-note?openOn=${FUTURE}`, { token: A2 })).data.sealed === false);
  check("…and only your own", (await call(`/anniv-note?openOn=${FUTURE}`, { token: A1 })).data.mine === MSG);

  section("another couple");
  const other = await call(`/anniv-note?openOn=${FUTURE}`, { token: B1 });
  check("other couple sees nothing for the same date", other.data.mine === "" && other.data.theirs === "" && !JSON.stringify(other.data).includes("谢谢你"));
  await call("/anniv-note", { method: "PUT", token: B1, body: { openOn: FUTURE, text: "B 的", tz: 480 } });
  check("other couple writing the same date leaves A alone", (await call(`/anniv-note?openOn=${FUTURE}`, { token: A1 })).data.mine === MSG);
  check("…and doesn't leak into A's partner", (await call(`/anniv-note?openOn=${FUTURE}`, { token: A2 })).data.theirs === "");

  section("going round the function");
  const direct = await fetch(`${BASE}/rest/v1/anniv_notes?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${A2}` } });
  const directRows = await direct.json().catch(() => null);
  check("a logged-in session reading the table directly gets no rows", Array.isArray(directRows) ? directRows.length === 0 : direct.status >= 400, `${direct.status} ${JSON.stringify(directRows).slice(0, 80)}`);
  const directW = await fetch(`${BASE}/rest/v1/anniv_notes`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${A2}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ match_id: a1.matchId, char: "char1", open_on: FUTURE, text: "forged" }),
  });
  check("…and cannot write it directly", directW.status >= 400, `got ${directW.status}`);
  check("CS's note unchanged after the attempt", (await call(`/anniv-note?openOn=${FUTURE}`, { token: A1 })).data.mine === MSG);

  section("delivered (seeded past the day)");
  const seed = await fetch(`${BASE}/rest/v1/anniv_notes`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ match_id: a1.matchId, char: "char1", open_on: PAST, tz_min: 480, text: MSG }),
  });
  check("seeded a note whose day has passed", seed.status === 201, `got ${seed.status} ${await seed.text()}`);
  const opened = await call(`/anniv-note?openOn=${PAST}`, { token: A2 });
  check("partner gets it once the day has come", opened.data.theirs === MSG && opened.data.released === true, JSON.stringify(opened.data));
  const late = await call("/anniv-note", { method: "PUT", token: A1, body: { openOn: PAST, text: "changed my mind", tz: 480 } });
  check("writer can't rewrite a delivered note → 409", late.status === 409, `got ${late.status}`);
  check("delivered note unchanged", (await call(`/anniv-note?openOn=${PAST}`, { token: A2 })).data.theirs === MSG);
  const lateNew = await call("/anniv-note", { method: "PUT", token: A2, body: { openOn: PAST, text: "backdated", tz: 480 } });
  check("can't write a new note for a day that has begun → 409", lateNew.status === 409, `got ${lateNew.status}`);
  check("other couple still sees nothing on the delivered date", (await call(`/anniv-note?openOn=${PAST}`, { token: B2 })).data.theirs === "");

  section("time zone of the writer decides");
  // Written at UTC-12 for today: it's still "today minus a bit" there only if
  // UTC hasn't reached 12:00 yet — too clock-dependent to assert both ways.
  // Instead: the far-east zone (+14) opens earliest, so a note for tomorrow
  // written at +14 opens at tomorrow 00:00+14 = today 10:00Z.
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  const opensAt = Date.parse(`${tomorrow}T00:00:00Z`) - 840 * 60000;
  const w14 = await call("/anniv-note", { method: "PUT", token: B1, body: { openOn: tomorrow, text: "east", tz: 840 } });
  const r14 = await call(`/anniv-note?openOn=${tomorrow}`, { token: B2 });
  if (Date.now() < opensAt) {
    check("UTC+14 note for tomorrow: still sealed before 10:00Z", w14.status === 200 && r14.data.theirs === "");
  } else {
    check("UTC+14 note for tomorrow: past 10:00Z it counts as delivered", w14.status === 409);
  }

  section("validation");
  check("bad openOn → 400", (await call("/anniv-note?openOn=12-24", { token: A1 })).status === 400);
  check("missing openOn → 400", (await call("/anniv-note", { token: A1 })).status === 400);
  const long = await call("/anniv-note", { method: "PUT", token: A1, body: { openOn: FUTURE, text: "爱".repeat(260), tz: 480 } });
  check("over 200 characters is cut to 200", long.status === 200 && [...long.data.text].length === 200);
  check("POST is refused", (await call("/anniv-note", { method: "POST", token: A1, body: {} })).status === 405);
  check("no session → 401", (await call(`/anniv-note?openOn=${FUTURE}`)).status === 401);
  const pre = await fetch(`${FN}/anniv-note`, { method: "OPTIONS", headers: { Origin: "https://example.github.io", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "apikey, authorization, content-type" } });
  check("browser preflight answered (§9.06 #3)", pre.status === 200 && /apikey/.test(pre.headers.get("access-control-allow-headers") || ""));

  console.log(`\n${"=".repeat(48)}\n  ${pass} passed, ${fail} failed`);
  if (fail) console.log(`  failing:\n   - ${failures.join("\n   - ")}`);
  console.log(`${"=".repeat(48)}\n\nthrowaway accounts: ${usernames.join(", ")}`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });

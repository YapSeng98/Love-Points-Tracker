#!/usr/bin/env node
// game-save — live checks against the real backend (我们的家's shared save).
//
// What has to hold: both partners read and write one save; a write against an
// old rev is refused with the newer save (never a silent overwrite, even when
// both phones write at the same instant); another couple sees nothing; the
// flower count that feeds pet EXP only grows; and a logged-in session can't go
// round the function to Postgres.
//
// Registers throwaway couples (prefix `t…`, removed by cleanup-test-accounts.mjs).
//
//   node supabase/test-games.mjs

const BASE = "https://yvllstktmjoedfsgojgs.supabase.co";
const FN = `${BASE}/functions/v1`;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const section = (t) => console.log(`\n=== ${t} ===`);

async function call(path, { method = "GET", token, body, raw } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${FN}${path}`, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const get = (token, game = "home", slot = "") => call(`/game-save?game=${game}${slot ? `&slot=${slot}` : ""}`, { token });
const put = (token, rev, data, game = "home", slot = "") => call("/game-save", { method: "PUT", token, body: { game, slot, rev, data } });

const stamp = Date.now();
const u = (n) => `t${stamp}_gs_${n}`;
async function register(name, charId, pairCode) {
  const r = await call("/auth-register", { method: "POST", body: { username: u(name), password: "Pass123!", charId, pairCode } });
  return r.data;
}
const garden = (picked, extra = {}) => ({ v: 1, picked, album: picked ? { daisy: picked } : {}, pots: [null, null], ...extra });

async function run() {
  section("setup");
  const a1 = await register("a1", "char1");
  const a2 = await register("a2", "char2", a1.pairCode);
  const A1 = a1.accessToken, A2 = a2.accessToken;
  check("couple A paired", a1.matchId && a1.matchId === a2.matchId);
  const b1 = await register("b1", "char1");
  const b2 = await register("b2", "char2", b1.pairCode);
  const B1 = b1.accessToken;
  check("couple B paired", b1.matchId && b1.matchId === b2.matchId && b1.matchId !== a1.matchId);

  section("first save");
  const empty = await get(A1);
  check("nothing saved yet → rev 0, data null", empty.status === 200 && empty.data.rev === 0 && empty.data.data === null, JSON.stringify(empty.data));
  const first = await put(A1, 0, garden(0, { pots: [{ id: "p1", seed: "daisy", at: "2026-11-25", w: { "2026-11-25": 1 } }, null] }));
  check("PUT at rev 0 → rev 1", first.status === 200 && first.data.rev === 1, `${first.status} ${JSON.stringify(first.data)}`);
  const back = await get(A2);
  check("the partner reads the same save", back.data.rev === 1 && back.data.data.pots[0].seed === "daisy" && back.data.by === "char1", JSON.stringify(back.data));
  check("…with the watering intact", back.data.data.pots[0].w["2026-11-25"] === 1);

  section("compare-and-set");
  const again = await put(A2, 0, garden(0));
  check("a second create is refused as stale", again.status === 409 && again.data.error === "stale" && again.data.rev === 1, `${again.status} ${JSON.stringify(again.data)}`);
  check("…and hands back the save that won", again.data.data && again.data.data.pots[0].seed === "daisy");
  const second = await put(A2, 1, { ...back.data.data, pots: [{ ...back.data.data.pots[0], w: { "2026-11-25": 3 } }, null] });
  check("the partner writes on top of rev 1 → rev 2", second.status === 200 && second.data.rev === 2, JSON.stringify(second.data));
  const old = await put(A1, 1, garden(0));
  check("a write against an old rev → 409", old.status === 409 && old.data.rev === 2 && old.data.by === "char2", JSON.stringify(old.data));
  const kept = await get(A1);
  check("the refused write changed nothing", kept.data.rev === 2 && kept.data.data.pots[0].w["2026-11-25"] === 3, JSON.stringify(kept.data));

  section("both phones at the same instant ×6");
  let rev = kept.data.rev, okRounds = 0;
  for (let r = 0; r < 6; r++) {
    const [x, y] = await Promise.all([
      put(A1, rev, garden(0, { tag: `cs${r}` })),
      put(A2, rev, garden(0, { tag: `yy${r}` })),
    ]);
    const wins = [x, y].filter(z => z.status === 200).length, stales = [x, y].filter(z => z.status === 409).length;
    const now = await get(A1);
    const winner = x.status === 200 ? `cs${r}` : `yy${r}`;
    if (wins === 1 && stales === 1 && now.data.rev === rev + 1 && now.data.data.tag === winner) okRounds++;
    else console.log(`    round ${r}: ${x.status}/${y.status} rev ${now.data.rev} tag ${now.data.data.tag}`);
    rev = now.data.rev;
  }
  check("every round: exactly one write wins and it is the one stored", okRounds === 6, `${okRounds}/6`);

  section("flowers only grow");
  let cur = (await get(A1)).data;
  const five = await put(A1, cur.rev, garden(5));
  check("picked 0 → 5 in one write is allowed", five.status === 200, JSON.stringify(five.data));
  cur = (await get(A1)).data;
  const down = await put(A2, cur.rev, garden(4));
  check("picked can't go down", down.status === 400 && /only grow/.test(down.data.error), JSON.stringify(down.data));
  const leap = await put(A2, cur.rev, garden(12));
  check("…or jump by more than a flower per pot", leap.status === 400, JSON.stringify(leap.data));
  const noCount = await put(A2, cur.rev, { v: 1, pots: [] });
  check("…or be left out (an old app can't reset it)", noCount.status === 400, JSON.stringify(noCount.data));
  const fat = await put(A2, cur.rev, { ...garden(6), album: { daisy: 9 } });
  check("the album can't hold more flowers than were picked", fat.status === 400, JSON.stringify(fat.data));
  const badBits = await put(A2, cur.rev, garden(5, { pots: [{ id: "p", seed: "rose", at: "2026-11-25", w: { "2026-11-25": 7 } }] }));
  check("a watering is one partner, the other, or both", badBits.status === 400, JSON.stringify(badBits.data));
  const after = await get(A1);
  check("none of the refused writes landed", after.data.rev === cur.rev && after.data.data.picked === 5, JSON.stringify(after.data));

  section("bad requests");
  check("unknown game → 400", (await get(A1, "chess")).status === 400);
  check("prototype names are not games", (await get(A1, "constructor")).status === 400);
  check("bad slot → 400", (await get(A1, "home", "../x")).status === 400);
  check("data must be an object", (await call("/game-save", { method: "PUT", token: A1, body: { game: "home", rev: after.data.rev, data: [1, 2] } })).status === 400);
  check("rev must be a whole number", (await call("/game-save", { method: "PUT", token: A1, body: { game: "home", rev: "x", data: garden(5) } })).status === 400);
  check("a body that isn't JSON → 400", (await call("/game-save", { method: "PUT", token: A1, raw: "{nope" })).status === 400);
  const big = await put(A1, after.data.rev, garden(5, { pad: "x".repeat(17000) }));
  check("a save over 16 KB → 413", big.status === 413, `${big.status}`);
  check("POST → 405", (await call("/game-save", { method: "POST", token: A1, body: {} })).status === 405);
  check("no login → 401", (await get(undefined)).status === 401);
  check("a made-up token → 401", (await get("not-a-token")).status === 401);

  section("slots are separate");
  const s1 = await put(A1, 0, { v: 1, picked: 0, note: "slot x" }, "home", "x");
  check("a new slot starts at rev 0", s1.status === 200 && s1.data.rev === 1, JSON.stringify(s1.data));
  const main = await get(A1);
  check("…and leaves the main save alone", main.data.data.picked === 5 && !main.data.data.note);

  section("another couple");
  const theirs = await get(B1);
  check("couple B sees nothing of couple A", theirs.status === 200 && theirs.data.rev === 0 && theirs.data.data === null, JSON.stringify(theirs.data));
  const bw = await put(B1, 0, garden(1));
  check("couple B gets its own save", bw.status === 200 && bw.data.rev === 1);
  const bOver = await put(B1, main.data.rev, garden(6));
  check("…and can't write at couple A's rev into A's save", bOver.status === 409 || bOver.status === 400, `${bOver.status}`);
  const aStill = await get(A1);
  check("couple A's save is untouched", aStill.data.rev === main.data.rev && aStill.data.data.picked === 5);

  section("round the function, straight to Postgres");
  const rest = async (method, query, body) => {
    const res = await fetch(`${BASE}/rest/v1/game_saves${query}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${A1}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let d; try { d = JSON.parse(text); } catch { d = text; }
    return { status: res.status, data: d };
  };
  const sel = await rest("GET", "?select=*");
  check("a session token reads no rows", Array.isArray(sel.data) ? sel.data.length === 0 : sel.status >= 400, JSON.stringify(sel.data).slice(0, 120));
  const pat = await rest("PATCH", `?match_id=eq.${a1.matchId}`, { data: { v: 1, picked: 999 } });
  const ins = await rest("POST", "", { match_id: a1.matchId, game: "home", slot: "zz", data: { picked: 999 } });
  const aFinal = await get(A1);
  check("a direct PATCH changes nothing", aFinal.data.data.picked === 5 && aFinal.data.rev === main.data.rev, `${pat.status} → ${JSON.stringify(aFinal.data.data).slice(0, 80)}`);
  const zz = await get(A1, "home", "zz");
  check("a direct INSERT is refused", ins.status >= 400 && zz.data.rev === 0, `${ins.status} / zz rev ${zz.data.rev}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("failures:\n  " + failures.join("\n  ")); process.exit(1); }
}
run().catch((e) => { console.error(e); process.exit(1); });

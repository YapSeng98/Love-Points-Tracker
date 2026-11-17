#!/usr/bin/env node
// The couple's live channel (Realtime Broadcast, private) — attacked live.
//
// Shared fireworks (and later the shared house) ride on "couple:<match id>".
// Only that couple may join, hear or send; these checks try every way round:
// no login, a stranger's login, the public (non-private) door, a made-up topic.
// Registers throwaway couples (prefix `t…`; cleanup-test-accounts.mjs removes them).
//
//   node supabase/test-live.mjs

const BASE = "https://yvllstktmjoedfsgojgs.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB";
const WS = `${BASE.replace("https", "wss")}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`;

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function reg(body) {
  const r = await fetch(`${BASE}/functions/v1/auth-register`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
// One socket, one channel. Resolves with the join's outcome either way.
function join(topic, { token, priv = true } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS), got = [];
    const full = `realtime:${topic}`;
    const done = (status, why) => resolve({ ws, got, status, why, send: (event, payload) => ws.send(JSON.stringify({ topic: full, event: "broadcast", payload: { type: "broadcast", event, payload }, ref: String(Date.now()), join_ref: "1" })), close: () => { try { ws.close(); } catch {} } });
    ws.onopen = () => ws.send(JSON.stringify({ topic: full, event: "phx_join", ref: "1", join_ref: "1",
      payload: { config: { broadcast: { self: false, ack: false }, presence: { key: "" }, private: priv }, ...(token ? { access_token: token } : {}) } }));
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.event === "phx_reply" && d.ref === "1") done(d.payload.status, JSON.stringify(d.payload.response).slice(0, 140));
      if (d.event === "broadcast") got.push(d.payload);
    };
    ws.onerror = () => done("error", "socket error");
    setTimeout(() => done("timeout", ""), 9000);
  });
}

const s = Date.now();
const a = await reg({ username: `t${s}_lv1`, password: "Pass123!", charId: "char1" });
const b = await reg({ username: `t${s}_lv2`, password: "Pass123!", charId: "char2", pairCode: a.pairCode });
const c = await reg({ username: `t${s}_lv3`, password: "Pass123!", charId: "char1" });
const d = await reg({ username: `t${s}_lv4`, password: "Pass123!", charId: "char2", pairCode: c.pairCode });
check("two throwaway couples", a.matchId && a.matchId === b.matchId && c.matchId && c.matchId === d.matchId && a.matchId !== c.matchId);
const topic = `couple:${a.matchId}`;

console.log("\n=== the couple ===");
const A = await join(topic, { token: a.accessToken }), B = await join(topic, { token: b.accessToken });
check("both partners join their own channel", A.status === "ok" && B.status === "ok", `${A.status} ${A.why} / ${B.status} ${B.why}`);
const t0 = Date.now();
A.send("fw", { x: 0.4, y: 0.3, seed: 42 });
for (let i = 0; i < 40 && !B.got.length; i++) await sleep(50);
const ms = Date.now() - t0;
check(`what one sends, the other hears (${ms} ms)`, B.got.length === 1 && B.got[0].event === "fw" && B.got[0].payload.seed === 42, JSON.stringify(B.got));
await sleep(300);
check("and the sender does not hear itself", A.got.length === 0, JSON.stringify(A.got));

console.log("\n=== everyone else ===");
const noLogin = await join(topic, {});
check("no login: refused", noLogin.status !== "ok", `${noLogin.status} ${noLogin.why}`);
const stranger = await join(topic, { token: c.accessToken });
check("another couple's login: refused", stranger.status !== "ok", `${stranger.status} ${stranger.why}`);
const guess = await join("couple:00000000-0000-0000-0000-000000000000", { token: c.accessToken });
check("a made-up couple id: refused", guess.status !== "ok", `${guess.status} ${guess.why}`);
// The public door to the same topic name is a DIFFERENT channel: joining it must hear nothing of the private one, and what it sends must not arrive.
const pub = await join(topic, { priv: false }), pubC = await join(topic, { token: c.accessToken, priv: false });
B.got.length = 0;
A.send("fw", { seed: 7 });
if (pub.status === "ok") pub.send("fw", { seed: 666 });
if (pubC.status === "ok") pubC.send("fw", { seed: 667 });
await sleep(1500);
// (the two public listeners hear each other — that door is open to anyone, which is why nothing of ours uses it)
check("a listener on the public door hears nothing from the couple", ![...pub.got, ...pubC.got].some((m) => m.payload && m.payload.seed === 7), JSON.stringify([pub.got, pubC.got]));
check("and nothing sent through the public door reaches the couple", B.got.length === 1 && B.got[0].payload.seed === 7, JSON.stringify(B.got));
// their own channel still works for the other couple
const C = await join(`couple:${c.matchId}`, { token: c.accessToken }), D = await join(`couple:${c.matchId}`, { token: d.accessToken });
C.send("fw", { seed: 9 }); await sleep(1200);
check("the other couple's own channel works, and stays theirs", C.status === "ok" && D.got.length === 1 && B.got.length === 1, `${C.status} ${C.why} ${JSON.stringify(D.got)}`);

for (const x of [A, B, noLogin, stranger, guess, pub, pubC, C, D]) x.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

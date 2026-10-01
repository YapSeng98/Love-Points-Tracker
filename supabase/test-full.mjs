#!/usr/bin/env node
// Full end-to-end suite for the Supabase backend — every ported resource.
//
// Registers throwaway couples each run, so it is safe to re-run any time.
// Asserts behaviour through the real HTTP API, never the storage encoding
// (CLAUDE.md §9.1), and replays the specific bugs CLAUDE.md records so a
// regression goes red here first.
//
//   node supabase/test-full.mjs

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
function section(t) { console.log(`\n=== ${t} ===`); }

async function call(path, { method = "GET", token, body } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${FN}${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const stamp = Date.now();
const u = (n) => `f${stamp}_${n}`;
const usernames = [];

// 1x1 red png
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function run() {
  // ------------------------------------------------------------- setup
  section("setup: register a paired couple");
  const r1 = await call("/auth-register", { method: "POST", body: { username: u("a1"), password: "Pass123!", charId: "char1" } });
  const A1 = r1.data.accessToken;
  usernames.push(u("a1"));
  const r2 = await call("/auth-register", { method: "POST", body: { username: u("a2"), password: "Pass123!", charId: "char2", pairCode: r1.data.pairCode } });
  const A2 = r2.data.accessToken;
  usernames.push(u("a2"));
  check("couple paired", r1.data.matchId && r1.data.matchId === r2.data.matchId);

  // --------------------------------------------------------- rewards
  section("rewards");
  const rw = await call("/rewards", { method: "POST", token: A1, body: { icon: "🧋", name: "奶茶", minPts: 50, desc: "一杯奶茶" } });
  check("POST /rewards → 201", rw.status === 201, `got ${rw.status}`);
  const rewardId = rw.data.id;
  const rwList = await call("/rewards", { token: A2 });
  const rwOne = rwList.data.find((x) => x.id === rewardId);
  check("reward shape icon/name/minPts/desc", rwOne.icon === "🧋" && rwOne.name === "奶茶" && rwOne.minPts === 50 && rwOne.desc === "一杯奶茶");
  check("new reward is unclaimed by both", rwOne.claimed1 === false && rwOne.claimed2 === false && rwOne.claimed === false);
  await call(`/rewards-id?id=${rewardId}`, { method: "PUT", token: A2, body: { minPts: 40 } });
  check("PUT /rewards/{id} edits", (await call("/rewards", { token: A1 })).data.find((x) => x.id === rewardId).minPts === 40);

  // ----------------------------------------------------- punishments
  section("punishments");
  const pn = await call("/punishments", { method: "POST", token: A1, body: { icon: "🧹", name: "做家务", minPts: -30, desc: "扫地" } });
  check("POST /punishments → 201", pn.status === 201, `got ${pn.status}`);
  const punId = pn.data.id;
  const pnList = await call("/punishments", { token: A2 });
  check("punishment visible to partner", pnList.data.some((x) => x.id === punId && x.name === "做家务" && x.minPts === -30));
  await call(`/punishments-id?id=${punId}`, { method: "PUT", token: A1, body: { name: "做家务2" } });
  check("PUT /punishments/{id} edits", (await call("/punishments", { token: A2 })).data.find((x) => x.id === punId).name === "做家务2");

  // ------------------------------------------------------------ shop
  section("shop");
  const sh = await call("/shop", { method: "POST", token: A1, body: { icon: "🍿", name: "电影票", desc: "看电影", ptsCost: 30 } });
  check("POST /shop → 201", sh.status === 201, `got ${sh.status}`);
  const shopId = sh.data.id;
  const shList = await call("/shop", { token: A2 });
  check("shop item visible to partner", shList.data.some((x) => x.id === shopId && x.ptsCost === 30 && x.active === true));

  // ------------------------------------------- buy: insufficient points
  section("shop/buy — score rules");
  const poor = await call(`/shop-buy?id=${shopId}`, { method: "POST", token: A1, body: { date: "2026-09-11", month: "2026-09" } });
  check("buy with 0 points → insufficient_points", poor.status === 400 && poor.data.error === "insufficient_points", JSON.stringify(poor.data));

  // give char1 points in an OLDER unsettled month — the CLAUDE.md §3 trap:
  // this must still count toward purchases even though it is not "this month"
  await call("/entries", { method: "POST", token: A1, body: { charId: "char1", catName: "旧月加分", icon: "💑", pts: 100, desc: "上个月", month: "2026-07", date: "2026-07-04" } });

  const buy = await call(`/shop-buy?id=${shopId}`, { method: "POST", token: A1, body: { date: "2026-09-11", month: "2026-09" } });
  check("buy counts UNSETTLED entries from an older month (CLAUDE.md §3)", buy.status === 201, JSON.stringify(buy.data));
  check("buy returns newScore = 100 - 30", buy.data.newScore === 70, `got ${buy.data.newScore}`);

  const afterBuy = await call("/entries", { token: A1 });
  const deduction = afterBuy.data.find((e) => e.pts === -30);
  check("buy wrote a -30 deduction entry", !!deduction);
  check("deduction is labelled 商店兑换", deduction.catName === "🛒 商店兑换");
  check("deduction uses the CLIENT's date, not server's (CLAUDE.md §2)", deduction.date === "2026-09-11", `got ${deduction.date}`);

  // ------------------------------------------------------------- bag
  section("bag");
  const bag1 = await call("/bag", { token: A1 });
  check("bought item is in char1's bag", bag1.data.some((b) => b.itemName === "电影票" && b.sourceType === "purchase"));
  const bagItemId = bag1.data.find((b) => b.itemName === "电影票").id;
  const bag2 = await call("/bag", { token: A2 });
  check("char2 does NOT see char1's bag item (per-person)", !bag2.data.some((b) => b.id === bagItemId));

  const useByPartner = await call(`/bag-use?id=${bagItemId}`, { method: "POST", token: A2, body: { date: "2026-09-12" } });
  check("partner cannot use char1's item → 404", useByPartner.status === 404, `got ${useByPartner.status}`);

  const use = await call(`/bag-use?id=${bagItemId}`, { method: "POST", token: A1, body: { date: "2026-09-12" } });
  check("owner can use own item", use.status === 200, JSON.stringify(use.data));
  const useAgain = await call(`/bag-use?id=${bagItemId}`, { method: "POST", token: A1, body: { date: "2026-09-12" } });
  check("using twice → already_used", useAgain.status === 400 && useAgain.data.error === "already_used");
  check("used item leaves the active bag", !(await call("/bag", { token: A1 })).data.some((b) => b.id === bagItemId));
  const hist = await call("/bag-history", { token: A1 });
  check("used item appears in bag history with usedDate", hist.data.some((b) => b.id === bagItemId && b.usedDate === "2026-09-12"));

  // ----------------------------------------------------------- claim
  section("bag/claim — per-character milestone claims");
  const lowClaim = await call("/bag-claim", { method: "POST", token: A2, body: { rewardId, charId: "char2", date: "2026-09-11", month: "2026-09" } });
  check("claim without enough score → score_not_reached", lowClaim.status === 400 && lowClaim.data.error === "score_not_reached", JSON.stringify(lowClaim.data));

  const claim1 = await call("/bag-claim", { method: "POST", token: A1, body: { rewardId, charId: "char1", date: "2026-09-11", month: "2026-09" } });
  check("char1 claims (70 ≥ 40)", claim1.status === 201, JSON.stringify(claim1.data));
  const claimAgain = await call("/bag-claim", { method: "POST", token: A1, body: { rewardId, charId: "char1", date: "2026-09-11", month: "2026-09" } });
  check("char1 claiming twice → already_claimed", claimAgain.status === 400 && claimAgain.data.error === "already_claimed");

  const rwAfter = (await call("/rewards", { token: A1 })).data.find((x) => x.id === rewardId);
  check("char1's claim does NOT mark char2 claimed", rwAfter.claimed1 === true && rwAfter.claimed2 === false);
  check("claimedDate1 recorded from client date", rwAfter.claimedDate1 === "2026-09-11", `got ${rwAfter.claimedDate1}`);
  check("claimed reward lands in char1's bag at 0 points", (await call("/bag", { token: A1 })).data.some((b) => b.itemName === "奶茶" && b.sourceType === "reward" && b.ptsSpent === 0));

  // ----------------------------------------------------------- decor
  section("decor — shared room, paid in coins not points");
  const scoreBeforeDecor = (await call("/entries", { token: A1 })).data.reduce((s, e) => s + e.pts, 0);
  const dec = await call("/decor-buy", { method: "POST", token: A1, body: { itemId: "mooncake_box_27", itemName: "月饼盒", itemIcon: "🥮", price: 60, date: "2026-09-11", month: "2026-09" } });
  check("POST /decor-buy → 201", dec.status === 201, JSON.stringify(dec.data));
  const scoreAfterDecor = (await call("/entries", { token: A1 })).data.reduce((s, e) => s + e.pts, 0);
  check("decor does NOT deduct love points (coins are separate)", scoreAfterDecor === scoreBeforeDecor, `${scoreBeforeDecor} → ${scoreAfterDecor}`);

  const dup = await call("/decor-buy", { method: "POST", token: A2, body: { itemId: "mooncake_box_27", price: 60 } });
  check("buying the same decor twice → already_owned", dup.status === 400 && dup.data.error === "already_owned");

  const decorA = await call("/bag?type=decor", { token: A1 });
  const decorB = await call("/bag?type=decor", { token: A2 });
  check("decor visible to the buyer", decorA.data.some((d) => d.itemId === "mooncake_box_27"));
  check("decor ALSO visible to the partner (shared room)", decorB.data.some((d) => d.itemId === "mooncake_box_27"));
  check("decor keeps its catalog id, not a uuid", decorA.data.find((d) => d.itemId === "mooncake_box_27").itemId === "mooncake_box_27");
  check("decor price recorded as the coin ledger", decorA.data.find((d) => d.itemId === "mooncake_box_27").ptsSpent === 60);
  check("decor does NOT leak into the normal reward bag", !(await call("/bag", { token: A1 })).data.some((b) => b.sourceType === "decor"));

  // -------------------------------------------------- settle + history
  section("monthly settle + history");
  const before = await call("/entries", { token: A1 });
  const julyCount = before.data.filter((e) => e.month === "2026-07").length;
  check("July entries are pending before settle", julyCount > 0);

  const settle = await call("/monthly-settle", { method: "POST", token: A1, body: { month: "2026-07", char1Pts: 100, char2Pts: 0, mode: "reward", result1: "达成", result2: "未达成" } });
  check("settle July → success", settle.status === 200 && settle.data.success, JSON.stringify(settle.data));

  const settleAgain = await call("/monthly-settle", { method: "POST", token: A1, body: { month: "2026-07" } });
  check("settling again → alreadySettled (duplicate click is safe)", settleAgain.data.alreadySettled === true);

  const afterSettle = await call("/entries", { token: A1 });
  check("settled July entries leave /entries", !afterSettle.data.some((e) => e.month === "2026-07"));
  check("unsettled September entries remain", afterSettle.data.some((e) => e.month === "2026-09"));
  const yearAll = await call("/entries?year=2026", { token: A1 });
  check("?year=2026 still returns SETTLED entries (年度回顾)", yearAll.data.some((e) => e.month === "2026-07"));

  const rwReset = (await call("/rewards", { token: A1 })).data.find((x) => x.id === rewardId);
  check("settle re-opens milestone claims for both", rwReset.claimed1 === false && rwReset.claimed2 === false);

  const histList = await call("/history", { token: A2 });
  check("history shows the settled month", histList.data.some((h) => h.month === "2026-07" && h.char1Pts === 100 && h.result1 === "达成"));

  // ------------------------------- settle: what you see is what is archived
  // Reported 2026-10-01: four 9/30 entries logged on 10/1 were labelled
  // October (the app sent "the month right now" beside a backdated date), so
  // September's settle left them out. Plus the two ways the same symptom
  // could happen with correct labels: a partner logging while the other
  // settles, and both partners pressing 结算 together.
  section("settle — month follows the date, stale previews, races");
  const back = await call("/entries", { method: "POST", token: A1, body: { charId: "char1", catName: "说晚安", icon: "🫶", pts: 5, desc: "", date: "2026-08-31", month: "2026-09" } });
  const backRow = (await call("/entries", { token: A1 })).data.find((e) => e.id === back.data.id);
  check("backdated entry is labelled by its DATE's month (8/31 → 2026-08, not 2026-09)", backRow && backRow.month === "2026-08", `got ${backRow && backRow.month}`);

  const moved = await call("/entries", { method: "POST", token: A2, body: { charId: "char2", catName: "12.00睡觉", icon: "😴", pts: 1, desc: "", date: "2026-09-03", month: "2026-09" } });
  await call(`/entries-id?id=${moved.data.id}`, { method: "PUT", token: A2, body: { date: "2026-08-30" } });
  const movedRow = (await call("/entries", { token: A1 })).data.find((e) => e.id === moved.data.id);
  check("editing the date moves the entry to that month", movedRow && movedRow.date === "2026-08-30" && movedRow.month === "2026-08", JSON.stringify(movedRow));
  check("an invalid date is refused, not stored", (await call(`/entries-id?id=${moved.data.id}`, { method: "PUT", token: A2, body: { date: "30/08/2026" } })).status === 400);

  const augSeen = (await call("/entries", { token: A1 })).data
    .filter((e) => e.month === "2026-08").map((e) => [e.id, e.pts, e.charId]);
  check("both August entries are pending", augSeen.length === 2, `got ${augSeen.length}`);
  // the partner logs one more August entry after A1's preview was taken
  const late = await call("/entries", { method: "POST", token: A2, body: { charId: "char2", catName: "说晚安", icon: "🫶", pts: 5, desc: "", date: "2026-08-31" } });
  const stale = await call("/monthly-settle", { method: "POST", token: A1, body: { month: "2026-08", char1Pts: 5, char2Pts: 1, mode: "reward", result1: "无结果", result2: "无结果", seen: augSeen } });
  check("settling a preview that missed a new entry → 409 stale", stale.status === 409 && stale.data.error === "stale", `${stale.status} ${JSON.stringify(stale.data)}`);
  check("…and nothing was archived", (await call("/entries", { token: A1 })).data.filter((e) => e.month === "2026-08").length === 3);
  check("…and no history row was written", !(await call("/history", { token: A1 })).data.some((h) => h.month === "2026-08"));

  // the partner edits points after the preview → also stale
  const augSeen2 = (await call("/entries", { token: A1 })).data
    .filter((e) => e.month === "2026-08").map((e) => [e.id, e.pts, e.charId]);
  await call(`/entries-id?id=${late.data.id}`, { method: "PUT", token: A2, body: { pts: 8 } });
  const stale2 = await call("/monthly-settle", { method: "POST", token: A1, body: { month: "2026-08", char1Pts: 5, char2Pts: 6, mode: "reward", seen: augSeen2 } });
  check("settling after the partner changed a score → 409 stale", stale2.status === 409, `got ${stale2.status}`);

  const augFresh = (await call("/entries", { token: A1 })).data
    .filter((e) => e.month === "2026-08").map((e) => [e.id, e.pts, e.charId]);
  const okSettle = await call("/monthly-settle", { method: "POST", token: A1, body: { month: "2026-08", char1Pts: 5, char2Pts: 9, mode: "reward", result1: "无结果", result2: "无结果", seen: augFresh } });
  check("settling the fresh preview → success", okSettle.status === 200 && okSettle.data.monthId, JSON.stringify(okSettle.data));
  const augHist = (await call("/history", { token: A2 })).data.filter((h) => h.month === "2026-08");
  check("history holds the totals of exactly what was archived", augHist.length === 1 && augHist[0].char1Pts === 5 && augHist[0].char2Pts === 9, JSON.stringify(augHist));

  const yearFlags = (await call("/entries?year=2026", { token: A1 })).data;
  check("?year marks archived entries settled:true", yearFlags.filter((e) => e.month === "2026-08").every((e) => e.settled === true));
  check("?year marks live entries settled:false", yearFlags.filter((e) => e.month === "2026-09").every((e) => e.settled === false));

  const lockedEdit = await call(`/entries-id?id=${back.data.id}`, { method: "PUT", token: A1, body: { pts: 50 } });
  check("editing a SETTLED entry → 409", lockedEdit.status === 409, `got ${lockedEdit.status}`);
  const lockedDel = await call(`/entries-id?id=${back.data.id}`, { method: "DELETE", token: A2 });
  check("deleting a SETTLED entry → 409", lockedDel.status === 409, `got ${lockedDel.status}`);
  const stillThere = (await call("/entries?year=2026", { token: A1 })).data.find((e) => e.id === back.data.id);
  check("…and the settled entry is unchanged", stillThere && stillThere.pts === 5);

  // both partners press 结算 at the same moment, with and without `seen`
  for (const [m, withSeen] of [["2026-06", true], ["2026-05", false], ["2026-04", true]]) {
    for (let k = 0; k < 3; k++) {
      await call("/entries", { method: "POST", token: k % 2 ? A2 : A1, body: { charId: k % 2 ? "char2" : "char1", catName: "陪伴", icon: "💑", pts: 10, desc: "", date: `${m}-1${k}` } });
    }
    const seen = (await call("/entries", { token: A1 })).data.filter((e) => e.month === m).map((e) => [e.id, e.pts, e.charId]);
    const body = { month: m, char1Pts: 20, char2Pts: 10, mode: "reward", result1: "无结果", result2: "无结果", ...(withSeen ? { seen } : {}) };
    const [x, y] = await Promise.all([
      call("/monthly-settle", { method: "POST", token: A1, body }),
      call("/monthly-settle", { method: "POST", token: A2, body }),
    ]);
    const rows = (await call("/history", { token: A1 })).data.filter((h) => h.month === m);
    check(`two simultaneous settles of ${m}${withSeen ? "" : " (old app, no seen)"} → exactly one history row`, rows.length === 1, `rows=${rows.length}, ${x.status} ${JSON.stringify(x.data)} / ${y.status} ${JSON.stringify(y.data)}`);
    check(`…and every ${m} entry is archived`, !(await call("/entries", { token: A1 })).data.some((e) => e.month === m));
  }

  // a 月末结算 history longer than two years must not lose its oldest rows
  const months = Array.from({ length: 25 }, (_, i) => `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-${String(i % 12 + 1).padStart(2, "0")}`);
  for (let i = 0; i < months.length; i += 5) {
    await Promise.all(months.slice(i, i + 5).map(async (m) => {
      await call("/entries", { method: "POST", token: A1, body: { charId: "char1", catName: "旧账", icon: "📌", pts: 1, desc: "", date: `${m}-15` } });
      await call("/monthly-settle", { method: "POST", token: A1, body: { month: m, char1Pts: 1, char2Pts: 0, mode: "reward" } });
    }));
  }
  const longHist = (await call("/history", { token: A1 })).data;
  check("history returns more than 24 rows (the goal and pet sum all of them)", longHist.length >= 30 && longHist.some((h) => h.month === "2010-01"), `got ${longHist.length} rows`);

  // --------------------------------------------------------- letters
  section("letters");
  const lt = await call("/letters", { method: "POST", token: A1, body: { charId: "char1", text: "写给你的情书", date: "2026-09-11T10:00:00.000Z" } });
  check("POST /letters → 201", lt.status === 201, `got ${lt.status}`);
  const letterId = lt.data.id;
  const ltList = await call("/letters", { token: A2 });
  const ltOne = ltList.data.find((x) => x.id === letterId);
  check("partner can read the letter", ltOne && ltOne.text === "写给你的情书");
  check("new letter starts unopened", ltOne.opened === false);
  check("letter timestamp stored verbatim (no tz shift)", ltOne.date === "2026-09-11T10:00:00.000Z", `got ${ltOne.date}`);
  await call(`/letters-id?id=${letterId}`, { method: "PUT", token: A2, body: { opened: true } });
  check("PUT marks letter opened", (await call("/letters", { token: A1 })).data.find((x) => x.id === letterId).opened === true);

  // ---------------------------------------------------------- photos
  section("photos (Storage-backed)");
  const ph = await call("/photos", { method: "POST", token: A1, body: { charId: "char1", image: PNG, caption: "第一次约会", date: "2026-08-01" } });
  check("POST /photos → 201", ph.status === 201, JSON.stringify(ph.data));
  const photoId = ph.data.id;
  const phList = await call("/photos", { token: A2 });
  const phOne = phList.data.find((x) => x.id === photoId);
  check("partner sees the photo", !!phOne && phOne.caption === "第一次约会");
  check("photo returns a signed URL, not base64", phOne.image.startsWith("http"), phOne.image.slice(0, 30));

  const imgRes = await fetch(phOne.image);
  const imgBuf = new Uint8Array(await imgRes.arrayBuffer());
  check("signed URL actually serves the image bytes", imgRes.status === 200 && imgBuf.length > 0 && imgBuf[0] === 0x89, `HTTP ${imgRes.status}, ${imgBuf.length}b`);

  const noImg = await call("/photos", { method: "POST", token: A1, body: { caption: "no image" } });
  check("POST /photos without image → 400", noImg.status === 400);

  // --------------------------------------------------------- avatar
  section("avatar");
  const av = await call("/auth-charimg", { method: "PUT", token: A1, body: { charImg: PNG } });
  check("PUT own avatar", av.status === 200 && av.data.success);
  check("avatar shows up in config", (await call("/config", { token: A2 })).data.charImg1 === PNG);
  const avPartner = await call("/auth-charimg", { method: "PUT", token: A1, body: { charImg: PNG, charId: "char2" } });
  check("either partner can set the other's avatar", avPartner.status === 200 && avPartner.data.charId === "char2");

  // ---------------------------------------------- isolation (full sweep)
  section("cross-couple isolation — every resource");
  const rB = await call("/auth-register", { method: "POST", body: { username: u("b1"), password: "Pass123!", charId: "char1" } });
  const B1 = rB.data.accessToken;
  usernames.push(u("b1"));

  for (const [label, path] of [
    ["entries", "/entries"], ["categories", "/categories"], ["rewards", "/rewards"],
    ["punishments", "/punishments"], ["shop", "/shop"], ["bag", "/bag"],
    ["bag-history", "/bag-history"], ["letters", "/letters"], ["photos", "/photos"],
    ["history", "/history"], ["decor", "/bag?type=decor"],
  ]) {
    const res = await call(path, { token: B1 });
    check(`other couple sees no ${label}`, Array.isArray(res.data) && res.data.length === 0, `got ${JSON.stringify(res.data).slice(0, 80)}`);
  }

  check("other couple cannot buy from A's shop", (await call(`/shop-buy?id=${shopId}`, { method: "POST", token: B1, body: {} })).status === 404);
  check("other couple cannot claim A's reward", (await call("/bag-claim", { method: "POST", token: B1, body: { rewardId } })).status === 404);
  check("other couple cannot use A's bag item", (await call(`/bag-use?id=${bagItemId}`, { method: "POST", token: B1, body: {} })).status === 404);
  check("other couple cannot read A's letter", (await call(`/letters-id?id=${letterId}`, { method: "PUT", token: B1, body: { opened: true } })).status === 404);
  check("other couple cannot delete A's photo", (await call(`/photos-id?id=${photoId}`, { method: "DELETE", token: B1 })).status === 404);
  check("A's photo survives the attempt", (await call("/photos", { token: A1 })).data.some((p) => p.id === photoId));

  // ------------------------------------------------------------ unauth
  section("unauthenticated access is refused everywhere");
  for (const [label, path, method] of [
    ["GET /entries", "/entries", "GET"], ["POST /entries", "/entries", "POST"],
    ["GET /rewards", "/rewards", "GET"], ["GET /shop", "/shop", "GET"],
    ["GET /bag", "/bag", "GET"], ["GET /letters", "/letters", "GET"],
    ["GET /photos", "/photos", "GET"], ["GET /history", "/history", "GET"],
    ["POST /monthly-settle", "/monthly-settle", "POST"], ["POST /decor-buy", "/decor-buy", "POST"],
  ]) {
    const res = await call(path, { method, body: method === "POST" ? {} : undefined });
    check(`${label} without a session → 401`, res.status === 401, `got ${res.status}`);
  }

  // ----------------------------------------------------------- cleanup
  section("delete paths");
  check("DELETE /photos/{id}", (await call(`/photos-id?id=${photoId}`, { method: "DELETE", token: A1 })).status === 200);
  check("photo is gone", !(await call("/photos", { token: A1 })).data.some((p) => p.id === photoId));
  check("DELETE /letters/{id}", (await call(`/letters-id?id=${letterId}`, { method: "DELETE", token: A1 })).status === 200);
  check("DELETE /shop/{id}", (await call(`/shop-id?id=${shopId}`, { method: "DELETE", token: A1 })).status === 200);
  check("DELETE /rewards/{id}", (await call(`/rewards-id?id=${rewardId}`, { method: "DELETE", token: A1 })).status === 200);
  check("DELETE /punishments/{id}", (await call(`/punishments-id?id=${punId}`, { method: "DELETE", token: A1 })).status === 200);

  console.log(`\n${"=".repeat(48)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log(`  failing:\n   - ${failures.join("\n   - ")}`);
  console.log(`${"=".repeat(48)}`);
  console.log(`\nthrowaway accounts: ${usernames.join(", ")}`);
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller, clientDate } from "../_shared/util.ts";

// 生日惊喜 — what one partner prepares for the other's birthday (CLAUDE.md §7.30).
//
// Like 周年悄悄话 (§7.258) this is a date the SERVER decides, because the
// phone's date is exactly what a curious birthday person would move forward.
// A surprise opens at 00:00 on the birthday in the time zone of the phone that
// sealed it.
//
//   GET  ?openOn=YYYY-MM-DD&tz=480
//        → { openOn, day, mine, theirs, teaser, moved }
//          day     the caller's own birthday has begun and not ended (server clock):
//                  the film waits for this, so a moved phone date cannot play it early
//          mine    what YOU prepared for this date, with openedAt as the receipt; or null
//          theirs  what your partner prepared for you — null until it has opened, and
//                  null in exactly the same way when nothing was prepared
//          teaser  your partner chose a wrapped box for the day before, and it is that day
//          moved   you have an unopened surprise on a date that is no longer their birthday
//   GET  ?list=1 → [{ openOn, opened }] what you have received, once open, newest first
//   PUT  { openOn, tz, letter, couponTitle, couponNote, couponIcon, photoIds, teaser, moveFrom? }
//        → seal / edit yours for your partner's birthday until it opens (409 after);
//          nothing in it deletes it
//   POST { openOn, date, month } → the birthday person has opened it: stamps opened_at
//        once and puts the coupon in their 背包 once, however often it is called

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = { letter: 800, title: 30, note: 80, icon: 16, photos: 12 };
const DAY = 86_400_000;
const SIGNED_URL_TTL = 60 * 60 * 4;

const opensAt = (openOn: string, tzMin: number) => Date.parse(`${openOn}T00:00:00Z`) - tzMin * 60_000;
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const clip = (v: unknown, n: number) => [...String(v ?? "").trim()].slice(0, n).join("");

function cleanTz(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(840, Math.max(-720, n)) : 480;
}

// Does `openOn` fall on this birthday ('MM-DD' or 'YYYY-MM-DD')? A 2/29
// birthday is celebrated on 2/28 in the three years without one — the same
// rule as the anniversary.
function isBirthday(openOn: string, bday: string | null | undefined): boolean {
  const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(bday || "");
  if (!m) return false;
  const [y, mm, dd] = openOn.split("-").map(Number);
  const bm = +m[1];
  let bd = +m[2];
  if (bm === 2 && bd === 29 && !leap(y)) bd = 28;
  return mm === bm && dd === bd;
}

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;
  if (!matchId || !charId) return json({ error: "not paired" }, 400);
  if (!["GET", "PUT", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  const partner = charId === "char1" ? "char2" : "char1";
  const url = new URL(req.url);
  const now = Date.now();

  const { data: all, error: readErr } = await admin.from("surprises").select("*").eq("match_id", matchId);
  if (readErr) return json({ error: readErr.message }, 500);
  const rows = all || [];

  if (req.method === "GET" && url.searchParams.get("list")) {
    return json(rows
      .filter((r) => r.from_char === partner && now >= opensAt(r.open_on, r.tz_min))
      .sort((a, b) => (a.open_on < b.open_on ? 1 : -1))
      .map((r) => ({ openOn: r.open_on, opened: !!r.opened_at })));
  }

  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  const openOn = String((req.method === "GET" ? url.searchParams.get("openOn") : body.openOn) || "");
  if (!DATE_RE.test(openOn) || isNaN(Date.parse(`${openOn}T00:00:00Z`))) {
    return json({ error: "openOn must be YYYY-MM-DD" }, 400);
  }
  const { data: cfg } = await admin.from("config").select("birthday_1, birthday_2").eq("match_id", matchId).maybeSingle();
  const bdayOf = (c: string) => (c === "char1" ? cfg?.birthday_1 : cfg?.birthday_2) || "";
  const mineRow = rows.find((r) => r.from_char === charId && r.open_on === openOn);
  const theirRow = rows.find((r) => r.from_char === partner && r.open_on === openOn);

  // Photos travel as ids; hand back short-lived signed URLs in the chosen order.
  async function photosFor(ids: string[]) {
    if (!ids?.length) return [];
    const { data } = await admin.from("photos").select("id, storage_path, caption, date")
      .eq("match_id", matchId).in("id", ids);
    const list = (data || []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    const signed = list.length
      ? (await admin.storage.from("photos").createSignedUrls(list.map((p) => p.storage_path), SIGNED_URL_TTL)).data || []
      : [];
    const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return list.map((p) => ({ id: p.id, image: byPath.get(p.storage_path) || "", caption: p.caption || "", date: p.date || "" }));
  }
  const shape = async (r: Record<string, unknown> | undefined) => r ? ({
    letter: r.letter, couponTitle: r.coupon_title, couponNote: r.coupon_note, couponIcon: r.coupon_icon,
    photoIds: r.photo_ids || [], teaser: r.teaser, openedAt: r.opened_at || null,
    photos: await photosFor((r.photo_ids as string[]) || []),
  }) : null;

  if (req.method === "GET") {
    const tz = cleanTz(url.searchParams.get("tz"));
    const theirsOpen = !!theirRow && now >= opensAt(openOn, theirRow.tz_min);
    // The birthday person's own day, by the server's clock. With a surprise
    // waiting, its sealed zone decides; otherwise the caller's zone.
    const start = opensAt(openOn, theirRow ? theirRow.tz_min : tz);
    const day = isBirthday(openOn, bdayOf(charId)) && now >= start && now < start + DAY;
    const teaser = !!theirRow && !!theirRow.teaser && !theirsOpen && now >= opensAt(openOn, theirRow.tz_min) - DAY;
    const moved = rows.find((r) => r.from_char === charId && r.open_on !== openOn && !r.opened_at &&
      now < opensAt(r.open_on, r.tz_min) && !isBirthday(r.open_on, bdayOf(partner)))?.open_on || "";
    return json({
      openOn, day, teaser, moved,
      mine: await shape(mineRow),
      theirs: theirsOpen ? await shape(theirRow) : null,
    });
  }

  if (req.method === "PUT") {
    if (!isBirthday(openOn, bdayOf(partner))) return json({ error: "not their birthday" }, 400);
    const tz = cleanTz(body.tz);
    // Once it has opened it has been delivered, like a posted letter.
    if (now >= opensAt(openOn, mineRow ? mineRow.tz_min : tz)) return json({ error: "already delivered" }, 409);
    if (opensAt(openOn, tz) - now > 400 * DAY) return json({ error: "too far ahead" }, 400);

    const letter = clip(body.letter, MAX.letter);
    const couponTitle = clip(body.couponTitle, MAX.title);
    const couponNote = couponTitle ? clip(body.couponNote, MAX.note) : "";
    const couponIcon = couponTitle ? clip(body.couponIcon, MAX.icon) : "";
    const wanted = [...new Set((Array.isArray(body.photoIds) ? body.photoIds : [])
      .map(String).filter((id: string) => UUID_RE.test(id)))].slice(0, MAX.photos) as string[];
    // only this couple's own photos
    const { data: ok } = wanted.length
      ? await admin.from("photos").select("id").eq("match_id", matchId).in("id", wanted)
      : { data: [] };
    const okIds = new Set((ok || []).map((p) => p.id));
    const photoIds = wanted.filter((id) => okIds.has(id));

    if (!letter && !couponTitle && !photoIds.length) {
      await admin.from("surprises").delete().eq("match_id", matchId).eq("from_char", charId).eq("open_on", openOn);
      return json({ success: true, deleted: true });
    }
    const { error } = await admin.from("surprises").upsert({
      match_id: matchId, from_char: charId, open_on: openOn, tz_min: tz,
      letter, coupon_title: couponTitle, coupon_note: couponNote, coupon_icon: couponIcon,
      photo_ids: photoIds, teaser: !!body.teaser, updated_at: new Date().toISOString(),
    }, { onConflict: "match_id,from_char,open_on" });
    if (error) return json({ error: error.message }, 500);
    // their birthday was edited after sealing: move it, as long as the old one hasn't opened
    const from = String(body.moveFrom || "");
    if (DATE_RE.test(from) && from !== openOn) {
      await admin.from("surprises").delete().eq("match_id", matchId).eq("from_char", charId)
        .eq("open_on", from).is("opened_at", null);
    }
    return json({ success: true, photoIds });
  }

  // POST — opened
  if (!theirRow || now < opensAt(openOn, theirRow.tz_min)) return json({ opened: false });
  // Claim the opening exactly once (the settle trick, §3.2): of two phones or
  // a double tap, only the update that still sees opened_at empty goes on.
  const { data: claimed, error: claimErr } = await admin.from("surprises")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", theirRow.id).is("opened_at", null).select("id");
  if (claimErr) return json({ error: claimErr.message }, 500);
  if (!claimed?.length) return json({ opened: true, coupon: false });
  if (theirRow.coupon_title) {
    const { today, month } = clientDate(body);
    const { error } = await admin.from("bag").insert({
      match_id: matchId, char: charId, item_name: theirRow.coupon_title, item_icon: theirRow.coupon_icon || "🎟️",
      pts_spent: 0, source_type: "gift", month, acquired_date: today, status: "active",
    });
    if (error) {
      // give the opening back so the next try can put the coupon in
      await admin.from("surprises").update({ opened_at: null }).eq("id", theirRow.id);
      return json({ error: error.message }, 500);
    }
  }
  return json({ opened: true, coupon: !!theirRow.coupon_title });
});

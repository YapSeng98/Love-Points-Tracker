import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

// 周年悄悄话 — one sealed line per partner per anniversary (CLAUDE.md §7.258).
//
// This is the one place the SERVER decides a date. Everywhere else the client
// date wins (§2), but here the client date is exactly what a curious partner
// would change. A note opens at 00:00 on its day in the time zone of the phone
// that WROTE it (tz_min, stored at sealing) — so a couple in one city gets it
// at their own midnight, and the reader's clock plays no part at all.
//
//   GET ?openOn=YYYY-MM-DD      → { openOn, mine, theirs, sealed, released }
//   PUT { openOn, text, tz }    → seal / edit your own note; "" deletes it
//
// `theirs` is "" until the partner's note has opened; `sealed` only says
// whether you have written one. Nothing reveals whether the partner has.

const MAX = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function opensAt(openOn: string, tzMin: number): number {
  return Date.parse(`${openOn}T00:00:00Z`) - tzMin * 60_000;
}

function cleanTz(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(840, Math.max(-720, n)) : 480;
}

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;
  if (!matchId || !charId) return json({ error: "not paired" }, 400);
  const partner = charId === "char1" ? "char2" : "char1";
  if (req.method !== "GET" && req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const body = req.method === "PUT" ? await req.json().catch(() => ({})) : {};
  const openOn = String(
    (req.method === "GET" ? new URL(req.url).searchParams.get("openOn") : body.openOn) || "",
  );
  if (!DATE_RE.test(openOn) || isNaN(Date.parse(`${openOn}T00:00:00Z`))) {
    return json({ error: "openOn must be YYYY-MM-DD" }, 400);
  }

  const { data: rows, error: readErr } = await admin
    .from("anniv_notes")
    .select("char, text, tz_min")
    .eq("match_id", matchId)
    .eq("open_on", openOn);
  if (readErr) return json({ error: readErr.message }, 500);
  const mineRow = (rows || []).find((r) => r.char === charId);
  const theirRow = (rows || []).find((r) => r.char === partner);

  if (req.method === "GET") {
    const theirsOpen = !!theirRow && Date.now() >= opensAt(openOn, theirRow.tz_min);
    return json({
      openOn,
      mine: mineRow?.text || "",
      sealed: !!mineRow,
      theirs: theirsOpen ? theirRow!.text : "",
      released: theirsOpen,
    });
  }

  if (req.method === "PUT") {
    const tz = cleanTz(body.tz);
    // Once your note has opened it has been delivered, like a posted letter:
    // no rewriting what the partner may already have read.
    const lockTz = mineRow ? mineRow.tz_min : tz;
    if (Date.now() >= opensAt(openOn, lockTz)) {
      return json({ error: "already delivered" }, 409);
    }
    const text = [...String(body.text ?? "").trim()].slice(0, MAX).join("");
    if (!text) {
      await admin.from("anniv_notes").delete()
        .eq("match_id", matchId).eq("char", charId).eq("open_on", openOn);
      return json({ success: true, text: "" });
    }
    const { error } = await admin.from("anniv_notes").upsert({
      match_id: matchId, char: charId, open_on: openOn, tz_min: tz, text,
      updated_at: new Date().toISOString(),
    }, { onConflict: "match_id,char,open_on" });
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, text });
  }

  return json({ error: "Method not allowed" }, 405);
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const body = await req.json().catch(() => ({}));
  const month = String(body.month || "");
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "bad month" }, 400);

  // Guard on whether there is anything left to settle, NOT on "has this
  // calendar month been settled before" — a couple may settle several rounds
  // in one month, while a partner's duplicate click still no-ops.
  const { data: pending, error: pendingErr } = await admin
    .from("entries")
    .select("id, points, char")
    .eq("match_id", matchId)
    .eq("month", month)
    .is("monthly_id", null);
  if (pendingErr) return json({ error: pendingErr.message }, 500);

  if (!pending || pending.length === 0) {
    return json({ success: true, alreadySettled: true });
  }

  // The totals in this request were added up on the caller's phone, from its
  // own copy of the entries; the archive below is the server's pending set.
  // If the two differ — the partner logged, edited or deleted an entry for
  // this month after that copy was taken — the history row would store a
  // total that leaves out entries it archives, and those points would be
  // gone without a trace. `seen` is what the phone counted, as
  // [id, points, char]; refuse unless it is exactly the pending set, and the
  // app refreshes and shows the new preview. (Older app builds don't send
  // it and keep the old behaviour.)
  if (Array.isArray(body.seen)) {
    const seen = new Map<string, unknown[]>();
    for (const s of body.seen) if (Array.isArray(s)) seen.set(String(s[0]), s);
    const same = seen.size === pending.length && pending.every((e) => {
      const s = seen.get(e.id);
      return !!s && (parseInt(String(s[1])) || 0) === (e.points || 0) &&
        String(s[2] || "char1") === (e.char || "char1");
    });
    if (!same) return json({ error: "stale", pending: pending.length, seen: seen.size }, 409);
  }

  const { data: settled, error: settleErr } = await admin
    .from("monthly")
    .insert({
      match_id: matchId,
      month,
      char1_pts: parseInt(body.char1Pts) || 0,
      char2_pts: parseInt(body.char2Pts) || 0,
      mode: body.mode || "reward",
      result_1: body.result1 || "",
      result_2: body.result2 || "",
    })
    .select("id")
    .single();
  if (settleErr || !settled) return json({ error: settleErr?.message || "settle failed" }, 500);

  // Archive exactly the entries counted as pending — and only those still
  // unsettled. Two settles of the same month at once (both partners pressing
  // 结算 together, or a double tap) both get past the check above; Postgres
  // serialises their UPDATEs on the row locks, so the second finds the rows
  // already archived and claims none. Undo that one rather than keep a second
  // history row counting the same month twice.
  const ids = pending.map((p) => p.id);
  const { data: archived, error: archiveErr } = await admin
    .from("entries")
    .update({ monthly_id: settled.id })
    .in("id", ids)
    .is("monthly_id", null)
    .select("id");
  const got = (archived || []).length;
  if (archiveErr || got !== ids.length) {
    // Detach first, so removing the row can never touch an entry.
    await admin.from("entries").update({ monthly_id: null }).eq("monthly_id", settled.id);
    await admin.from("monthly").delete().eq("id", settled.id);
    if (archiveErr) return json({ error: archiveErr.message }, 500);
    return got === 0
      ? json({ success: true, alreadySettled: true })
      : json({ error: "stale", pending: ids.length, archived: got }, 409);
  }

  // New round: milestone rewards become claimable again for both characters
  await admin
    .from("rewards")
    .update({ claimed_1: false, claimed_2: false, claimed_date_1: null, claimed_date_2: null })
    .eq("match_id", matchId);

  return json({ success: true, monthId: settled.id });
});

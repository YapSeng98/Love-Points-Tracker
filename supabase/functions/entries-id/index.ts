import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Not found" }, 404);

  const { data: existing } = await admin
    .from("entries")
    .select("id, monthly_id")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!existing) return json({ error: "Not found" }, 404);

  // A settled entry belongs to a history row whose totals were computed from
  // it. Changing or deleting it afterwards would leave that row disagreeing
  // with its own entries — and it happens for real when a partner's screen is
  // a few seconds behind a settle the other phone just did.
  if (existing.monthly_id && (req.method === "PUT" || req.method === "DELETE")) {
    return json({ error: "settled" }, 409);
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (body.catId !== undefined) patch.category_id = body.catId || null;
    if (body.catName !== undefined) patch.category_name = body.catName;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.pts !== undefined) patch.points = parseInt(body.pts);
    if (body.desc !== undefined) patch.note = body.desc;
    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return json({ error: "bad date" }, 400);
      // Moving an entry to another day moves it to that day's month, or a
      // 月末结算 (which archives by month) settles it with the wrong one.
      patch.date = body.date;
      patch.month = body.date.slice(0, 7);
    }
    if (body.charId !== undefined) patch.char = body.charId;
    const { error } = await admin.from("entries").update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    const { error } = await admin.from("entries").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});

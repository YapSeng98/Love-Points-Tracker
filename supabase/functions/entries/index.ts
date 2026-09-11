import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const year = new URL(req.url).searchParams.get("year") || "";

    // Default: every UNSETTLED entry, NEVER filtered by calendar month —
    // filtering by month here once silently hid a whole month of entries the
    // instant the month rolled over without a 月末结算 (CLAUDE.md §3).
    // ?year=YYYY is the 年度回顾 path: settled entries included.
    let q = admin
      .from("entries")
      .select("id, category_id, category_name, icon, points, note, char, month, date")
      .eq("match_id", matchId);

    if (/^\d{4}$/.test(year)) {
      q = q.like("month", `${year}%`).limit(2000);
    } else {
      q = q.is("monthly_id", null);
    }

    // date has no time part, so same-day entries tie — break by creation time
    const { data } = await q.order("date", { ascending: false }).order("created_at", { ascending: false });

    return json((data || []).map((e) => ({
      id: e.id,
      catId: e.category_id,
      catName: e.category_name,
      icon: e.icon,
      pts: e.points,
      desc: e.note,
      charId: e.char || "char1",
      month: e.month,
      date: e.date,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const pts = parseInt(body.pts) || 0;
    // Dates are client-authoritative (CLAUDE.md §2) — the server clock is in
    // a timezone behind the users, so only fall back to it if absent.
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("entries")
      .insert({
        match_id: matchId,
        char: body.charId || "char1",
        category_id: body.catId || null,
        category_name: body.catName || "",
        category_pts: pts,
        icon: body.icon || "",
        points: pts,
        note: body.desc || "",
        month: body.month || "",
        date: body.date || today,
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: error?.message || "insert failed" }, 500);
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

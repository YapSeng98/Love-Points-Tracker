import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const { data } = await admin
      .from("rewards")
      .select("id, emoji, name, points, description, claimed_1, claimed_2, claimed_date_1, claimed_date_2")
      .eq("match_id", matchId)
      .order("points");
    // Claims are per-character so each partner claims every reward once.
    // `claimed` = either, kept for cached older frontends.
    return json((data || []).map((r) => ({
      id: r.id,
      icon: r.emoji,
      name: r.name,
      minPts: r.points,
      desc: r.description,
      claimed1: r.claimed_1,
      claimed2: r.claimed_2,
      claimedDate1: r.claimed_date_1 || "",
      claimedDate2: r.claimed_date_2 || "",
      claimed: r.claimed_1 || r.claimed_2,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const { data, error } = await admin
      .from("rewards")
      .insert({
        match_id: matchId,
        emoji: body.icon || "",
        name: body.name || "",
        points: parseInt(body.minPts) || 0,
        description: body.desc || "",
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: error?.message || "insert failed" }, 500);
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

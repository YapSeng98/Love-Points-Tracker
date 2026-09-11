import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const { data } = await admin
      .from("categories")
      .select("id, emoji, name, points, active")
      .eq("match_id", matchId)
      .order("name");
    return json((data || []).map((c) => ({
      id: c.id,
      icon: c.emoji,
      name: c.name,
      pts: c.points,
      active: c.active,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const { data, error } = await admin
      .from("categories")
      .insert({
        match_id: matchId,
        emoji: body.icon || "",
        name: body.name || "",
        points: parseInt(body.pts) || 0,
        active: body.active !== false,
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: error?.message || "insert failed" }, 500);
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const { data } = await admin
      .from("punishments")
      .select("id, emoji, name, points, description")
      .eq("match_id", matchId)
      .order("points");
    return json((data || []).map((p) => ({
      id: p.id,
      icon: p.emoji,
      name: p.name,
      minPts: p.points,
      desc: p.description,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const { data, error } = await admin
      .from("punishments")
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

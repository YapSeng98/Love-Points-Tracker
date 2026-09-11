import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const { data } = await admin
      .from("shop")
      .select("id, icon, name, description, pts_cost, active")
      .eq("match_id", matchId)
      .order("pts_cost");
    return json((data || []).map((s) => ({
      id: s.id,
      icon: s.icon || "",
      name: s.name || "",
      desc: s.description || "",
      ptsCost: s.pts_cost || 0,
      active: s.active,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const { data, error } = await admin
      .from("shop")
      .insert({
        match_id: matchId,
        icon: body.icon || "",
        name: body.name || "",
        description: body.desc || "",
        pts_cost: parseInt(body.ptsCost) || 0,
        active: body.active !== false,
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: error?.message || "insert failed" }, 500);
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

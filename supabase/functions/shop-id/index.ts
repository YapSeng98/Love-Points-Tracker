import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Not found" }, 404);

  const { data: existing } = await admin
    .from("shop")
    .select("id")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!existing) return json({ error: "Not found" }, 404);

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.name !== undefined) patch.name = body.name;
    if (body.desc !== undefined) patch.description = body.desc;
    if (body.ptsCost !== undefined) patch.pts_cost = parseInt(body.ptsCost);
    if (body.active !== undefined) patch.active = body.active;
    const { error } = await admin.from("shop").update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    const { error } = await admin.from("shop").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});

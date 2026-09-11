import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Not found" }, 404);

  // Ownership check before mutating — a row from another couple must 404,
  // never be touched (mirrors the u_match check in the SN resources).
  const { data: existing } = await admin
    .from("categories")
    .select("id")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!existing) return json({ error: "Not found" }, 404);

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (body.icon !== undefined) patch.emoji = body.icon;
    if (body.name !== undefined) patch.name = body.name;
    if (body.pts !== undefined) patch.points = parseInt(body.pts);
    if (body.active !== undefined) patch.active = body.active;
    const { error } = await admin.from("categories").update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    const { error } = await admin.from("categories").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});

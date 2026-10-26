import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Not found" }, 404);

  const { data: existing } = await admin
    .from("letters")
    .select("id, char")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!existing) return json({ error: "Not found" }, 404);

  // A letter is posted, not shared: only its writer rewrites or deletes it,
  // and only the other one opens it — or a writer could use up their partner's 未拆.
  const mine = (existing.char || "char1") === caller.charId;

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    if (body.text !== undefined && !mine) return json({ error: "not yours" }, 403);
    if (body.opened !== undefined && mine) return json({ error: "your own letter" }, 403);
    const patch: Record<string, unknown> = {};
    if (body.opened !== undefined) patch.opened = body.opened === true;
    if (body.text !== undefined) patch.text = body.text;
    const { error } = await admin.from("letters").update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    if (!mine) return json({ error: "not yours" }, 403);
    const { error } = await admin.from("letters").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});

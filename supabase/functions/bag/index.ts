import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;

  const decorOnly = new URL(req.url).searchParams.get("type") === "decor";

  let q = admin
    .from("bag")
    .select("id, shop_item_id, decor_item_id, char, item_name, item_icon, pts_spent, source_type, month, acquired_date")
    .eq("match_id", matchId)
    .eq("status", "active");

  if (decorOnly) {
    // The room is shared: a sofa one partner bought must be placeable by the
    // other, so decor is deliberately NOT filtered by character.
    q = q.eq("source_type", "decor");
  } else {
    q = q.eq("char", charId).neq("source_type", "decor");
  }

  const { data } = await q.order("acquired_date", { ascending: false });

  return json((data || []).map((b) => ({
    id: b.id,
    // decor rows carry a catalog id, purchases carry the shop row id
    itemId: b.decor_item_id || b.shop_item_id || "",
    owner: b.char || "",
    itemName: b.item_name || "",
    itemIcon: b.item_icon || "",
    ptsSpent: b.pts_spent || 0,
    sourceType: b.source_type || "",
    month: b.month || "",
    acquiredDate: b.acquired_date || "",
  })));
});

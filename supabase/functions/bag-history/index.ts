import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;

  const { data } = await admin
    .from("bag")
    .select("id, item_name, item_icon, pts_spent, source_type, month, acquired_date, used_date")
    .eq("match_id", matchId)
    .eq("char", charId)
    .eq("status", "used")
    .order("used_date", { ascending: false });

  return json((data || []).map((b) => ({
    id: b.id,
    itemName: b.item_name || "",
    itemIcon: b.item_icon || "",
    ptsSpent: b.pts_spent || 0,
    sourceType: b.source_type || "",
    month: b.month || "",
    acquiredDate: b.acquired_date || "",
    usedDate: b.used_date || "",
  })));
});

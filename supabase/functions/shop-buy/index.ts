import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller, unsettledScore, clientDate } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const id = new URL(req.url).searchParams.get("id") || "";
  const { data: item } = await admin
    .from("shop")
    .select("id, name, icon, pts_cost")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!item) return json({ error: "Not found" }, 404);

  const ptsCost = item.pts_cost || 0;
  const body = await req.json().catch(() => ({}));
  const { today, month } = clientDate(body);

  const currentScore = await unsettledScore(admin, matchId, charId!);
  if (currentScore < ptsCost) {
    return json({ error: "insufficient_points", currentScore, required: ptsCost }, 400);
  }

  // Deduct points via a negative score entry
  await admin.from("entries").insert({
    match_id: matchId,
    char: charId,
    category_id: null,
    category_name: "🛒 商店兑换",
    category_pts: -ptsCost,
    icon: item.icon || "",
    points: -ptsCost,
    note: "兑换：" + (item.name || ""),
    month,
    date: today,
  });

  const { data: bagRow, error } = await admin
    .from("bag")
    .insert({
      match_id: matchId,
      char: charId,
      item_name: item.name || "",
      item_icon: item.icon || "",
      pts_spent: ptsCost,
      source_type: "purchase",
      shop_item_id: item.id,
      month,
      acquired_date: today,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !bagRow) return json({ error: error?.message || "buy failed" }, 500);

  return json({ success: true, bagItemId: bagRow.id, newScore: currentScore - ptsCost }, 201);
});

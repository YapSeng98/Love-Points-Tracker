import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller, unsettledScore, clientDate } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const body = await req.json().catch(() => ({}));
  const rewardId = body.rewardId;
  if (!rewardId) return json({ error: "rewardId required" }, 400);

  // charId may name the partner — same acting-for-partner convention as entries
  const charId = (body.charId === "char1" || body.charId === "char2") ? body.charId : caller.charId!;
  const claimedField = charId === "char2" ? "claimed_2" : "claimed_1";
  const dateField = charId === "char2" ? "claimed_date_2" : "claimed_date_1";

  const { data: reward } = await admin
    .from("rewards")
    .select("id, name, emoji, points, claimed_1, claimed_2")
    .eq("id", rewardId)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!reward) return json({ error: "Reward not found" }, 404);

  // Claims are per character — each partner claims every reward once per round
  if (reward[claimedField as "claimed_1" | "claimed_2"]) {
    return json({ error: "already_claimed" }, 400);
  }

  const { today, month } = clientDate(body);

  const currentScore = await unsettledScore(admin, matchId, charId);
  if (currentScore < (reward.points || 0)) {
    return json({ error: "score_not_reached", currentScore, required: reward.points || 0 }, 400);
  }

  await admin
    .from("rewards")
    .update({ [claimedField]: true, [dateField]: today })
    .eq("id", rewardId);

  const { data: bagRow, error } = await admin
    .from("bag")
    .insert({
      match_id: matchId,
      char: charId,
      item_name: reward.name || "",
      item_icon: reward.emoji || "",
      pts_spent: 0,
      source_type: "reward",
      shop_item_id: null,
      month,
      acquired_date: today,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !bagRow) return json({ error: error?.message || "claim failed" }, 500);

  return json({ success: true, bagItemId: bagRow.id }, 201);
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const body = await req.json().catch(() => ({}));
  const month = body.month || "";

  // Guard on whether there is anything left to settle, NOT on "has this
  // calendar month been settled before" — a couple may settle several rounds
  // in one month, while a partner's duplicate click still no-ops.
  const { data: pending } = await admin
    .from("entries")
    .select("id")
    .eq("match_id", matchId)
    .eq("month", month)
    .is("monthly_id", null);

  if (!pending || pending.length === 0) {
    return json({ success: true, alreadySettled: true });
  }

  const { data: settled, error: settleErr } = await admin
    .from("monthly")
    .insert({
      match_id: matchId,
      month,
      char1_pts: parseInt(body.char1Pts) || 0,
      char2_pts: parseInt(body.char2Pts) || 0,
      mode: body.mode || "reward",
      result_1: body.result1 || "",
      result_2: body.result2 || "",
    })
    .select("id")
    .single();
  if (settleErr || !settled) return json({ error: settleErr?.message || "settle failed" }, 500);

  // Archive exactly the entries counted as pending
  const { error: archiveErr } = await admin
    .from("entries")
    .update({ monthly_id: settled.id })
    .in("id", pending.map((p) => p.id));
  if (archiveErr) return json({ error: archiveErr.message }, 500);

  // New round: milestone rewards become claimable again for both characters
  await admin
    .from("rewards")
    .update({ claimed_1: false, claimed_2: false, claimed_date_1: null, claimed_date_2: null })
    .eq("match_id", matchId);

  return json({ success: true, monthId: settled.id });
});

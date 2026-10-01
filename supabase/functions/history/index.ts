import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  // No 24-row cap: the shared goal, the pet's EXP (and so 小窝币) and
  // 年度回顾 all sum EVERY settled month from this list. A cap would quietly
  // shrink the goal and stall the pet once the couple passed two years of
  // settlements. Rows are ~100 bytes.
  const { data } = await admin
    .from("monthly")
    .select("month, char1_pts, char2_pts, mode, result_1, result_2, settled_at")
    .eq("match_id", matchId)
    .order("month", { ascending: false })
    .order("settled_at", { ascending: false })
    .limit(1000);

  return json((data || []).map((m) => ({
    month: m.month,
    char1Pts: m.char1_pts,
    char2Pts: m.char2_pts,
    mode: m.mode,
    result1: m.result_1,
    result2: m.result_2,
    settledAt: m.settled_at,
  })));
});

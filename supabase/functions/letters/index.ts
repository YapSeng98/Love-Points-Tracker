import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    const { data } = await admin
      .from("letters")
      .select("id, char, text, date, opened")
      .eq("match_id", matchId)
      .order("date")
      .limit(500);
    return json((data || []).map((l) => ({
      id: l.id,
      charId: l.char || "char1",
      text: l.text,
      date: l.date,
      opened: l.opened,
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    const { data, error } = await admin
      .from("letters")
      .insert({
        match_id: matchId,
        char: body.charId || "char1",
        text: body.text || "",
        // stored verbatim as the client's ISO string so no timezone
        // conversion can shift it (CLAUDE.md §2)
        date: body.date || new Date().toISOString(),
        opened: body.opened === true,
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: error?.message || "insert failed" }, 500);
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller, clientDate } from "../_shared/util.ts";

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  // A bag item belongs to one character — the partner must not be able to use it
  const { data: item } = await admin
    .from("bag")
    .select("id, status")
    .eq("id", id)
    .eq("match_id", matchId)
    .eq("char", charId)
    .maybeSingle();
  if (!item) return json({ error: "Not found" }, 404);
  if (item.status !== "active") return json({ error: "already_used" }, 400);

  const body = await req.json().catch(() => ({}));
  const { today } = clientDate(body);

  const { error } = await admin
    .from("bag")
    .update({ status: "used", used_date: today })
    .eq("id", id);
  if (error) return json({ error: error.message }, 500);

  return json({ success: true });
});

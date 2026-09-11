import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

// Body: { charImg, charId? } — charId optional, so either partner can set
// both avatars. Omitted → the caller's own.
serve(async (req) => {
  if (req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const body = await req.json().catch(() => ({}));
  const imgData = body.charImg || "";
  const charId = body.charId || "";

  if (charId && matchId) {
    const { data: target } = await admin
      .from("profiles")
      .select("id")
      .eq("match_id", matchId)
      .eq("char_id", charId)
      .maybeSingle();
    // Partner hasn't registered yet — report it rather than silently
    // writing the picture onto the caller's own row.
    if (!target) return json({ error: "partner_not_found", charId }, 404);

    const { error } = await admin.from("profiles").update({ profile_picture: imgData }).eq("id", target.id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, charId });
  }

  const { error } = await admin.from("profiles").update({ profile_picture: imgData }).eq("id", caller.userId);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
});

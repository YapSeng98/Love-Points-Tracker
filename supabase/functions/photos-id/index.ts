import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

const BUCKET = "photos";

serve(async (req) => {
  if (req.method !== "DELETE") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Not found" }, 404);

  const { data: existing } = await admin
    .from("photos")
    .select("id, storage_path")
    .eq("id", id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (!existing) return json({ error: "Not found" }, 404);

  const { error } = await admin.from("photos").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500);

  // Row is gone either way; a failed object delete would only leave an
  // orphaned file, so it must not fail the request.
  if (existing.storage_path) {
    await admin.storage.from(BUCKET).remove([existing.storage_path]);
  }

  return json({ success: true });
});

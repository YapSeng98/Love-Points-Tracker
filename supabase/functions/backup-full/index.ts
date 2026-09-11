import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

const BUCKET = "photos";
const SIGNED_URL_TTL = 60 * 30; // long enough for the backup to download them

// Everything the couple owns, in one call. This is the Supabase counterpart
// of the ServiceNow r41 resource that was written but never deployed — and
// the point of it is the bag: /bag filters to the CALLER's own rows, so a
// backup taken through the normal endpoints silently missed whichever
// partner wasn't logged in. That gap is exactly what forced YY's items to be
// re-typed by hand during the migration. Here the bag query deliberately
// does NOT filter by character, so either partner's login backs up both.
//
// Still couple-scoped: everything is bounded by the caller's own match_id,
// so this can never reach another couple's data.
serve(async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const all = (t: string, cols = "*") =>
    admin.from(t).select(cols).eq("match_id", matchId);

  const [
    match, profiles, config, categories, rewards, punishments,
    shop, monthly, entries, letters, photos, bag,
  ] = await Promise.all([
    admin.from("matches").select("*").eq("id", matchId).maybeSingle(),
    admin.from("profiles").select("id, match_id, char_id, username, profile_picture, last_login, created_at").eq("match_id", matchId),
    all("config").maybeSingle(),
    all("categories").order("name"),
    all("rewards").order("points"),
    all("punishments").order("points"),
    all("shop").order("pts_cost"),
    all("monthly").order("month", { ascending: false }),
    // every entry ever, settled included — no cap, unlike GET /entries
    all("entries").order("date", { ascending: false }),
    all("letters").order("date"),
    all("photos").order("date"),
    all("bag").order("acquired_date", { ascending: false }),
  ]);

  // Photos live in Storage now, so hand back a short-lived URL per row and
  // let the backup script pull the bytes down into the snapshot. A backup
  // holding only URLs would expire into uselessness.
  const photoRows = photos.data || [];
  const paths = photoRows.map((p: Record<string, string>) => p.storage_path).filter(Boolean);
  const signed = paths.length
    ? (await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)).data || []
    : [];
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return json({
    meta: {
      generatedAt: new Date().toISOString(),
      source: "supabase",
      project: Deno.env.get("SUPABASE_URL"),
      matchId,
    },
    match: match.data || null,
    profiles: profiles.data || [],
    config: config.data || null,
    categories: categories.data || [],
    rewards: rewards.data || [],
    punishments: punishments.data || [],
    shop: shop.data || [],
    monthly: monthly.data || [],
    entries: entries.data || [],
    letters: letters.data || [],
    photos: photoRows.map((p: Record<string, string>) => ({ ...p, downloadUrl: urlByPath.get(p.storage_path) || "" })),
    bag: bag.data || [],   // BOTH partners
  });
});

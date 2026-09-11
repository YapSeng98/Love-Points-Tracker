import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

const BUCKET = "photos";
const SIGNED_URL_TTL = 60 * 60 * 4; // 4h — long enough for a slideshow session

function decodeDataUri(dataUri: string): { bytes: Uint8Array; contentType: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: m[1] };
}

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    // oldest first — the album reads as a story (matches r37)
    const { data } = await admin
      .from("photos")
      .select("id, char, storage_path, caption, date")
      .eq("match_id", matchId)
      .order("date")
      .limit(100);

    const rows = data || [];
    // The image itself lives in Storage now; hand back a signed URL in the
    // same `image` field the old base64 API used, so the client can still
    // just drop it into an <img src>.
    const paths = rows.map((p) => p.storage_path);
    const signed = paths.length
      ? (await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)).data || []
      : [];
    const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

    return json(rows.map((p) => ({
      id: p.id,
      charId: p.char || "char1",
      image: urlByPath.get(p.storage_path) || "",
      caption: p.caption || "",
      date: p.date || "",
    })));
  }

  if (req.method === "POST") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));
    if (!body.image) return json({ error: "image required" }, 400);

    const decoded = decodeDataUri(body.image);
    if (!decoded) return json({ error: "image must be a base64 data URI" }, 400);

    const ext = decoded.contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const path = `${matchId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
    if (upErr) return json({ error: "upload failed: " + upErr.message }, 500);

    const { data, error } = await admin
      .from("photos")
      .insert({
        match_id: matchId,
        char: body.charId || caller.charId || "char1",
        storage_path: path,
        caption: body.caption || "",
        date: body.date || new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) {
      // don't leave an orphaned object behind if the row insert failed
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: error?.message || "insert failed" }, 500);
    }
    return json({ id: data.id, success: true }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
});

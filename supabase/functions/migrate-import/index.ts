// ONE-OFF ServiceNow → Supabase importer. Gated behind MIGRATION_SECRET so
// holding the publishable key is not enough to call it. Delete this function
// once the cutover is done.
import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, adminClient, emailForUsername, randomPairCode } from "../_shared/util.ts";

const BUCKET = "photos";

function decodeDataUri(dataUri: string): { bytes: Uint8Array; contentType: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: m[1] };
}

// ServiceNow allowed an empty u_char on legacy rows; r28/r32 treat empty as
// char1, so the import has to make the same call or those points go missing.
const ch = (v: unknown) => (v === "char2" ? "char2" : "char1");

serve(async (req) => {
  if (req.headers.get("x-migration-secret") !== Deno.env.get("MIGRATION_SECRET")) {
    return json({ error: "forbidden" }, 403);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const admin = adminClient();
  const op = body.op;

  // ---------------------------------------------------------------- reset
  // Wipes the couple entirely so a trial import can be re-run from scratch.
  if (op === "reset") {
    const { data: profiles } = await admin.from("profiles").select("id, match_id").in("username", body.usernames || []);
    const matchIds = [...new Set((profiles || []).map((p) => p.match_id).filter(Boolean))];
    for (const mid of matchIds) {
      const { data: ph } = await admin.from("photos").select("storage_path").eq("match_id", mid);
      const paths = (ph || []).map((p) => p.storage_path).filter(Boolean);
      if (paths.length) await admin.storage.from(BUCKET).remove(paths);
      for (const t of ["entries", "photos", "letters", "bag", "monthly", "categories", "rewards", "punishments", "shop", "config"]) {
        await admin.from(t).delete().eq("match_id", mid);
      }
    }
    for (const p of profiles || []) await admin.auth.admin.deleteUser(p.id);
    for (const mid of matchIds) await admin.from("matches").delete().eq("id", mid);
    return json({ success: true, wiped: matchIds.length });
  }

  // ------------------------------------------------------------- accounts
  if (op === "accounts") {
    const pairCode = randomPairCode();
    const { data: match, error: mErr } = await admin
      .from("matches")
      .insert({ pair_code: pairCode, couple_name: `${body.char1.username}_${body.char2.username}` })
      .select("id")
      .single();
    if (mErr || !match) return json({ error: mErr?.message }, 500);

    const out: Record<string, unknown> = { matchId: match.id, pairCode };
    for (const slot of ["char1", "char2"] as const) {
      const who = body[slot];
      if (!who) continue;
      const email = emailForUsername(who.username);
      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email, password: who.password, email_confirm: true,
      });
      if (uErr || !u.user) return json({ error: `${slot}: ${uErr?.message}` }, 500);
      const { error: pErr } = await admin.from("profiles").insert({
        id: u.user.id, match_id: match.id, char_id: slot, username: who.username,
      });
      if (pErr) return json({ error: `${slot} profile: ${pErr.message}` }, 500);
      out[slot] = { userId: u.user.id, username: who.username };
    }
    return json({ success: true, ...out });
  }

  // ----------------------------------------------------------------- core
  if (op === "core") {
    const matchId = body.matchId;
    const counts: Record<string, number> = {};
    const c = body.config || {};

    await admin.from("config").insert({
      match_id: matchId,
      mode: c.mode || "reward",
      reward_target: c.rewardTarget ?? 100,
      punish_threshold: c.punishThreshold ?? -80,
      start_date: c.startDate || null,
      char1_name: c.char1Name || null,
      char2_name: c.char2Name || null,
      goal_name: c.goalName || null,
      goal_icon: c.goalIcon || null,
      goal_target: c.goalTarget ?? 0,
      pet_name: c.petName || null,
      pet_species: c.petSpecies || null,
      pet_equipped: c.petEquipped || null,
      pet_exp: c.petExp ?? 0,
      pet_base: c.petBase ?? 0,
      wx_1: c.wx1 || null,
      wx_2: c.wx2 || null,
    });
    counts.config = 1;

    // avatars live on the profile rows, not config
    if (c.charImg1) await admin.from("profiles").update({ profile_picture: c.charImg1 }).eq("match_id", matchId).eq("char_id", "char1");
    if (c.charImg2) await admin.from("profiles").update({ profile_picture: c.charImg2 }).eq("match_id", matchId).eq("char_id", "char2");

    // --- categories (build old sys_id → new uuid map for entries) ---
    const catMap: Record<string, string> = {};
    for (const cat of body.categories || []) {
      const { data } = await admin.from("categories").insert({
        match_id: matchId, emoji: cat.icon || "", name: cat.name || "",
        points: cat.pts ?? 0, active: cat.active !== false,
      }).select("id").single();
      if (data) catMap[cat.id] = data.id;
    }
    counts.categories = Object.keys(catMap).length;

    // --- shop (old sys_id → new uuid, for bag purchase rows) ---
    const shopMap: Record<string, string> = {};
    for (const s of body.shop || []) {
      const { data } = await admin.from("shop").insert({
        match_id: matchId, icon: s.icon || "", name: s.name || "",
        description: s.desc || "", pts_cost: s.ptsCost ?? 0, active: s.active !== false,
      }).select("id").single();
      if (data) shopMap[s.id] = data.id;
    }
    counts.shop = Object.keys(shopMap).length;

    for (const r of body.rewards || []) {
      await admin.from("rewards").insert({
        match_id: matchId, emoji: r.icon || "", name: r.name || "",
        points: r.minPts ?? 0, description: r.desc || "",
        // legacy shared `claimed` reconstructed per-character by the caller
        claimed_1: !!r.claimed1, claimed_2: !!r.claimed2,
        claimed_date_1: r.claimedDate1 || null, claimed_date_2: r.claimedDate2 || null,
      });
    }
    counts.rewards = (body.rewards || []).length;

    for (const p of body.punishments || []) {
      await admin.from("punishments").insert({
        match_id: matchId, emoji: p.icon || "", name: p.name || "",
        points: p.minPts ?? 0, description: p.desc || "",
      });
    }
    counts.punishments = (body.punishments || []).length;

    // --- settled months: month string is the join key back to entries ---
    const monthMap: Record<string, string> = {};
    for (const h of body.history || []) {
      const { data } = await admin.from("monthly").insert({
        match_id: matchId, month: h.month, char1_pts: h.char1Pts ?? 0,
        char2_pts: h.char2Pts ?? 0, mode: h.mode || "reward",
        result_1: h.result1 || "", result_2: h.result2 || "",
        settled_at: h.settledAt || new Date().toISOString(),
      }).select("id").single();
      if (data) monthMap[h.month] = data.id;
    }
    counts.monthly = Object.keys(monthMap).length;

    // --- entries. `settled` is computed by the caller as
    // (all entries for the year) minus (entries /entries still returns).
    // A settled entry whose month has no history row still must not come
    // back from /entries, so it gets a placeholder monthly row.
    const entryRows = [];
    for (const e of body.entries || []) {
      let monthlyId: string | null = null;
      if (e.settled) {
        if (!monthMap[e.month]) {
          const { data } = await admin.from("monthly").insert({
            match_id: matchId, month: e.month, mode: "reward",
            result_1: "", result_2: "",
          }).select("id").single();
          if (data) monthMap[e.month] = data.id;
        }
        monthlyId = monthMap[e.month] || null;
      }
      entryRows.push({
        match_id: matchId,
        char: ch(e.charId),
        category_id: catMap[e.catId] || null,
        category_name: e.catName || "",
        category_pts: e.pts ?? 0,
        icon: e.icon || "",
        points: e.pts ?? 0,
        note: e.desc || "",
        month: e.month || "",
        date: e.date,
        monthly_id: monthlyId,
      });
    }
    for (let i = 0; i < entryRows.length; i += 200) {
      const { error } = await admin.from("entries").insert(entryRows.slice(i, i + 200));
      if (error) return json({ error: "entries: " + error.message, counts }, 500);
    }
    counts.entries = entryRows.length;

    const letterRows = (body.letters || []).map((l: Record<string, unknown>) => ({
      match_id: matchId, char: ch(l.charId), text: (l.text as string) || "",
      date: (l.date as string) || new Date().toISOString(), opened: !!l.opened,
    }));
    if (letterRows.length) {
      const { error } = await admin.from("letters").insert(letterRows);
      if (error) return json({ error: "letters: " + error.message, counts }, 500);
    }
    counts.letters = letterRows.length;

    // --- bag: purchases/rewards per person, plus the shared decor rows ---
    const bagRows = (body.bag || []).map((b: Record<string, unknown>) => {
      const isDecor = b.sourceType === "decor";
      return {
        match_id: matchId,
        char: ch(b.owner || b.charId),
        item_name: (b.itemName as string) || "",
        item_icon: (b.itemIcon as string) || "",
        pts_spent: (b.ptsSpent as number) ?? 0,
        source_type: (b.sourceType as string) || "purchase",
        // decor keeps its catalog id; purchases map onto the new shop row
        decor_item_id: isDecor ? ((b.itemId as string) || null) : null,
        shop_item_id: !isDecor && b.itemId ? (shopMap[b.itemId as string] || null) : null,
        month: (b.month as string) || "",
        acquired_date: (b.acquiredDate as string) || null,
        used_date: (b.usedDate as string) || null,
        status: b.usedDate ? "used" : "active",
      };
    });
    if (bagRows.length) {
      const { error } = await admin.from("bag").insert(bagRows);
      if (error) return json({ error: "bag: " + error.message, counts }, 500);
    }
    counts.bag = bagRows.length;

    return json({ success: true, counts });
  }

  // ---------------------------------------------------------------- photo
  if (op === "photo") {
    const p = body.photo || {};
    const decoded = decodeDataUri(p.image || "");
    if (!decoded) return json({ error: "bad image data uri" }, 400);
    const ext = decoded.contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const path = `${body.matchId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
    if (upErr) return json({ error: "upload: " + upErr.message }, 500);
    const { error } = await admin.from("photos").insert({
      match_id: body.matchId, char: ch(p.charId), storage_path: path,
      caption: p.caption || "", date: p.date || null,
    });
    if (error) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: error.message }, 500);
    }
    return json({ success: true, bytes: decoded.bytes.length });
  }

  return json({ error: "unknown op" }, 400);
});

import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

serve(async (req) => {
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;

  if (req.method === "GET") {
    let char1Name = "", char2Name = "", charImg1 = "", charImg2 = "";
    if (matchId) {
      const { data: names } = await admin
        .from("profiles")
        .select("char_id, username, profile_picture")
        .eq("match_id", matchId);
      for (const n of names || []) {
        if (n.char_id === "char1") { char1Name = n.username || ""; charImg1 = n.profile_picture || ""; }
        else { char2Name = n.username || ""; charImg2 = n.profile_picture || ""; }
      }
    }

    const { data: cfg } = matchId
      ? await admin.from("config").select("*").eq("match_id", matchId).maybeSingle()
      : { data: null };

    if (cfg) {
      return json({
        configured: true,
        mode: cfg.mode || "reward",
        rewardTarget: cfg.reward_target ?? 100,
        punishThreshold: cfg.punish_threshold ?? -80,
        startDate: cfg.start_date || "",
        char1Name: cfg.char1_name || char1Name,
        char2Name: cfg.char2_name || char2Name,
        charImg1,
        charImg2,
        goalName: cfg.goal_name || "",
        goalIcon: cfg.goal_icon || "",
        goalTarget: cfg.goal_target ?? 0,
        petName: cfg.pet_name || "",
        petSpecies: cfg.pet_species || "",
        petEquipped: cfg.pet_equipped || "",
        petExp: cfg.pet_exp ?? 0,
        petBase: cfg.pet_base ?? 0,
        wx1: cfg.wx_1 || "",
        wx2: cfg.wx_2 || "",
      });
    }
    return json({ configured: false, startDate: "", char1Name, char2Name, charImg1, charImg2 });
  }

  if (req.method === "PUT") {
    if (!matchId) return json({ error: "not paired" }, 400);
    const body = await req.json().catch(() => ({}));

    const { data: existingCfg } = await admin.from("config").select("*").eq("match_id", matchId).maybeSingle();

    const patch: Record<string, unknown> = {};
    if (body.mode !== undefined) patch.mode = body.mode;
    if (body.rewardTarget !== undefined) patch.reward_target = body.rewardTarget;
    if (body.punishThreshold !== undefined) patch.punish_threshold = body.punishThreshold;
    if (body.startDate !== undefined) patch.start_date = body.startDate;
    if (body.charName1 !== undefined) patch.char1_name = body.charName1;
    if (body.charName2 !== undefined) patch.char2_name = body.charName2;
    if (body.goalName !== undefined) patch.goal_name = body.goalName;
    if (body.goalIcon !== undefined) patch.goal_icon = body.goalIcon;
    if (body.goalTarget !== undefined) patch.goal_target = parseInt(body.goalTarget) || 0;
    if (body.petName !== undefined) patch.pet_name = body.petName;
    if (body.petSpecies !== undefined) patch.pet_species = body.petSpecies;
    if (body.petEquipped !== undefined) patch.pet_equipped = body.petEquipped;
    if (body.wx1 !== undefined) patch.wx_1 = String(body.wx1).slice(0, 190);
    if (body.wx2 !== undefined) patch.wx_2 = String(body.wx2).slice(0, 190);
    if (body.petBase !== undefined) patch.pet_base = parseInt(body.petBase) || 0;
    // High-water mark — refuse any write that would lower pet_exp, except
    // the one legitimate reset: adoption, signalled by petBase being set.
    if (body.petExp !== undefined) {
      const newExp = parseInt(body.petExp) || 0;
      const isAdoption = body.petBase !== undefined;
      const currentExp = existingCfg?.pet_exp ?? 0;
      if (isAdoption || newExp > currentExp) patch.pet_exp = newExp;
    }

    if (existingCfg) {
      await admin.from("config").update(patch).eq("match_id", matchId);
    } else {
      await admin.from("config").insert({ match_id: matchId, ...patch });
    }

    // Keep the couple name on the match record in sync with display names
    if (body.charName1 !== undefined || body.charName2 !== undefined) {
      const n1 = (patch.char1_name as string) ?? existingCfg?.char1_name ?? "";
      const n2 = (patch.char2_name as string) ?? existingCfg?.char2_name ?? "";
      await admin.from("matches").update({ couple_name: `${n1}_${n2}` }).eq("id", matchId);
    }

    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});

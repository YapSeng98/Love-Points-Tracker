import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller, clientDate } from "../_shared/util.ts";

// Furniture is PAID IN 小窝币, NOT love points — deliberately. It must never
// compete with real-world rewards. So this writes NO score entry and touches
// no points; it only records ownership. The coin balance is derived on the
// client as (pet EXP high-water / 2) minus the sum of pts_spent on decor rows,
// so the price recorded here IS the ledger.
serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, admin } = caller;
  if (!matchId) return json({ error: "not paired" }, 400);

  const body = await req.json().catch(() => ({}));
  const itemId = (body.itemId || "").toString();
  const price = parseInt(body.price) || 0;
  if (!itemId) return json({ error: "itemId required" }, 400);
  if (price < 0) return json({ error: "bad price" }, 400);

  const charId = (body.charId === "char1" || body.charId === "char2") ? body.charId : caller.charId!;
  const { today, month } = clientDate(body);

  // Decor is a one-off purchase — never charge twice
  const { data: owned } = await admin
    .from("bag")
    .select("id")
    .eq("match_id", matchId)
    .eq("source_type", "decor")
    .eq("decor_item_id", itemId)
    .maybeSingle();
  if (owned) return json({ error: "already_owned", itemId }, 400);

  const { data: bagRow, error } = await admin
    .from("bag")
    .insert({
      match_id: matchId,
      char: charId,
      item_name: body.itemName || itemId,
      item_icon: body.itemIcon || "",
      pts_spent: price,
      source_type: "decor",
      decor_item_id: itemId,
      month,
      acquired_date: today,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !bagRow) return json({ error: error?.message || "buy failed" }, 500);

  return json({ success: true, bagItemId: bagRow.id, itemId }, 201);
});

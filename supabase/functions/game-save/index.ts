import "@supabase/functions-js/edge-runtime.d.ts";
import { serve, json, getCaller } from "../_shared/util.ts";

// game-save — one small JSON save per couple per game (我们的家 first).
//
//   GET ?game=home[&slot=]          → { game, slot, data, rev, by, at }
//                                     (data null and rev 0 while nothing is saved)
//   PUT { game, slot, data, rev }   → { rev }
//
// Every write is a compare-and-set. A phone sends the rev it last read; if the
// other phone has written since, the answer is 409 { error: "stale", data, rev }
// with the newer save, and nothing is written. The app then replays its own
// action (one watering, one flower picked) on top of that save and tries
// again — so two phones acting at the same moment never undo each other.
//
// Writes only happen here (RLS has no policies on game_saves), which makes this
// the only place a save's rules are kept (CLAUDE.md §0.0):
//   · a game must be one this app knows;
//   · a save is at most 16 KB;
//   · 我们的家's `picked` (flowers ever picked; each is pet EXP and so 小窝币)
//     only grows, and by at most one flower per pot per write.

const MAX_BYTES = 16 * 1024;
const SLOT_RE = /^[a-z0-9_-]{0,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : -1);

type Check = (next: Record<string, unknown>, prev: Record<string, unknown> | null) => string;

// The house and its garden. Shapes are checked loosely — the app owns them —
// except where they touch the economy.
const MAX_POTS = 6;
const home: Check = (next, prev) => {
  const picked = count(next.picked);
  if (picked < 0) return "picked must be a whole number";
  const before = prev ? Math.max(0, count(prev.picked)) : 0;
  if (picked < before) return "picked can only grow";
  if (picked > before + MAX_POTS) return "too many flowers at once";
  if (next.pots !== undefined) {
    if (!Array.isArray(next.pots) || next.pots.length > MAX_POTS) return "pots";
    for (const p of next.pots) {
      if (p === null) continue;
      if (!isObj(p) || typeof p.seed !== "string" || p.seed.length > 16) return "pot";
      if (p.at !== undefined && !(typeof p.at === "string" && DATE_RE.test(p.at))) return "pot date";
      if (p.w !== undefined) {
        if (!isObj(p.w) || Object.keys(p.w).length > 60) return "pot waterings";
        for (const [d, bits] of Object.entries(p.w)) {
          if (!DATE_RE.test(d) || !(bits === 1 || bits === 2 || bits === 3)) return "pot watering";
        }
      }
    }
  }
  if (next.album !== undefined) {
    if (!isObj(next.album) || Object.keys(next.album).length > 40) return "album";
    let sum = 0;
    for (const n of Object.values(next.album)) { if (count(n) < 0) return "album count"; sum += n as number; }
    if (sum > picked) return "album is bigger than picked";
  }
  if (next.log !== undefined && (!Array.isArray(next.log) || next.log.length > 40)) return "log";
  return "";
};

const GAMES: Record<string, Check> = { home };

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { matchId, charId, admin } = caller;
  if (!matchId || !charId) return json({ error: "not paired" }, 400);

  const body = req.method === "PUT" ? await req.json().catch(() => null) : null;
  if (req.method === "PUT" && !isObj(body)) return json({ error: "body must be an object" }, 400);
  const q = new URL(req.url).searchParams;
  const game = String((body ? body.game : q.get("game")) ?? "");
  const slot = String((body ? body.slot : q.get("slot")) ?? "");
  const check = Object.prototype.hasOwnProperty.call(GAMES, game) ? GAMES[game] : null;
  if (!check) return json({ error: "unknown game" }, 400);
  if (!SLOT_RE.test(slot)) return json({ error: "bad slot" }, 400);

  const read = async () => {
    const { data, error } = await admin.from("game_saves")
      .select("data, rev, updated_by, updated_at")
      .eq("match_id", matchId).eq("game", game).eq("slot", slot)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };
  const shape = (row: { data: unknown; rev: number; updated_by: string; updated_at: string } | null) => ({
    game, slot, data: row ? row.data : null, rev: row ? row.rev : 0,
    by: row ? row.updated_by : "", at: row ? row.updated_at : "",
  });

  let row;
  try { row = await read(); } catch (e) { return json({ error: (e as Error).message }, 500); }
  if (req.method === "GET") return json(shape(row));

  // ── PUT ──
  const rev = Number(body!.rev);
  if (!Number.isInteger(rev) || rev < 0) return json({ error: "rev must be a whole number" }, 400);
  const data = body!.data;
  if (!isObj(data)) return json({ error: "data must be an object" }, 400);
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  if (bytes > MAX_BYTES) return json({ error: "save too big", bytes, max: MAX_BYTES }, 413);

  const stale = async () => {
    let now = row;
    try { now = await read(); } catch (_) { /* answer with what we had */ }
    return json({ error: "stale", ...shape(now) }, 409);
  };
  if ((row ? row.rev : 0) !== rev) return stale();

  const why = check(data, row && isObj(row.data) ? row.data : null);
  if (why) return json({ error: why }, 400);

  if (!row) {
    const { error } = await admin.from("game_saves")
      .insert({ match_id: matchId, game, slot, data, rev: 1, updated_by: charId });
    if (error) return error.code === "23505" ? stale() : json({ error: error.message }, 500);
    return json({ rev: 1 });
  }
  // The rev in the WHERE is the compare-and-set: of two writes that both read
  // rev n, exactly one matches.
  const { data: up, error } = await admin.from("game_saves")
    .update({ data, rev: rev + 1, updated_by: charId, updated_at: new Date().toISOString() })
    .eq("match_id", matchId).eq("game", game).eq("slot", slot).eq("rev", rev)
    .select("rev");
  if (error) return json({ error: error.message }, 500);
  if (!up || !up.length) return stale();
  return json({ rev: up[0].rev });
});

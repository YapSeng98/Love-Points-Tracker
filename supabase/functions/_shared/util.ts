import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// A browser preflights any cross-origin request carrying a custom header,
// and `apikey` is one — so without an OPTIONS answer that names these
// headers, the real request is never sent at all and the app only ever sees
// "Failed to fetch". ServiceNow needed a CORS rule for the same reason.
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept, x-migration-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    return await handler(req);
  });
}

// Supabase Auth requires an email; usernames don't have to look like one.
// Deterministic so login can reconstruct the same address from the username.
export function emailForUsername(username: string): string {
  const raw = btoa(unescape(encodeURIComponent(username)))
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return `u${raw.slice(0, 40)}@users.lovepointtracker.local`;
}

export function randomPairCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// Sum of ALL unsettled entries for one character — never filtered by calendar
// month. This MUST match what GET /entries returns (CLAUDE.md §3): if a
// 月末结算 is missed, older entries stay unsettled and still count, exactly
// like the score the app shows. Filtering to "this month" here once made
// purchases fail as insufficient_points while the UI showed plenty.
// Shared by shop-buy and bag-claim precisely so the two can never drift.
export async function unsettledScore(
  admin: SupabaseClient,
  matchId: string,
  charId: string,
): Promise<number> {
  const { data } = await admin
    .from("entries")
    .select("points")
    .eq("match_id", matchId)
    .eq("char", charId)
    .is("monthly_id", null);
  return (data || []).reduce((sum, e) => sum + (e.points || 0), 0);
}

// Client-authoritative dates (CLAUDE.md §2): the client sends its own local
// date/month; only fall back to the server clock when they are absent.
export function clientDate(body: { date?: string; month?: string } | null) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body?.date || "")
    ? body!.date!
    : new Date().toISOString().slice(0, 10);
  const month = /^\d{4}-\d{2}$/.test(body?.month || "")
    ? body!.month!
    : today.slice(0, 7);
  return { today, month };
}

export interface CallerProfile {
  userId: string;
  matchId: string | null;
  charId: string | null;
  admin: SupabaseClient;
}

// Every resource needs this: validate the caller's session, then look up
// which couple/char they are. Writes always go through `admin` (service
// role, bypasses RLS) — RLS only guards direct client access as a backstop.
export async function getCaller(req: Request): Promise<CallerProfile | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("match_id, char_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return null;

  return { userId: data.user.id, matchId: profile.match_id, charId: profile.char_id, admin };
}

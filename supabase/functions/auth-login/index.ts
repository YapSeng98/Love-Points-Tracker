import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve, json, emailForUsername, usernamePattern } from "../_shared/util.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").toString().trim();
  const password = (body.password || "").toString();
  if (!username || !password) return json({ error: "账号和密码不能为空" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin
    .from("profiles")
    .select("id, match_id, char_id, username")
    .ilike("username", usernamePattern(username))
    .maybeSingle();
  if (!profile) return json({ error: "账号不存在，请先注册" }, 404);

  // Build the address from the STORED username, never what was typed — the
  // synthetic email encodes the username, so "cs" and "CS" would otherwise
  // hash to two different addresses and the password check would fail.
  const email = emailForUsername(profile.username);
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) return json({ error: "密码错误" }, 401);

  await admin.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", profile.id);

  let pairCode = "";
  if (profile.match_id) {
    const { data: m } = await admin.from("matches").select("pair_code").eq("id", profile.match_id).maybeSingle();
    pairCode = m?.pair_code || "";
  }

  let partnerName = "";
  if (profile.match_id) {
    const otherChar = profile.char_id === "char1" ? "char2" : "char1";
    const { data: partner } = await admin
      .from("profiles")
      .select("username")
      .eq("match_id", profile.match_id)
      .eq("char_id", otherChar)
      .maybeSingle();
    partnerName = partner?.username || "";
  }

  return json({
    success: true,
    username: profile.username,
    charId: profile.char_id,
    matchId: profile.match_id,
    pairCode,
    partnerName,
    accessToken: signIn.session.access_token,
    refreshToken: signIn.session.refresh_token,
    // alias: the app stored ServiceNow's permanent key under `apiKey`, so
    // keeping the name lets every existing call site work unchanged. Unlike
    // the SN key this one expires — the client refreshes it on a 401.
    apiKey: signIn.session.access_token,
  });
});

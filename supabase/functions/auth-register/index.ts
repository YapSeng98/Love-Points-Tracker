import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve, json, emailForUsername, randomPairCode, usernamePattern } from "../_shared/util.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const username = (body.username || "").toString().trim();
  const password = (body.password || "").toString();
  const charId = (body.charId || "char1").toString();
  const pairCode = (body.pairCode || "").toString().trim();

  if (!username || !password) return json({ error: "账号和密码不能为空" }, 400);
  if (charId !== "char1" && charId !== "char2") return json({ error: "invalid charId" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // case-insensitive, so "cs" cannot be registered alongside an existing "CS"
  const { data: existing } = await admin.from("profiles").select("id").ilike("username", usernamePattern(username)).maybeSingle();
  if (existing) return json({ error: "账号已存在，请直接登录" }, 409);

  let matchId: string;
  let returnPairCode = "";
  if (charId === "char1") {
    returnPairCode = randomPairCode();
    const { data: m, error } = await admin.from("matches").insert({ pair_code: returnPairCode }).select("id").single();
    if (error || !m) return json({ error: "创建配对失败" }, 500);
    matchId = m.id;
  } else {
    if (!pairCode) return json({ error: "请输入伴侣的配对码" }, 400);
    const { data: m } = await admin.from("matches").select("id").eq("pair_code", pairCode).maybeSingle();
    if (!m) return json({ error: "配对码无效，请重新确认" }, 404);
    matchId = m.id;
    // char slot must not already be taken
    const { data: taken } = await admin.from("profiles").select("id").eq("match_id", matchId).eq("char_id", "char2").maybeSingle();
    if (taken) return json({ error: "该配对码已被使用" }, 409);
  }

  const email = emailForUsername(username);
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !userRes.user) return json({ error: "创建账号失败: " + (userErr?.message || "") }, 500);

  const { error: profileErr } = await admin.from("profiles").insert({
    id: userRes.user.id,
    match_id: matchId,
    char_id: charId,
    username,
    last_login: new Date().toISOString(),
  });
  if (profileErr) {
    // roll back the orphaned auth user so a retry doesn't hit "email exists"
    await admin.auth.admin.deleteUser(userRes.user.id);
    return json({ error: "创建资料失败: " + profileErr.message }, 500);
  }

  let partnerName = "";
  if (charId === "char2") {
    const { data: partner } = await admin.from("profiles").select("username").eq("match_id", matchId).eq("char_id", "char1").maybeSingle();
    partnerName = partner?.username || "";
    await admin.from("matches").update({ couple_name: `${partnerName}_${username}` }).eq("id", matchId);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) return json({ error: "注册成功但登录失败，请重新登录" }, 500);

  return json({
    success: true,
    username,
    charId,
    matchId,
    pairCode: returnPairCode,
    partnerName,
    accessToken: signIn.session.access_token,
    refreshToken: signIn.session.refresh_token,
    apiKey: signIn.session.access_token,   // see auth-login for why
  }, 201);
});

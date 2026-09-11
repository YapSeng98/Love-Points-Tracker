import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve, json, getCaller, emailForUsername, SUPABASE_URL, ANON_KEY } from "../_shared/util.ts";

// ServiceNow never had a change-password endpoint — accounts were created
// once and the plaintext password never changed. Supabase Auth needs one,
// because the migration hands out temporary passwords.
// Body: { currentPassword, newPassword }
serve(async (req) => {
  if (req.method !== "PUT") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Unauthorized" }, 401);
  const { admin, userId } = caller;

  const body = await req.json().catch(() => ({}));
  const currentPassword = (body.currentPassword || "").toString();
  const newPassword = (body.newPassword || "").toString();

  if (!currentPassword || !newPassword) return json({ error: "请输入当前密码和新密码" }, 400);
  if (newPassword.length < 6) return json({ error: "新密码至少 6 位" }, 400);

  const { data: profile } = await admin.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (!profile) return json({ error: "Unauthorized" }, 401);

  // Re-authenticate before allowing the change, so a stolen session token
  // alone cannot lock the real owner out of their account.
  const email = emailForUsername(profile.username);
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { error: pwErr } = await anon.auth.signInWithPassword({ email, password: currentPassword });
  // 403, not 401: the caller IS authenticated, they just gave the wrong
  // current password. Keeping 401 to mean "no valid session" lets the client
  // tell a bad password apart from an expired one.
  if (pwErr) return json({ error: "当前密码错误" }, 403);

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return json({ error: error.message }, 500);

  // Changing the password revokes every existing session, so the token the
  // caller is holding is already dead. Without handing back a fresh one the
  // app would 401 on its very next request and look broken right after a
  // change that actually succeeded.
  const { data: fresh } = await anon.auth.signInWithPassword({ email, password: newPassword });
  return json({
    success: true,
    accessToken: fresh?.session?.access_token || "",
    refreshToken: fresh?.session?.refresh_token || "",
    apiKey: fresh?.session?.access_token || "",
  });
});

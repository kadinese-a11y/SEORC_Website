import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return new Response(JSON.stringify({ error: "Unauthorised" }), { status: 401, headers });
  const { data: adminRole } = await client.from("admin_roles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRole) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
  const { eventId, username, password } = await request.json();
  const loginName = String(username || "").trim().toLowerCase();
  if (!eventId || !/^[a-z0-9._-]+$/.test(loginName) || typeof password !== "string" || password.length < 5) return new Response(JSON.stringify({ error: "Enter a login name and a password of at least 5 characters." }), { status: 400, headers });
  const email = `${loginName}@judge.seorc.internal`;
  const { data: showEvent, error: eventError } = await client.from("events").select("id,type").eq("id", eventId).maybeSingle();
  if (eventError || !showEvent || showEvent.type !== "show") return new Response(JSON.stringify({ error: "This judge access must be assigned from an existing show event." }), { status: 400, headers });
  const { data: listed } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed?.users.find((item) => item.email?.toLowerCase() === String(email).toLowerCase());
  const account = existing ? await client.auth.admin.updateUserById(existing.id, { password }) : await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error || !account.data.user) return new Response(JSON.stringify({ error: account.error?.message || "Could not create judge." }), { status: 400, headers });
  const { error } = await client.from("judge_assignments").upsert({ event_id: eventId, user_id: account.data.user.id, judge_login: loginName, assigned_by: user.id }, { onConflict: "event_id,user_id" });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers });
  return new Response(JSON.stringify({ success: true, eventId, loginName }), { headers });
});

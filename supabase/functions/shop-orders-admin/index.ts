const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

async function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getJwtUserId(authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return "";
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return String(decoded.sub || "");
  } catch {
    return "";
  }
}

async function requireAdmin(request: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return { ok: false, error: "Admin sign-in token was not sent." };
  const userId = getJwtUserId(authorization);
  if (!userId) return { ok: false, error: "Admin sign-in token could not be read." };

  const roleResponse = await fetch(`${supabaseUrl}/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const roles = await roleResponse.json().catch(() => []);
  if (!roleResponse.ok) return { ok: false, error: "Could not check admin role." };
  if (!Array.isArray(roles) || !roles.length) return { ok: false, error: "This signed-in user is not listed as a shop admin." };
  return { ok: true, userId };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Shop order admin access is not configured." }, 503);
  }

  const adminAccess = await requireAdmin(request, supabaseUrl, serviceRoleKey);
  if (!adminAccess.ok) return jsonResponse({ error: adminAccess.error }, 403);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const statusFilter = status === "fulfilled" ? "&sent_out=is.true" : status === "waiting" ? "&sent_out=is.false" : "";
    const ordersResponse = await fetch(`${supabaseUrl}/rest/v1/shop_orders?select=*${statusFilter}&order=created_at.desc`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const orders = await ordersResponse.json().catch(() => []);
    if (!ordersResponse.ok) return jsonResponse({ error: "Could not load shop orders." }, 502);
    return jsonResponse({ orders });
  }

  if (request.method === "PATCH" || request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const sentOut = Boolean(body.sentOut);
    if (!id) return jsonResponse({ error: "Order id is required." }, 400);

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/shop_orders?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        sent_out: sentOut,
        sent_out_at: sentOut ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    });
    const updatedOrders = await updateResponse.json().catch(() => []);
    if (!updateResponse.ok) return jsonResponse({ error: "Could not update order status." }, 502);
    return jsonResponse({ ok: true, order: Array.isArray(updatedOrders) ? updatedOrders[0] : null });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});

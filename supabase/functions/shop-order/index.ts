import { SEORC_LOGO_URL } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clubOrderEmail = "shoalhaveneorc25@gmail.com";

type ShopOrderRequest = {
  itemId?: string;
  itemName?: string;
  itemPrice?: number;
  quantity?: number;
  total?: number;
  customerName?: string;
  customerEmail?: string;
  address?: string;
  comments?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount)
    : "$0.00";
}

function row(label: string, value: unknown) {
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5ddd0;font-size:12px;color:#756959;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5ddd0;font-size:15px;color:#2f251d;line-height:1.5;">${escapeHtml(value || "Not supplied").replace(/\n/g, "<br>")}</td>
    </tr>
  `;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("SHOP_ORDER_FROM_EMAIL") || Deno.env.get("REGISTRATION_FROM_EMAIL") || Deno.env.get("CANCELLATION_FROM_EMAIL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!resendApiKey || !fromEmail || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Shop order delivery has not been configured." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const order: ShopOrderRequest = await request.json().catch(() => ({}));
  const itemName = order.itemName?.trim();
  const customerName = order.customerName?.trim();
  const customerEmail = order.customerEmail?.trim();
  const address = order.address?.trim();
  const quantity = Math.max(1, Number(order.quantity || 1));
  const itemPrice = Number(order.itemPrice || 0);
  const total = Number.isFinite(Number(order.total)) ? Number(order.total) : itemPrice * quantity;

  if (!itemName || !customerName || !customerEmail || !customerEmail.includes("@") || !address || !Number.isFinite(itemPrice) || itemPrice < 0) {
    return new Response(JSON.stringify({ error: "Item, purchaser name, email, address, and order total are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderInsertResponse = await fetch(`${supabaseUrl}/rest/v1/shop_orders`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      item_id: order.itemId || null,
      item_name: itemName,
      item_price: itemPrice,
      quantity,
      total_amount: total,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_address: address,
      comments: order.comments?.trim() || "",
    }),
  });

  const insertedOrders = await orderInsertResponse.json().catch(() => []);
  if (!orderInsertResponse.ok || !Array.isArray(insertedOrders) || !insertedOrders[0]?.order_reference) {
    return new Response(JSON.stringify({ error: "Could not save the shop order." }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reference = insertedOrders[0].order_reference;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>New SEORC Shop Order</title></head>
<body style="margin:0;padding:0;background-color:#f5f1eb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f1eb;padding:32px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#1a2f4e;padding:28px 40px;text-align:center;">
            <img src="${SEORC_LOGO_URL}" alt="SEORC Logo" width="64" style="display:block;margin:0 auto 12px;border:0;" />
            <p style="margin:0;color:#c8a96e;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Shoalhaven Extreme Obstacle Racing Club</p>
          </td>
        </tr>
        <tr><td style="background-color:#c8a96e;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:#1a2f4e;">New shop order</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#c8a96e;letter-spacing:1px;text-transform:uppercase;font-weight:bold;">${escapeHtml(reference)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5ddd0;border-collapse:collapse;margin-bottom:26px;">
              ${row("Item", itemName)}
              ${row("Quantity", quantity)}
              ${row("Item price", formatCurrency(itemPrice))}
              ${row("Total order amount", formatCurrency(total))}
              ${row("Purchaser", customerName)}
              ${row("Email", customerEmail)}
              ${row("Address", address)}
              ${row("Comments", order.comments?.trim() || "")}
              ${row("Bank reference", reference)}
            </table>
            <p style="margin:0;font-size:15px;color:#3d3d3d;line-height:1.7;">The purchaser has been shown the SEORC bank details and asked to use the reference above.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [clubOrderEmail],
      reply_to: customerEmail,
      subject: `SEORC shop order - ${itemName}`,
      html,
    }),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: "Could not send the shop order email." }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, reference }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

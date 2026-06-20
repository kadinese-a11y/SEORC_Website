import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function registrationEmail(payload: Record<string, unknown>) {
  const email = payload["participant-email"] || payload["club-email"];
  return typeof email === "string" && email.includes("@") ? email.trim() : null;
}

function registrationName(payload: Record<string, unknown>) {
  return [payload["participant-first-name"] || payload["club-day-first-name"], payload["participant-last-name"] || payload["club-day-last-name"]]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("REGISTRATION_FROM_EMAIL") || Deno.env.get("CANCELLATION_FROM_EMAIL");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    return new Response(JSON.stringify({ error: "Email delivery has not been configured." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { registrationId, confirmationToken } = await request.json();
  if (!registrationId || !confirmationToken) {
    return new Response(JSON.stringify({ error: "Registration confirmation details are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: registration, error } = await adminClient
    .from("registrations")
    .select("id, form_type, payload, confirmation_sent_at")
    .eq("id", registrationId)
    .eq("confirmation_token", confirmationToken)
    .maybeSingle();

  if (error) throw error;
  if (!registration) {
    return new Response(JSON.stringify({ error: "Registration not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (registration.confirmation_sent_at) {
    return new Response(JSON.stringify({ sent: false, reason: "already_sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = registration.payload || {};
  const to = registrationEmail(payload);
  if (!to) {
    return new Response(JSON.stringify({ sent: false, reason: "no_email" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId = payload["show-date"] || payload["club-date"] || "your SEORC event";
  const attendeeName = registrationName(payload);
  const formLabel = registration.form_type === "show_registration" ? "show" : "club day";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "SEORC registration received",
      html: `<h1>Thanks${attendeeName ? `, ${escapeHtml(attendeeName)}` : ""}!</h1><p>We have received your ${formLabel} registration for <strong>${escapeHtml(eventId)}</strong>.</p><p>We will be in touch if we need anything else. Please contact SEORC if any of your details change.</p>`,
    }),
  });

  if (!response.ok) throw new Error(await response.text());

  await adminClient
    .from("registrations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", registration.id);

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CancellationRequest = {
  eventId?: string;
  eventTitle?: string;
  message?: string;
};

function attendeeEmail(payload: Record<string, unknown>) {
  const email = payload["participant-email"] || payload["club-email"];
  return typeof email === "string" && email.includes("@") ? email.trim() : null;
}

function registrationEventId(payload: Record<string, unknown>) {
  const eventId = payload["show-date"] || payload["club-date"] || payload["event-id"];
  return typeof eventId === "string" ? eventId : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("CANCELLATION_FROM_EMAIL");

  if (!token || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!resendApiKey || !fromEmail) {
    return new Response(JSON.stringify({ error: "Email delivery has not been configured." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: adminRole } = await adminClient
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRole) {
    return new Response(JSON.stringify({ error: "Admin access is required." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { eventId, eventTitle, message }: CancellationRequest = await request.json();

  if (!eventId || !eventTitle) {
    return new Response(JSON.stringify({ error: "An event ID and event title are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: registrations, error: registrationsError } = await adminClient
    .from("registrations")
    .select("id, payload")
    .in("form_type", ["club_day_registration", "show_registration"]);

  if (registrationsError) throw registrationsError;

  const recipients = [...new Set(
    (registrations || [])
      .filter((registration) => registrationEventId(registration.payload || {}) === eventId)
      .map((registration) => attendeeEmail(registration.payload || {}))
      .filter((email): email is string => Boolean(email)),
  )];

  const { data: cancellation, error: cancellationError } = await adminClient
    .from("event_cancellations")
    .insert({
      event_id: eventId,
      event_title: eventTitle,
      message: message?.trim() || null,
      cancelled_by: user.id,
      recipient_count: recipients.length,
      notification_status: "sending",
    })
    .select("id")
    .single();

  if (cancellationError) throw cancellationError;

  const html = `
    <h1>${eventTitle} has been cancelled</h1>
    <p>We are sorry, but this SEORC event will not be going ahead.</p>
    ${message?.trim() ? `<p>${message.trim().replace(/\n/g, "<br>")}</p>` : ""}
    <p>Please contact SEORC if you have any questions about your registration.</p>
  `;

  const outcomes = await Promise.allSettled(recipients.map(async (to) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `Cancelled: ${eventTitle}`,
        html,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
  }));

  const sentCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  const failedCount = outcomes.length - sentCount;
  await adminClient
    .from("event_cancellations")
    .update({
      sent_count: sentCount,
      failed_count: failedCount,
      notification_status: failedCount ? "partially_sent" : "sent",
      notified_at: new Date().toISOString(),
    })
    .eq("id", cancellation.id);

  return new Response(JSON.stringify({ sentCount, failedCount, recipientCount: recipients.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

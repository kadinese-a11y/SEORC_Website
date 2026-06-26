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

  const { data: event, error: eventError } = await adminClient.from("events").select("*").eq("id", eventId).single();
  if (eventError || !event) return new Response(JSON.stringify({ error: "Event not found." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: registrations, error: registrationsError } = await adminClient
    .from("registrations")
    .select("id, payload")
    .in("form_type", ["club_day_registration", "show_registration"]);

  if (registrationsError) throw registrationsError;

  const attendeeRegistrations = (registrations || []).filter((registration) => registrationEventId(registration.payload || {}) === eventId);
  const recipients = [...new Set(
    attendeeRegistrations
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
      notification_status: resendApiKey && fromEmail ? "sending" : "failed",
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

  const outcomes = resendApiKey && fromEmail ? await Promise.allSettled(recipients.map(async (to) => {
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
  })) : [];

  const sentCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  const failedCount = outcomes.length - sentCount;
  await adminClient
    .from("event_cancellations")
    .update({
      sent_count: sentCount,
      failed_count: resendApiKey && fromEmail ? failedCount : recipients.length,
      notification_status: resendApiKey && fromEmail ? (failedCount ? "partially_sent" : "sent") : "failed",
      notified_at: new Date().toISOString(),
    })
    .eq("id", cancellation.id);

  const cancelledAt = new Date().toISOString();
  if (event.type === "show") {
    const { data: results, error: resultsError } = await adminClient.from("show_results").select("*").eq("event_id", eventId);
    if (resultsError) return new Response(JSON.stringify({ error: resultsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { error: archiveError } = await adminClient.from("achieved_events").upsert({ event_id: eventId, event_date: event.date, event_data: { ...event, cancelled_at: cancelledAt, cancellation_notice: message?.trim() || "This event was cancelled." }, results: results || [] }, { onConflict: "event_id" });
    if (archiveError) return new Response(JSON.stringify({ error: archiveError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Keep the event row as a transfer destination. Deleting it can be blocked by
  // attendee_transfers, whereas cancelled_at removes it from public listings.
  const { error: cancelEventError } = await adminClient
    .from("events")
    .update({ cancelled_at: cancelledAt })
    .eq("id", eventId);
  if (cancelEventError) {
    return new Response(JSON.stringify({ error: cancelEventError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ sentCount, failedCount, recipientCount: recipients.length, archived: event.type === "show", emailConfigured: Boolean(resendApiKey && fromEmail) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

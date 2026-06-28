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
  const email = payload["participant-email"] || payload["club-day-email"] || payload["clinic-email"] || payload["club-email"] || payload["membership-email"];
  return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
}

function registrationEventId(payload: Record<string, unknown>) {
  const eventId = payload["show-date"] || payload["club-date"] || payload["clinic-date"] || payload["event-id"];
  return typeof eventId === "string" ? eventId : null;
}

function formatEventDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00+10:00`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
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

function paragraph(text: string) {
  return `<p style="margin:0 0 18px;font-size:15px;color:#3d3d3d;line-height:1.7;">${text}</p>`;
}

function featureBox(label: string, value: string, note = "") {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;background-color:#1a2f4e;border-radius:4px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#c8a96e;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">${label}</p>
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:1px;">${value}</p>
          ${note ? `<p style="margin:8px 0 0;font-size:12px;color:#8aa0bc;">${note}</p>` : ""}
        </td>
      </tr>
    </table>
  `;
}

function seorcEmailTemplate(options: {
  title: string;
  eyebrow: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const cta = options.ctaLabel && options.ctaUrl ? `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
      <tr>
        <td align="center" style="background-color:#1a2f4e;border-radius:3px;">
          <a href="${options.ctaUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">${options.ctaLabel}</a>
        </td>
      </tr>
    </table>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${options.title}</title></head>
<body style="margin:0;padding:0;background-color:#f5f1eb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f1eb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#1a2f4e;padding:28px 40px;text-align:center;">
            <img src="https://www.shoalhaveneorc.com/assets/seorc-club-logo.png" alt="SEORC Logo" width="64" style="display:block;margin:0 auto 12px;border:0;" />
            <p style="margin:0;color:#c8a96e;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">Shoalhaven Extreme Obstacle Racing Club</p>
          </td>
        </tr>
        <tr><td style="background-color:#c8a96e;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#1a2f4e;line-height:1.3;">${options.title}</h1>
            <p style="margin:0 0 24px;font-size:13px;color:#c8a96e;letter-spacing:1px;text-transform:uppercase;font-weight:bold;">${options.eyebrow}</p>
            ${options.bodyHtml}
            ${cta}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;"><tr><td style="border-top:1px solid #e5ddd0;font-size:0;">&nbsp;</td></tr></table>
            <p style="margin:0 0 4px;font-size:15px;color:#3d3d3d;line-height:1.7;">Any questions? Reply to this email or reach us at <a href="mailto:shoalhaveneorc25@gmail.com" style="color:#1a2f4e;font-weight:bold;">shoalhaveneorc25@gmail.com</a>.</p>
            <p style="margin:18px 0 0;font-size:15px;color:#3d3d3d;">See you on course,<br /><strong style="color:#1a2f4e;">The SEORC Team</strong></p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#1a2f4e;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#8aa0bc;line-height:1.6;">SEORC acknowledges the riders, volunteers, landholders, and families<br/>who make local horse sport possible.</p>
            <p style="margin:8px 0 0;font-size:11px;color:#5a7090;">An affiliate of <a href="https://www.australianextremeobstacleracing.com.au/" style="color:#c8a96e;text-decoration:none;">Australian Extreme Obstacle Racing</a>&nbsp;·&nbsp;<a href="https://www.shoalhaveneorc.com" style="color:#c8a96e;text-decoration:none;">www.shoalhaveneorc.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  const eventDate = formatEventDate(event.date);
  const eventLabel = eventDate ? `${eventTitle} — ${eventDate}` : eventTitle;

  const { data: registrations, error: registrationsError } = await adminClient
    .from("registrations")
    .select("id, payload")
    .in("form_type", ["club_day_registration", "show_registration", "clinic_registration"]);

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

  const html = seorcEmailTemplate({
    title: `${escapeHtml(eventTitle)} has been cancelled`,
    eyebrow: "Event update",
    bodyHtml: `
      ${paragraph("We are sorry, but this SEORC event will not be going ahead.")}
      ${featureBox("Cancelled Event", escapeHtml(eventLabel), "Thank you for understanding.")}
      ${message?.trim() ? paragraph(escapeHtml(message.trim()).replace(/\n/g, "<br>")) : ""}
      ${paragraph("Please contact SEORC if you have any questions about your registration.")}
    `,
    ctaLabel: "View Upcoming Events →",
    ctaUrl: "https://www.shoalhaveneorc.com/calendar.html",
  });

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

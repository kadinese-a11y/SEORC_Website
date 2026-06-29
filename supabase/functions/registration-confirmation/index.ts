import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SEORC_LOGO_URL } from "../_shared/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function registrationEmail(payload: Record<string, unknown>) {
  const email = payload["participant-email"] || payload["club-day-email"] || payload["clinic-email"] || payload["club-email"] || payload["membership-email"];
  return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
}

function registrationName(payload: Record<string, unknown>) {
  return [
    payload["participant-first-name"] || payload["club-day-first-name"] || payload["clinic-first-name"] || payload["club-first-name"],
    payload["participant-last-name"] || payload["club-day-last-name"] || payload["clinic-last-name"] || payload["club-last-name"],
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function registrationFormLabel(formType: string) {
  if (formType === "show_registration") return "show";
  if (formType === "club_day_registration") return "club day";
  if (formType === "clinic_registration") return "clinic";
  return "event";
}

function registrationEventId(payload: Record<string, unknown>) {
  const eventId = payload["show-date"] || payload["club-date"] || payload["clinic-date"] || payload["event-id"];
  return typeof eventId === "string" && eventId.trim() ? eventId.trim() : null;
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

function formatEventLabel(event: Record<string, unknown> | null, fallbackEventId: string | null) {
  if (!event) return fallbackEventId || "your SEORC event";
  const title = typeof event.title === "string" && event.title.trim() ? event.title.trim() : fallbackEventId || "your SEORC event";
  const date = formatEventDate(event.date);

  return date ? `${title} — ${date}` : title;
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
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:2px;">${value}</p>
          ${note ? `<p style="margin:8px 0 0;font-size:12px;color:#8aa0bc;">${note}</p>` : ""}
        </td>
      </tr>
    </table>
  `;
}

function actionStep(step: string, title: string, text: string) {
  return `
    <tr>
      <td style="padding:14px 16px;background-color:#f5f1eb;border-left:3px solid #c8a96e;border-radius:2px;">
        <p style="margin:0 0 4px;font-size:11px;color:#c8a96e;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">${step}</p>
        <p style="margin:0;font-size:15px;color:#1a2f4e;font-weight:bold;">${title}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#5a5a5a;line-height:1.5;">${text}</p>
      </td>
    </tr>
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
            <img src="${SEORC_LOGO_URL}" alt="SEORC Logo" width="64" style="display:block;margin:0 auto 12px;border:0;" />
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

  const attendeeName = registrationName(payload);
  const membershipNumber = typeof payload["membership-number"] === "string" ? payload["membership-number"] : "";
  const isMembership = registration.form_type === "club_membership";
  const eventId = registrationEventId(payload);
  const { data: event } = eventId
    ? await adminClient.from("events").select("id, title, date").eq("id", eventId).maybeSingle()
    : { data: null };
  const eventDate = formatEventDate(event?.date);
  const eventLabel = formatEventLabel(event, eventId);
  const formLabel = registrationFormLabel(registration.form_type);
  const subject = isMembership ? "Your SEORC membership number" : "SEORC registration received";
  const html = isMembership
    ? seorcEmailTemplate({
      title: `Welcome to the club${attendeeName ? `, ${escapeHtml(attendeeName.split(" ")[0])}` : ""}!`,
      eyebrow: "Membership confirmed",
      bodyHtml: `
        ${paragraph("We're glad to have you riding with us. SEORC is a volunteer-run club built around practical obstacle work, and the community that comes along with it.")}
        ${featureBox("Your Club Membership Number", escapeHtml(membershipNumber || "Pending"), "Quote this number when attending events or contacting the club.")}
        ${paragraph("Here's what to do before your first day out:")}
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          ${actionStep("Step 1", "Check the events calendar", `Training days, clinics, and competitions are listed at <a href="https://www.shoalhaveneorc.com/calendar.html" style="color:#1a2f4e;font-weight:bold;">www.shoalhaveneorc.com/calendar</a>`)}
          <tr><td style="height:10px;font-size:0;">&nbsp;</td></tr>
          ${actionStep("Step 2", "Show up and ride", "Everyone starts somewhere. Bring your horse, bring your helmet, and we'll handle the rest.")}
        </table>
      `,
      ctaLabel: "View Upcoming Events →",
      ctaUrl: "https://www.shoalhaveneorc.com/calendar.html",
    })
    : seorcEmailTemplate({
      title: `Thanks${attendeeName ? `, ${escapeHtml(attendeeName.split(" ")[0])}` : ""}!`,
      eyebrow: "Registration received",
      bodyHtml: `
        ${paragraph(`We have received your ${escapeHtml(formLabel)} registration.`)}
        ${featureBox("Your Registration", escapeHtml(eventLabel), "We will be in touch if we need anything else.")}
        ${eventDate ? paragraph(`We are looking forward to seeing you on ${escapeHtml(eventDate)}. Until then, happy riding.`) : paragraph("We are looking forward to seeing you at the event. Until then, happy riding.")}
        ${paragraph("Please contact SEORC if any of your details change before the event.")}
      `,
      ctaLabel: "View Upcoming Events →",
      ctaUrl: "https://www.shoalhaveneorc.com/calendar.html",
    });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend registration confirmation failed", response.status, errorText);
    return new Response(JSON.stringify({ error: "Email provider rejected the confirmation email.", detail: errorText }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient
    .from("registrations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", registration.id);

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

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
  const { data: role } = await client.from("admin_roles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!role) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
  const { eventId } = await request.json();
  const { data: event, error: eventError } = await client.from("events").select("*").eq("id", eventId).single();
  if (eventError || !event) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers });
  const { data: results, error: resultsError } = await client.from("show_results").select("*").eq("event_id", eventId);
  if (resultsError) return new Response(JSON.stringify({ error: resultsError.message }), { status: 400, headers });
  const { data: judgeAssignment, error: judgeAssignmentError } = await client.from("judge_assignments").select("judge_name").eq("event_id", eventId).limit(1).maybeSingle();
  if (judgeAssignmentError) return new Response(JSON.stringify({ error: judgeAssignmentError.message }), { status: 400, headers });
  const { data: registrations, error: registrationsError } = await client.from("registrations").select("*");
  if (registrationsError) return new Response(JSON.stringify({ error: registrationsError.message }), { status: 400, headers });
  const eventRegistrations = (registrations || []).filter((registration) => {
    const payload = registration.payload || {};
    return payload["show-date"] === eventId || payload["club-date"] === eventId || payload["event-id"] === eventId;
  });
  const archiveSummary = eventRegistrations.reduce((summary, registration) => {
    const payload = registration.payload || {};
    const horses = Object.entries(payload).filter(([key, value]) => /^horse-\d+-name$/.test(key) && Boolean(value)).length;
    const isDayMembership = payload["aeora-day-membership"] === true || payload["aeora-membership"] === "day";
    const campers = payload["camping-with-power"] === true || payload["camping-without-power"] === true ? 1 : 0;
    const dinnerTickets = Number(payload["dinner-count"]) || 0;
    const calculatedTotal = Number(payload["calculated-total"]);
    const revenue = Number.isFinite(calculatedTotal) && calculatedTotal > 0 ? calculatedTotal : (isDayMembership ? 20 : 0);
    return {
      participants: summary.participants + 1,
      horses: summary.horses + horses,
      campers: summary.campers + campers,
      day_memberships: summary.day_memberships + (isDayMembership ? 1 : 0),
      dinner_tickets: summary.dinner_tickets + dinnerTickets,
      revenue: summary.revenue + revenue,
    };
  }, { participants: 0, horses: 0, campers: 0, day_memberships: 0, dinner_tickets: 0, revenue: 0 });
  const { error: archiveError } = await client.from("achieved_events").upsert({ event_id: eventId, event_date: event.date, event_data: { ...event, judge_name: judgeAssignment?.judge_name || null, archive_summary: archiveSummary }, results: results || [] }, { onConflict: "event_id" });
  if (archiveError) return new Response(JSON.stringify({ error: archiveError.message }), { status: 400, headers });
  await client.from("judge_assignments").delete().eq("event_id", eventId);
  const { error: deleteError } = await client.from("events").delete().eq("id", eventId);
  if (deleteError) return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers });
  return new Response(JSON.stringify({ success: true }), { headers });
});

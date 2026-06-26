const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const eventStorageKey = "seorcEvents";
const adminSessionStorageKey = "seorcAdminSession";
const judgeSessionStorageKey = "seorcJudgeSession";
const eventOverrideStorageKey = "seorcEventOverrides";
const showOrderStorageKey = "seorcShowClassOrder";
const defaultClubDayFee = 40;
const defaultDayMembershipFee = 30;
const defaultClinicFee = 170;
let annualMembershipFee = 20;
let juniorMembershipFee = 15;
const showObstacleCount = 14;
let adminRegistrations = [];
let showResults = [];
let remoteEvents = [];
let draggedShowEntry = null;
let editingMemberId = null;
const resultSaveTimers = new WeakMap();
const typeLabels = {
  club: "Club Day",
  show: "Show",
  clinic: "Clinic",
  "external-show": "External Show",
  "external-clinic": "External Clinic",
};
const defaultEvents = [
  {
    id: "default-club-2026-07-11",
    type: "club",
    date: "2026-07-11",
    title: "Winter Obstacle Muster",
    location: "Nowra Showground",
    description: "Green-horse confidence course, open practice lanes, and club barbecue from 3:30pm.",
  },
  {
    id: "default-clinic-2026-08-08",
    type: "clinic",
    date: "2026-08-08",
    title: "Groundwork to Ridden Obstacles Clinic",
    location: "Berry Riding Club grounds",
    description: "Morning groundwork groups followed by ridden problem-solving sessions.",
  },
  {
    id: "default-show-2026-09-12",
    type: "show",
    date: "2026-09-12",
    title: "Spring Timed Challenge",
    location: "Milton Showground",
    description: "Novice, intermediate, and open divisions across two timed patterns.",
  },
  {
    id: "default-club-2026-10-10",
    type: "club",
    date: "2026-10-10",
    title: "Trail Obstacles and Water Day",
    location: "Private Shoalhaven venue",
    description: "Water crossings, gate control, narrow bridge work, and steady pace practice.",
  },
  {
    id: "default-show-2026-11-14",
    type: "show",
    date: "2026-11-14",
    title: "SEORC Club Championship",
    location: "Nowra Showground",
    description: "End-of-season patterns, volunteer awards, and presentation afternoon.",
  },
];

const registrationFormTypes = {
  "club-membership.html": "club_membership",
  "club-day-registration.html": "club_day_registration",
  "clinic-registration.html": "clinic_registration",
  "show-registration.html": "show_registration",
};
const registrationFormLabels = {
  club_membership: "Club Membership",
  club_day_registration: "Club Day Registration",
  clinic_registration: "Clinic Registration",
  show_registration: "Show Registration",
  website_form: "Website Form",
};
const showClassSlugs = [
  "young-rider",
  "junior",
  "encouragement",
  "green-horse",
  "rookie",
  "amateur",
  "masters",
  "open",
  "limited-open",
];
const defaultShowClassPrices = {
  "young-rider": 15,
  junior: 15,
  encouragement: 25,
  "green-horse": 25,
  rookie: 25,
  amateur: 25,
  masters: 25,
  open: 30,
  "limited-open": 30,
};
function getShowClassSlug(className) {
  return String(className || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function getDefaultShowClassPrice(slug) {
  return defaultShowClassPrices[slug] ?? 25;
}
function sortShowClassNames(classNames) {
  return [...classNames].sort((a, b) => {
    const aIndex = showClassSlugs.indexOf(getShowClassSlug(a));
    const bIndex = showClassSlugs.indexOf(getShowClassSlug(b));
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }
    return String(a).localeCompare(String(b));
  });
}

function getObstacleNames(event) {
  const savedNames = Array.isArray(event?.event_settings?.obstacle_names) ? event.event_settings.obstacle_names : [];
  return Array.from({ length: showObstacleCount }, (_, index) => String(savedNames[index] || `Obstacle ${index + 1}`));
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function readAdminEvents() {
  try {
    return JSON.parse(localStorage.getItem(eventStorageKey)) || [];
  } catch {
    return [];
  }
}

function writeAdminEvents(events) {
  localStorage.setItem(eventStorageKey, JSON.stringify(events));
}

function readEventOverrides() {
  try {
    return JSON.parse(localStorage.getItem(eventOverrideStorageKey)) || {};
  } catch {
    return {};
  }
}

function writeEventOverride(event) {
  const overrides = readEventOverrides();
  overrides[event.id] = event;
  localStorage.setItem(eventOverrideStorageKey, JSON.stringify(overrides));
}

function getEvents() {
  if (remoteEvents.length) {
    return [...remoteEvents].sort((a, b) => a.date.localeCompare(b.date));
  }
  const overrides = readEventOverrides();
  return [...defaultEvents, ...readAdminEvents()]
    .map((event) => ({ ...event, ...(overrides[event.id] || {}) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadSharedEvents() {
  try {
    remoteEvents = await requestSupabase("/rest/v1/events?cancelled_at=is.null&select=*&order=date.asc");
    renderCalendarEvents();
    renderNextEventPreview();
    populateEventSelects();
    renderEventDashboard(adminRegistrations);
    applySelectedEventSettings();
  } catch (error) {
    console.warn("Shared events could not be loaded; using the existing local list.", error);
  }
}

function applySelectedEventSettings() {
  [["club-date", "club"], ["clinic-date", "clinic"], ["show-date", "show"]].forEach(([name, type]) => {
    const select = document.querySelector(`[name="${name}"]`);
    const form = select?.closest("form");
    const event = getEvents().find((item) => item.id === select?.value);
    const settings = event?.event_settings || {};
    const info = form?.querySelector("[data-event-options-info]");
    if (type === "club" && info) { const fee = Number(settings.club_day_fee ?? defaultClubDayFee); form.dataset.eventFee = String(fee); info.textContent = event ? `Club day fee: ${formatCurrency(fee)}` : ""; updateClubDayTotal(form); }
    if (type === "clinic" && info) { const fee = Number(settings.clinic_fee ?? defaultClinicFee); form.dataset.eventFee = String(fee); info.textContent = event ? `Clinic fee: ${formatCurrency(fee)}` : ""; updateClinicTotal(form); }
    if (type === "show" && form && event) {
      showClassSlugs.forEach((slug) => { const input = form.querySelector(`[name$="-class-${slug}"]`); const price = Number(settings.class_prices?.[slug] ?? getDefaultShowClassPrice(slug)); if (input) { input.dataset.price = price; input.closest("label")?.querySelector("strong")?.replaceChildren(formatCurrency(price)); } });
      [["dinner-count", settings.dinner_price ?? 30], ["camping-with-power", settings.powered_camping_price ?? 30], ["camping-without-power", settings.unpowered_camping_price ?? 20], ["yard-count", settings.yard_price ?? 5]].forEach(([field, price]) => { const input = form.querySelector(`[name="${field}"]`); if (input) { input.dataset.price = price; input.closest("label")?.querySelector("strong")?.replaceChildren(formatCurrency(Number(price))); } });
      form.querySelectorAll("[data-class-group] input[data-price]").forEach((input) => { const available = Number(input.dataset.price) > 0; input.closest("label").style.display = available ? "" : "none"; if (!available) input.checked = false; });
      ["camping-with-power", "camping-without-power", "yard-count"].forEach((field) => { const input = form.querySelector(`[name="${field}"]`); if (!input) return; const available = Number(input.dataset.price) > 0; input.closest("label").style.display = available ? "" : "none"; if (!available) { input.checked = false; if (input.type === "number") input.value = 0; } });
      const campingAvailable = ["camping-with-power", "camping-without-power", "yard-count"].some((field) => Number(form.querySelector(`[name="${field}"]`)?.dataset.price || 0) > 0);
      const campingPanel = form.querySelector("[data-camping-options]");
      if (campingPanel) { campingPanel.style.display = campingAvailable ? "" : "none"; if (!campingAvailable) campingPanel.querySelectorAll("input").forEach((input) => { input.checked = false; input.value = input.type === "number" ? 0 : input.value; }); }
      const dinnerPanel = form.querySelector("[data-dinner-options]");
      const dinnerAvailable = Number(form.querySelector("[name='dinner-count']")?.dataset.price || 0) > 0;
      if (dinnerPanel) { dinnerPanel.style.display = dinnerAvailable ? "" : "none"; if (!dinnerAvailable) dinnerPanel.querySelector("[name='dinner-count']").value = 0; }
      const dinnerInfo = form.querySelector("[data-dinner-information]");
      if (dinnerInfo && dinnerAvailable) dinnerInfo.innerHTML = `${settings.dinner_vendor_url ? `<a class="text-link" href="${escapeHTML(settings.dinner_vendor_url)}" target="_blank" rel="noopener">Visit the dinner vendor</a>` : "Dinner details"}${settings.custom_information ? ` — ${escapeHTML(settings.custom_information)}` : ""}`;
      if (info) info.innerHTML = "";
      updateShowTotals(form);
    }
  });
}

function updateClubDayTotal(form) {
  if (!form?.matches(".registration-form") || !form.querySelector("[name='club-date']")) return;
  const clubDayFee = Number(form.dataset.eventFee || defaultClubDayFee);
  const dayMembershipAdded = form.querySelector("[name='club-day-day-membership']")?.checked;
  const dayMembershipFee = dayMembershipAdded ? defaultDayMembershipFee : 0;
  const total = clubDayFee + dayMembershipFee;
  const totalElement = form.querySelector("[data-club-day-total]");
  if (totalElement) totalElement.textContent = formatCurrency(total);
  const baseElement = form.querySelector("[data-club-day-base-fee]");
  if (baseElement) baseElement.textContent = formatCurrency(clubDayFee);
  const membershipElement = form.querySelector("[data-club-day-membership-fee]");
  if (membershipElement) membershipElement.textContent = formatCurrency(dayMembershipFee);
  form.dataset.calculatedTotal = String(total);
}

function updateClinicTotal(form) {
  if (!form?.querySelector("[name='clinic-date']")) return;
  const total = Number(form.dataset.eventFee || defaultClinicFee);
  form.querySelectorAll("[data-clinic-total]").forEach((element) => { element.textContent = formatCurrency(total); });
  form.dataset.calculatedTotal = String(total);
}

document.addEventListener("change", (event) => {
  if (event.target.matches("[name='club-date'], [name='clinic-date'], [name='show-date']")) applySelectedEventSettings();
  if (event.target.matches("[name='club-day-day-membership']")) updateClubDayTotal(event.target.closest("form"));
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function googleMapsUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function locationMapLink(location) {
  const label = String(location || "Location to be confirmed");
  return `<a class="text-link" href="${googleMapsUrl(label)}" target="_blank" rel="noopener">${escapeHTML(label)} <span aria-hidden="true">↗</span></a>`;
}

function enableOpenStreetMapLocationSearch() {
  document.querySelectorAll("input[name='location']").forEach((input) => {
    if (input.dataset.osmSearchReady) return;
    input.dataset.osmSearchReady = "true";
    const suggestions = document.createElement("div");
    suggestions.className = "location-suggestions";
    suggestions.hidden = true;
    input.insertAdjacentElement("afterend", suggestions);
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const query = input.value.trim();
      suggestions.hidden = true;
      if (query.length < 4) return;
      timer = setTimeout(async () => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=au&q=${encodeURIComponent(query)}`);
          if (!response.ok) throw new Error("Address search unavailable");
          const results = await response.json();
          suggestions.innerHTML = results.length ? results.map((result) => { const parts = String(result.display_name).split(", "); const label = `${result.name || parts[0]}${parts.length > 1 ? ` — ${parts.slice(1, 3).join(", ")}` : ""}`; return `<button type="button" data-location-choice="${escapeHTML(result.display_name)}"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(result.display_name)}</small></button>`; }).join("") + '<small>Address search © OpenStreetMap contributors</small>' : '<small>No matching address found.</small>';
          suggestions.hidden = false;
        } catch { suggestions.innerHTML = '<small>Address search is temporarily unavailable.</small>'; suggestions.hidden = false; }
      }, 1100);
    });
    suggestions.addEventListener("click", (event) => { const choice = event.target.closest("[data-location-choice]"); if (!choice) return; input.value = choice.dataset.locationChoice; suggestions.hidden = true; });
  });
}

function formatDateParts(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return {
    day: new Intl.DateTimeFormat("en-AU", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-AU", { month: "short" }).format(date),
    label: new Intl.DateTimeFormat("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  };
}

function registrationPageForType(type) {
  if (type === "show") return "show-registration.html";
  if (type === "clinic") return "clinic-registration.html";
  return "club-day-registration.html";
}

function renderNextEventPreview() {
  const preview = document.querySelector("[data-next-event-preview]");
  const title = document.querySelector("[data-next-event-title]");
  const details = document.querySelector("[data-next-event-details]");
  if (!preview || !title || !details) return;

  const today = new Date().toISOString().slice(0, 10);
  const [nextEvent] = getEvents().filter((event) => event.date >= today);

  if (!nextEvent) {
    title.textContent = "More events coming soon";
    details.textContent = "Check the calendar again soon for the next SEORC event.";
    return;
  }

  title.textContent = nextEvent.title;
  details.textContent = `${formatDateParts(nextEvent.date).label} at ${nextEvent.location}. ${nextEvent.description}`;
}

function renderCalendarEvents(filter = "all") {
  const eventList = document.querySelector("[data-event-list]");

  if (!eventList) return;

  const today = new Date().toISOString().slice(0, 10);
  const events = getEvents().filter((event) => event.date >= today && (filter === "all" || (filter === "external" ? event.type.startsWith("external-") : event.type === filter)));
  eventList.innerHTML = "";

  if (!events.length) {
    eventList.innerHTML = '<p class="empty-state">No events match this filter yet.</p>';
    return;
  }

  events.forEach((event) => {
    const dateParts = formatDateParts(event.date);
    const item = document.createElement("article");
    item.className = "event-item";
    item.dataset.category = event.type;
    item.innerHTML = `
      <time datetime="${event.date}"><span>${dateParts.day}</span>${dateParts.month}</time>
      <div>
        <p class="event-type">${typeLabels[event.type]}</p>
        <h2>${escapeHTML(event.title)}</h2>
        <p>${locationMapLink(event.location)}. ${escapeHTML(event.description)}</p>
      </div>
      ${event.type.startsWith("external-") ? (event.event_settings?.provider_url ? `<a class="text-link" href="${escapeHTML(event.event_settings.provider_url)}" target="_blank" rel="noopener">Register</a>` : '<span class="field-note">Provider details coming soon.</span>') : `<a class="text-link" href="${registrationPageForType(event.type)}">Register</a>`}
    `;
    eventList.append(item);
  });
}

function populateEventSelects() {
  document.querySelectorAll("[data-event-select]").forEach((select) => {
    const type = select.dataset.eventSelect;
    const placeholder = select.querySelector("option[value='']")?.textContent || "Select event";
    const options = getEvents().filter((event) => event.type === type);

    select.innerHTML = `<option value="">${placeholder}</option>`;

    options.forEach((event) => {
      const dateParts = formatDateParts(event.date);
      const option = document.createElement("option");
      option.value = event.id;
      option.textContent = `${dateParts.label} - ${event.title}`;
      select.append(option);
    });
  });
}

const filterButtons = document.querySelectorAll("[data-filter]");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderCalendarEvents(filter);
  });
});

renderCalendarEvents();
renderNextEventPreview();
populateEventSelects();
loadSharedEvents();
enableOpenStreetMapLocationSearch();

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-member-lookup-button]");
  if (!button) return;
  const panel = button.closest("[data-member-lookup]");
  const form = button.closest("form");
  const number = panel?.querySelector("[name='membership-number']")?.value.trim();
  const email = panel?.querySelector("[name='membership-email']")?.value.trim();
  if (!number || !email || !form) { alert("Enter both your SEORC membership number and membership email."); return; }
  try {
    const rows = await requestSupabase("/rest/v1/rpc/lookup_member_for_event", { method: "POST", body: JSON.stringify({ member_number: number, member_email: email }) });
    const member = rows[0];
    if (!member) { alert("No membership matched that number and email."); return; }
    const prefix = panel.dataset.memberPrefix;
    const set = (name, value) => { const field = form.querySelector(`[name='${name}']`); if (field) field.value = value || ""; };
    set(`${prefix}-first-name`, member.first_name); set(`${prefix}-last-name`, member.last_name); set(`${prefix}-email`, member.email); set(`${prefix}-phone`, member.phone);
    set("riding-level", member.riding_level); alert("Member details filled in.");
  } catch (error) { alert(`Could not look up membership: ${error.message}`); }
});

async function loadClubSettings() {
  try {
    const settings = await requestSupabase("/rest/v1/club_settings?select=setting_key,membership_fee");
    const adultFee = Number(settings.find((setting) => setting.setting_key === "annual_membership_fee")?.membership_fee);
    const juniorFee = Number(settings.find((setting) => setting.setting_key === "junior_membership_fee")?.membership_fee);
    if (Number.isFinite(adultFee)) annualMembershipFee = adultFee;
    if (Number.isFinite(juniorFee)) juniorMembershipFee = juniorFee;
  } catch (error) {
    console.warn("Club pricing could not be loaded; using the standard fee.", error);
  }
  document.querySelectorAll("[data-annual-membership-form]").forEach(updateAnnualMembershipCost);
  document.querySelectorAll("[data-club-settings-form] [name='membership_fee']").forEach((input) => { input.value = annualMembershipFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='junior_membership_fee']").forEach((input) => { input.value = juniorMembershipFee.toFixed(2); });
}

loadClubSettings();

function getSelectedMembershipFee(form) {
  return form?.querySelector("[name='club-membership-type']")?.value === "junior" ? juniorMembershipFee : annualMembershipFee;
}

function updateAnnualMembershipCost(form) {
  if (!form) return;
  const isJunior = form.querySelector("[name='club-membership-type']")?.value === "junior";
  const fee = isJunior ? juniorMembershipFee : annualMembershipFee;
  form.dataset.calculatedTotal = String(fee);
  form.querySelectorAll("[data-annual-membership-label]").forEach((element) => { element.textContent = isJunior ? "Junior SEORC membership" : "Adult SEORC membership"; });
  form.querySelectorAll("[data-annual-membership-fee], [data-annual-membership-total]").forEach((element) => { element.textContent = formatCurrency(fee); });
}

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-membership-type]")) updateAnnualMembershipCost(event.target.closest("[data-annual-membership-form]"));
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-club-settings-form]");
  if (!form) return;
  event.preventDefault();
  const status = form.querySelector("[data-club-settings-status]");
  const formData = new FormData(form);
  const membershipFee = Number(formData.get("membership_fee"));
  const juniorFee = form.querySelector("[name='junior_membership_fee']") ? Number(formData.get("junior_membership_fee")) : juniorMembershipFee;
  try {
    await Promise.all([
      requestSupabase("/rest/v1/club_settings?setting_key=eq.annual_membership_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: membershipFee, updated_at: new Date().toISOString() }) }),
      requestSupabase("/rest/v1/club_settings?setting_key=eq.junior_membership_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: juniorFee, updated_at: new Date().toISOString() }) }),
    ]);
    annualMembershipFee = membershipFee;
    juniorMembershipFee = juniorFee;
    await loadClubSettings();
    status.textContent = "Membership fees saved.";
  } catch (error) { status.textContent = `Could not save membership fees: ${error.message}`; }
});

async function loadSharedMedia() {
  const gallery = document.querySelector("[data-shared-media-gallery]");
  const config = getSupabaseConfig();
  if (!gallery || !config) return;
  try {
    const assets = await requestSupabase("/rest/v1/media_assets?select=storage_path,object_path&published_at=not.is.null&order=created_at.desc");
    const builtInGallery = document.querySelector("[data-built-in-media]");
    if (builtInGallery && assets.length) builtInGallery.hidden = true;
    gallery.innerHTML = assets.map((asset) => {
      const path = asset.storage_path || asset.object_path;
      return path ? `<figure><img src="${escapeHTML(`${config.url}/storage/v1/object/public/club-media/${path}`)}" alt=""></figure>` : "";
    }).join("");
  } catch (error) { console.error("Shared media load failed:", error); }
}

loadSharedMedia();

async function loadHomepageMedia() {
  const config = getSupabaseConfig();
  if (!config || !document.querySelector("[data-homepage-slot]")) return;
  try {
    const assets = await requestSupabase("/rest/v1/media_assets?select=storage_path,object_path,homepage_slot&homepage_slot=not.is.null");
    assets.forEach((asset) => { const image = document.querySelector(`[data-homepage-slot="${CSS.escape(asset.homepage_slot)}"]`); const path = asset.storage_path || asset.object_path; if (image && path) image.src = `${config.url}/storage/v1/object/public/club-media/${path}`; });
  } catch (error) { console.error("Homepage media load failed:", error); }
}

loadHomepageMedia();

async function loadAchievedEventsPage() {
  const container = document.querySelector("[data-achieved-event-list]");
  const yearSummary = document.querySelector("[data-achieved-year-summary]");
  if (!container) return;
  try {
    const calendarYear = new Date().getFullYear();
    const [archived, registrations, completedEvents] = await Promise.all([
      requestSupabase("/rest/v1/achieved_events?select=*&order=event_date.desc"),
      fetchRegistrations().catch(() => []),
      requestSupabase(`/rest/v1/events?date=gte.${calendarYear}-01-01&date=lt.${calendarYear + 1}-01-01&select=type,date`).catch(() => []),
    ]);
    if (yearSummary) {
      const today = new Date().toISOString().slice(0, 10);
      const showCount = archived.filter((item) => item.event_date.startsWith(String(calendarYear)) && item.event_data?.type === "show").length;
      const clubCount = completedEvents.filter((event) => event.type === "club" && event.date < today).length;
      const clinicCount = completedEvents.filter((event) => event.type === "clinic" && event.date < today).length;
      yearSummary.innerHTML = `<dl class="show-extra-summary show-overview-summary"><div><dt>${calendarYear} club days</dt><dd>${clubCount}</dd></div><div><dt>${calendarYear} clinics</dt><dd>${clinicCount}</dd></div><div><dt>${calendarYear} shows</dt><dd>${showCount}</dd></div></dl>`;
    }
    container.innerHTML = archived.length ? `<div class="admin-data-table archived-event-overview-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Event</span><span role="columnheader">Date</span><span role="columnheader">Participants</span><span role="columnheader">Entries</span><span role="columnheader">Revenue</span></div>${archived.map((item) => {
      const event = item.event_data || {};
      const results = Array.isArray(item.results) ? item.results : [];
      const summary = event.archive_summary || {};
      const eventRegistrations = registrations.filter((registration) => getRegistrationEventId(registration) === item.event_id);
      const participants = summary.participants ?? (eventRegistrations.length || new Set(results.map((result) => result.participant_name).filter(Boolean)).size);
      const revenue = summary.revenue ?? getEventSummary({ registrations: eventRegistrations }).revenue;
      const dateLabel = formatDateParts(event.date || item.event_date).label;
      return `<div role="row" class="admin-table-row"><span role="cell"><a class="admin-table-title-link" href="archived-event.html?event=${encodeURIComponent(item.event_id)}"><strong>${escapeHTML(event.title || "SEORC event")}</strong><small>${escapeHTML(typeLabels[event.type] || "Achieved event")} · ${escapeHTML(event.location || "Location not recorded")}</small></a></span><span role="cell">${escapeHTML(dateLabel)}</span><span role="cell">${participants}</span><span role="cell">${results.length}</span><span role="cell">${formatCurrency(revenue)}</span></div>`;
    }).join("")}</div>` : '<p class="empty-state">No achieved events have been archived yet.</p>';
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Could not load achieved events.</p>';
    console.error("Achieved events load failed:", error);
  }
}

loadAchievedEventsPage();

async function loadArchivedEventPage() {
  const page = document.querySelector("[data-archived-event-page]");
  if (!page) return;
  const eventId = new URLSearchParams(window.location.search).get("event");
  const content = document.querySelector("[data-archived-event-content]");
  if (!eventId || !content) return;
  try {
    const rows = await requestSupabase(`/rest/v1/achieved_events?event_id=eq.${encodeURIComponent(eventId)}&select=*`);
    const archived = rows[0];
    if (!archived) throw new Error("Archived event not found");
    const event = archived.event_data || {};
    const results = Array.isArray(archived.results) ? archived.results : [];
    const pointsDownload = document.querySelector("[data-download-archived-points]");
    if (pointsDownload && event.type === "show") {
      pointsDownload.hidden = false;
      pointsDownload.onclick = () => downloadArchivedPointsCsv(event, results);
    }
    let registrations = [];
    try {
      registrations = (await fetchRegistrations()).filter((registration) => getRegistrationEventId(registration) === eventId);
    } catch (error) {
      console.warn("Archived event registration summary unavailable:", error);
    }
    const storedSummary = event.archive_summary || {};
    const participantTotal = storedSummary.participants ?? (registrations.length || new Set(results.map((result) => result.participant_name).filter(Boolean)).size);
    const horseTotal = storedSummary.horses ?? (registrations.length ? getShowHorseCount(registrations) : new Set(results.map((result) => result.horse_name).filter(Boolean)).size);
    const camperTotal = storedSummary.campers ?? registrations.filter((registration) => {
      const payload = registration.payload || {};
      return payload["camping-with-power"] === true || payload["camping-without-power"] === true;
    }).length;
    const dayMembershipTotal = storedSummary.day_memberships ?? registrations.filter(needsDayMembershipForm).length;
    const dinnerTicketTotal = storedSummary.dinner_tickets ?? registrations.reduce((total, registration) => total + getPayloadNumber(registration.payload || {}, "dinner-count"), 0);
    const revenue = storedSummary.revenue ?? getEventSummary({ registrations }).revenue;
    document.querySelector("[data-archived-event-title]").textContent = event.title || "Archived event";
    document.querySelector("[data-archived-event-summary]").textContent = `${formatDateParts(event.date || archived.event_date).label} | ${results.length} published results`;
    const classes = sortShowClassNames([...new Set(results.map((result) => result.class_name))]);
    const archivedSummary = `<dl class="show-extra-summary show-overview-summary"><div><dt>Judge</dt><dd>${escapeHTML(event.judge_name || "Not recorded")}</dd></div><div><dt>Participants</dt><dd>${participantTotal}</dd></div><div><dt>Horses</dt><dd>${horseTotal}</dd></div><div><dt>Campers</dt><dd>${camperTotal}</dd></div><div><dt>Day memberships</dt><dd>${dayMembershipTotal}</dd></div><div><dt>Dinner tickets</dt><dd>${dinnerTicketTotal}</dd></div><div><dt>Revenue</dt><dd>${formatCurrency(revenue)}</dd></div></dl>`;
    const cancellationNotice = event.cancelled_at ? `<section class="cancellation-notice"><strong>Cancelled</strong><p>${escapeHTML(event.cancellation_notice || "This event was cancelled.")}</p></section>` : "";
    content.innerHTML = cancellationNotice + archivedSummary + (classes.length ? classes.map((className) => { const classResults = results.filter((result) => result.class_name === className).sort((a, b) => (a.result_place || 999) - (b.result_place || 999)); return `<section class="show-class-panel"><div class="form-heading"><p class="eyebrow">Archived class</p><h2>${escapeHTML(className)}</h2></div><div class="admin-data-table show-class-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Rank</span><span role="columnheader">Participant</span><span role="columnheader">Horse</span><span role="columnheader">Points</span><span role="columnheader">Status</span></div>${classResults.map((result) => `<div role="row" class="admin-table-row"><span role="cell">${escapeHTML(String(result.result_place || "—"))}</span><span role="cell">${escapeHTML(result.participant_name)}</span><span role="cell">${escapeHTML(result.horse_name)}</span><span role="cell">${escapeHTML(formatPoints(getShowResultPoints(result)))}</span><span role="cell">${result.scratched ? "Scratched" : "Complete"}</span></div>`).join("")}</div></section>`; }).join("") : '<p class="empty-state">No published class results were stored with this event.</p>');
  } catch (error) { content.innerHTML = '<p class="empty-state">Could not load this archived event.</p>'; }
}

loadArchivedEventPage();

function downloadArchivedPointsCsv(event, results) {
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const eventDate = event.date ? formatDateParts(event.date).label : "Not recorded";
  const rows = [["Event date", "Class", "Entries", "Place", "Rider", "Horse", "Points"]];
  sortShowClassNames([...new Set(results.map((result) => result.class_name))]).forEach((className) => {
    const classResults = results.filter((result) => result.class_name === className);
    classResults.filter((result) => Number(result.result_place) >= 1 && Number(result.result_place) <= 4)
      .sort((a, b) => Number(a.result_place) - Number(b.result_place))
      .forEach((result) => rows.push([eventDate, className, classResults.length, result.result_place, result.participant_name, result.horse_name, getShowResultPoints(result)]));
  });
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${String(event.title || "show").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-points.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

const mediaPhotos = [
  {
    src: "assets/training-platform-rider.jpg",
    alt: "A rider guiding a paint horse across a raised platform obstacle",
  },
  {
    src: "assets/pole-bending-rider.jpg",
    alt: "A rider steering a horse through pole obstacles on grass",
  },
  {
    src: "assets/groundwork-obstacle-day.jpg",
    alt: "A handler leading a horse through an outdoor obstacle course",
  },
  {
    src: "assets/show-ring-rider.jpg",
    alt: "A rider in festive dress waving from horseback in an arena",
  },
];

function renderAdminEventList() {
  const adminEventList = document.querySelector("[data-admin-event-list]");

  if (!adminEventList) return;

  const events = getEvents().sort((a, b) => a.date.localeCompare(b.date));
  adminEventList.innerHTML = "";

  if (!events.length) {
    adminEventList.innerHTML = '<p class="empty-state">No admin-added events yet.</p>';
    return;
  }

  events.forEach((event) => {
    const dateParts = formatDateParts(event.date);
    const item = document.createElement("article");
    item.className = "admin-event-item";
    item.innerHTML = `
      <div>
        <p class="event-type">${typeLabels[event.type]}</p>
        <h3>${escapeHTML(event.title)}</h3>
        <p>${dateParts.label} at ${escapeHTML(event.location)}</p>
      </div>
      <button class="button secondary" type="button" data-delete-shared-event="${event.id}">Delete</button>
    `;
    adminEventList.append(item);
  });
}

function getSupabaseConfig() {
  return window.SEORC_SUPABASE || null;
}

function getAdminAccessToken() {
  try {
    return JSON.parse(localStorage.getItem(adminSessionStorageKey) || "null")?.access_token || null;
  } catch {
    return null;
  }
}

async function getFreshAccessToken(storageKey) {
  const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
  const config = getSupabaseConfig();
  if (!stored?.access_token || !config) return null;
  const expiresAt = Number(stored.expires_at || 0) * 1000;
  if (expiresAt > Date.now() + 60_000) return stored.access_token;
  if (!stored.refresh_token) return null;
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: stored.refresh_token }) });
  if (!response.ok) return null;
  const refreshed = await response.json();
  localStorage.setItem(storageKey, JSON.stringify(refreshed));
  return refreshed.access_token;
}

async function getFreshAdminAccessToken() { return getFreshAccessToken(adminSessionStorageKey); }
async function getFreshJudgeAccessToken() { return getFreshAccessToken(judgeSessionStorageKey); }

function formatDateTime(value) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function humanizeFieldName(value) {
  return String(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderRegistrationList(registrations) {
  const registrationList = document.querySelector("[data-registration-list]");

  if (!registrationList) return;

  registrationList.innerHTML = "";

  if (!registrations.length) {
    registrationList.innerHTML = '<p class="empty-state">No registration submissions yet.</p>';
    return;
  }

  registrations.forEach((registration) => {
    const payload = registration.payload || {};
    const item = document.createElement("article");
    item.className = "registration-item";
    item.innerHTML = `
      <div class="registration-item-heading">
        <div>
          <p class="event-type">${registrationFormLabels[registration.form_type] || humanizeFieldName(registration.form_type)}</p>
          <h3>${formatDateTime(registration.created_at)}</h3>
        </div>
        <span>${escapeHTML(registration.page_path || "")}</span>
      </div>
      <dl>
        ${Object.entries(payload)
          .map(([key, value]) => `
            <div>
              <dt>${escapeHTML(humanizeFieldName(key))}</dt>
              <dd>${escapeHTML(value === true ? "Yes" : value === false ? "No" : value || "Not supplied")}</dd>
            </div>
          `)
          .join("")}
      </dl>
    `;
    registrationList.append(item);
  });
}

function getRegistrationEventId(registration) {
  const payload = registration.payload || {};

  if (registration.form_type === "club_membership") {
    return "club-members";
  }

  return payload["show-date"] || payload["club-date"] || payload["clinic-date"] || payload["event-id"] || "unknown-event";
}

function getEventDetails(eventId) {
  if (eventId === "club-members") {
    return {
      id: eventId,
      type: "membership",
      date: "",
      title: "Club Members",
      location: "SEORC",
      description: "Submitted club membership forms.",
    };
  }

  const event = getEvents().find((item) => item.id === eventId);

  if (event) return event;

  return {
    id: eventId,
    type: "club",
    date: "",
    title: eventId === "unknown-event" ? "Unknown Event" : humanizeFieldName(eventId),
    location: "Not supplied",
    description: "",
  };
}

function getParticipantName(registration) {
  const payload = registration.payload || {};
  const firstName = payload["participant-first-name"] || payload["clinic-first-name"] || payload["club-day-first-name"] || payload["club-first-name"];
  const lastName = payload["participant-last-name"] || payload["clinic-last-name"] || payload["club-day-last-name"] || payload["club-last-name"];
  const showName = payload["show-rider-name"];

  return [firstName, lastName].filter(Boolean).join(" ") || showName || "Name not supplied";
}

function getRegistrationHorseNames(registration) {
  const payload = registration.payload || {};
  const names = Object.entries(payload)
    .filter(([key, value]) => key.match(/^horse-\d+-name$/) && value)
    .map(([, value]) => value);

  if (payload["club-day-horse-name"]) {
    names.push(payload["club-day-horse-name"]);
  }
  if (payload["clinic-horse-name"]) names.push(payload["clinic-horse-name"]);

  return names.length ? names.join(", ") : "Not supplied";
}

function getPayloadNumber(payload, key) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : 0;
}

function needsDayMembershipForm(registration) {
  const payload = registration.payload || {};

  if (registration.form_type === "show_registration") {
    return payload["aeora-day-membership"] === true || payload["aeora-membership"] === "day";
  }

  if (registration.form_type === "club_day_registration") {
    return payload["club-day-day-membership"] === true || payload["club-day-aeora-member"] === false;
  }

  if (registration.form_type === "clinic_registration") return payload["clinic-day-membership"] === true;

  return false;
}

function getRegistrationRevenue(registration) {
  const payload = registration.payload || {};
  const calculatedTotal = Number(payload["calculated-total"]);
  const dayMembershipTotal = needsDayMembershipForm(registration) ? defaultDayMembershipFee : 0;

  if (Number.isFinite(calculatedTotal) && calculatedTotal > 0) {
    return calculatedTotal;
  }

  if (registration.form_type === "club_day_registration" && payload["club-day-paid"] === true) {
    return defaultClubDayFee + dayMembershipTotal;
  }

  return dayMembershipTotal;
}

function groupRegistrationsByEvent(registrations) {
  return registrations.reduce((groups, registration) => {
    const eventId = getRegistrationEventId(registration);

    if (!groups[eventId]) {
      groups[eventId] = {
        event: getEventDetails(eventId),
        registrations: [],
      };
    }

    groups[eventId].registrations.push(registration);
    return groups;
  }, {});
}

function getEventSummary(group) {
  const attendees = group.registrations.length;
  const dayMembershipForms = group.registrations.filter(needsDayMembershipForm).length;
  const revenue = group.registrations.reduce((total, registration) => total + getRegistrationRevenue(registration), 0);

  return { attendees, dayMembershipForms, revenue };
}

function getShowClassNameFromField(fieldName) {
  const slug = fieldName.replace(/^horse-\d+-class-/, "");
  return humanizeFieldName(slug);
}

function readShowOrder() {
  try {
    return JSON.parse(localStorage.getItem(showOrderStorageKey)) || {};
  } catch {
    return {};
  }
}

function writeShowOrder(order) {
  localStorage.setItem(showOrderStorageKey, JSON.stringify(order));
}

function getRegistrationId(registration) {
  return registration.id || `${registration.form_type}-${registration.created_at}-${getParticipantName(registration)}`;
}

function getShowHorseCount(registrations) {
  return registrations.reduce((total, registration) => {
    const payload = registration.payload || {};
    const horseNames = Object.entries(payload).filter(([key, value]) => key.match(/^horse-\d+-name$/) && value);
    return total + horseNames.length;
  }, 0);
}

function getShowClassEntries(eventId, registrations) {
  const order = readShowOrder();
  const classGroups = {};

  registrations.forEach((registration) => {
    const payload = registration.payload || {};
    const participant = getParticipantName(registration);

    Object.entries(payload).forEach(([key, value]) => {
      if (!key.match(/^horse-\d+-class-/) || value !== true) return;

      const horseNumber = key.match(/^horse-(\d+)-class-/)?.[1];
      const className = getShowClassNameFromField(key);
      const groupKey = `${eventId}:${className}`;
      const horseName = payload[`horse-${horseNumber}-name`] || "Horse not supplied";

      classGroups[className] ||= [];
      classGroups[className].push({
        id: `${getRegistrationId(registration)}:${horseNumber}:${className}`,
        participant,
        horseName,
        ridingClass: payload["riding-level"] || payload["riding-class"] || "Not supplied",
      });

      order[groupKey] ||= classGroups[className].map((entry) => entry.id);
    });
  });

  Object.entries(classGroups).forEach(([className, entries]) => {
    const groupKey = `${eventId}:${className}`;
    const savedOrder = order[groupKey] || [];
    classGroups[className] = entries.sort((a, b) => {
      const aIndex = savedOrder.indexOf(a.id);
      const bIndex = savedOrder.indexOf(b.id);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  });

  return classGroups;
}

function getShowClassEntriesForClass(eventId, className, registrations) {
  const eventRegistrations = registrations.filter((registration) => getRegistrationEventId(registration) === eventId);
  return getShowClassEntries(eventId, eventRegistrations)[className] || [];
}

function getShowClassGroupsWithResults(eventId, registrations, results = []) {
  const eventRegistrations = registrations.filter((registration) => getRegistrationEventId(registration) === eventId);
  const classGroups = getShowClassEntries(eventId, eventRegistrations);
  const existingEntryIds = new Set(Object.values(classGroups).flat().map((entry) => entry.id));

  results
    .filter((result) => result.event_id === eventId && !existingEntryIds.has(result.entry_id))
    .forEach((result) => {
      classGroups[result.class_name] ||= [];
      classGroups[result.class_name].push({
        id: result.entry_id,
        participant: result.participant_name,
        horseName: result.horse_name,
        ridingClass: result.riding_class || "Added manually",
        isManual: true,
      });
    });

  const savedShowOrder = readShowOrder();

  Object.entries(classGroups).forEach(([className, entries]) => {
    const savedOrder = savedShowOrder[`${eventId}:${className}`] || [];
    classGroups[className] = entries.sort((a, b) => {
      const aIndex = savedOrder.indexOf(a.id);
      const bIndex = savedOrder.indexOf(b.id);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  });

  return classGroups;
}

function normalizeResultEntry(entry, result = {}) {
  return {
    entryId: entry.id,
    participant: result.participant_name || entry.participant,
    horseName: result.horse_name || entry.horseName,
    ridingClass: result.riding_class || entry.ridingClass || "",
    obstacleScores: result.obstacle_scores || {},
    timingSeconds: result.timing_seconds ?? "",
    scratched: result.scratched === true,
    placing: result.result_place ?? null,
    processedAt: result.processed_at || null,
    publishedAt: result.published_at || null,
    resultId: result.id || null,
    isManual: entry.isManual === true,
  };
}

function getObstacleScoreTotal(entry) {
  return Array.from({ length: showObstacleCount }, (_, index) => {
    const score = Number(entry.obstacleScores?.[`obstacle-${index + 1}`]);
    return Number.isFinite(score) ? score : 0;
  }).reduce((total, score) => total + score, 0);
}

function getTimingValue(entry) {
  if (entry.timingSeconds === "" || entry.timingSeconds === null || entry.timingSeconds === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  const timing = Number(entry.timingSeconds);
  return Number.isFinite(timing) ? timing : Number.POSITIVE_INFINITY;
}

function formatTiming(timingSeconds) {
  if (timingSeconds === "" || timingSeconds === null || timingSeconds === undefined) return "No time";

  const timing = Number(timingSeconds);

  if (!Number.isFinite(timing)) return "No time";

  const totalSeconds = Math.round(timing);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function hasMissingTiming(entries) {
  return entries.some((entry) => !entry.scratched && getTimingValue(entry) === Number.POSITIVE_INFINITY);
}

function hasProcessedResults(entries) {
  return entries.some((entry) => entry.processedAt || entry.placing);
}

function getRankedResults(entries) {
  return [...entries].sort((a, b) => {
    if (a.scratched !== b.scratched) return a.scratched ? 1 : -1;

    const scoreDifference = getObstacleScoreTotal(b) - getObstacleScoreTotal(a);
    if (scoreDifference !== 0) return scoreDifference;

    return getTimingValue(a) - getTimingValue(b);
  });
}

function getPointsPageYear() {
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));

  return Number.isInteger(year) && year > 2000 ? year : new Date().getFullYear();
}

function getShowResultYear(result) {
  const event = getEventDetails(result.event_id);
  const dateSource = event.date || result.processed_at || result.created_at || "";

  return Number(String(dateSource).slice(0, 4));
}

function getShowResultPoints(result) {
  if (result.points !== undefined) return Number(result.points) || 0;
  return getObstacleScoreTotal({ obstacleScores: result.obstacle_scores || {} });
}

function formatPoints(points) {
  const value = Number(points);

  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

async function loadProfitLossPage() {
  const page = document.querySelector("[data-pl-report]");
  const content = document.querySelector("[data-pl-content]");
  const summary = document.querySelector("[data-pl-summary]");
  const yearSelect = document.querySelector("[data-pl-financial-year]");
  if (!page || !content) return;
  try {
    const [eventYears, clubYears, otherIncomeYears, membershipYears] = await Promise.all([
      requestSupabase("/rest/v1/event_pl?select=financial_year"),
      requestSupabase("/rest/v1/club_expenses?select=financial_year"),
      requestSupabase("/rest/v1/other_income?select=financial_year"),
      requestSupabase("/rest/v1/membership_renewals?select=financial_year"),
    ]);
    const financialYears = [...new Set([...eventYears, ...clubYears, ...otherIncomeYears, ...membershipYears].map((row) => row.financial_year))].sort().reverse();
    const fallbackYear = (() => { const date = new Date(); const startYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1; return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`; })();
    if (yearSelect && !yearSelect.options.length) {
      yearSelect.innerHTML = (financialYears.length ? financialYears : [fallbackYear]).map((year) => `<option value="${escapeHTML(year)}">${escapeHTML(year)}</option>`).join("");
      yearSelect.addEventListener("change", loadProfitLossPage);
    }
    const financialYear = yearSelect?.value || financialYears[0] || fallbackYear;
    const [events, clubExpenses, otherIncome, membershipRenewals] = await Promise.all([
      requestSupabase(`/rest/v1/event_pl?financial_year=eq.${financialYear}&select=*&order=event_date.desc`),
      requestSupabase(`/rest/v1/club_expenses?financial_year=eq.${financialYear}&select=*&order=date_incurred.desc`),
      requestSupabase(`/rest/v1/other_income?financial_year=eq.${financialYear}&select=*&order=date_received.desc`),
      requestSupabase(`/rest/v1/membership_renewals?financial_year=eq.${financialYear}&paid_at=not.is.null&select=amount`),
    ]);
    const income = events.reduce((total, event) => total + Number(event.income || 0), 0);
    const eventExpenses = events.reduce((total, event) => total + Number(event.expenses || 0), 0);
    const sharedExpenses = clubExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const otherIncomeTotal = otherIncome.reduce((total, item) => total + Number(item.amount || 0), 0);
    const membershipIncome = membershipRenewals.reduce((total, renewal) => total + Number(renewal.amount || 0), 0);
    const totalIncome = income + otherIncomeTotal + membershipIncome;
    window.currentProfitLoss = { financialYear, events, income: totalIncome, eventExpenses, sharedExpenses };
    if (summary) summary.textContent = `${financialYear} financial year`;
    content.innerHTML = `<dl class="show-extra-summary show-overview-summary"><div><dt>Event income</dt><dd>${formatCurrency(income)}</dd></div><div><dt>Membership income</dt><dd>${formatCurrency(membershipIncome)}</dd></div><div><dt>Other income</dt><dd>${formatCurrency(otherIncomeTotal)}</dd></div><div><dt>Event expenses</dt><dd>${formatCurrency(eventExpenses)}</dd></div><div><dt>Club expenses</dt><dd>${formatCurrency(sharedExpenses)}</dd></div><div><dt>Net profit</dt><dd>${formatCurrency(totalIncome - eventExpenses - sharedExpenses)}</dd></div></dl><section class="show-class-panel"><div class="form-heading"><p class="eyebrow">Events</p><h2>Event Profit &amp; Loss</h2></div><div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Event</span><span role="columnheader">Income</span><span role="columnheader">Expenses</span><span role="columnheader">Profit</span></div>${events.map((event) => `<div role="row" class="admin-table-row"><span role="cell"><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(formatDateParts(event.event_date).label)}</small></span><span role="cell">${formatCurrency(event.income)}</span><span role="cell">${formatCurrency(event.expenses)}</span><span role="cell">${formatCurrency(event.profit)}</span></div>`).join("") || '<p class="empty-state">No events in this financial year yet.</p>'}</div></section>`;
  } catch (error) { content.innerHTML = '<p class="empty-state">Could not load the Profit &amp; Loss report.</p>'; }
}

loadProfitLossPage();

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-pl-pdf]") || !window.currentProfitLoss || !window.jspdf) return;
  const { financialYear, events, income, eventExpenses, sharedExpenses } = window.currentProfitLoss;
  const pdf = new window.jspdf.jsPDF();
  pdf.setFontSize(18); pdf.text("Shoalhaven Extreme Obstacle Racing Club", 14, 18);
  pdf.setFontSize(14); pdf.text(`Profit & Loss | ${financialYear}`, 14, 27);
  let y = 40;
  events.forEach((item) => { pdf.setFontSize(10); pdf.text(`${item.title} | Income ${formatCurrency(item.income)} | Costs ${formatCurrency(item.expenses)} | Profit ${formatCurrency(item.profit)}`, 14, y); y += 8; });
  y += 6; pdf.setFontSize(12); pdf.text(`Income: ${formatCurrency(income)}   Event costs: ${formatCurrency(eventExpenses)}   Club costs: ${formatCurrency(sharedExpenses)}   Net: ${formatCurrency(income - eventExpenses - sharedExpenses)}`, 14, y);
  pdf.save(`seorc-profit-loss-${financialYear}.pdf`);
});

async function loadEventExpensePage() {
  const form = document.querySelector("[data-event-expense-form]");
  const select = document.querySelector("[data-expense-event]");
  const list = document.querySelector("[data-event-expense-list]");
  if (!form || !select) return;
  const events = await requestSupabase("/rest/v1/events?select=id,title,date&order=date.desc");
  select.innerHTML = events.map((event) => `<option value="${escapeHTML(event.id)}">${escapeHTML(event.title)} — ${escapeHTML(event.date)}</option>`).join("");
  form.querySelector("[name='date_incurred']").value = new Date().toISOString().slice(0, 10);
  const renderExpenses = async () => {
    if (!list || !select.value) return;
    const expenses = await requestSupabase(`/rest/v1/event_expenses?event_id=eq.${encodeURIComponent(select.value)}&select=*&order=date_incurred.desc`);
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    list.innerHTML = `<div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Description</span><span role="columnheader">Date</span><span role="columnheader">Amount</span><span role="columnheader">Action</span></div>${expenses.map((expense) => `<div role="row" class="admin-table-row"><span role="cell">${escapeHTML(expense.description)}</span><span role="cell">${escapeHTML(formatDateParts(expense.date_incurred).label)}</span><span role="cell">${formatCurrency(expense.amount)}</span><span role="cell"><button class="button secondary compact-button" type="button" data-delete-pl-entry="event_expenses" data-entry-id="${escapeHTML(expense.id)}">Remove</button></span></div>`).join("") || '<p class="empty-state">No costs recorded for this event.</p>'}</div><p class="field-note"><strong>Total costs: ${formatCurrency(total)}</strong></p>`;
  };
  select.addEventListener("change", renderExpenses);
  form.addEventListener("submit", async (event) => { event.preventDefault(); const status = form.querySelector("[data-expense-status]"); const data = Object.fromEntries(new FormData(form)); try { await requestSupabase("/rest/v1/event_expenses", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...data, amount: Number(data.amount) }) }); form.querySelector("[name='description']").value = ""; form.querySelector("[name='amount']").value = ""; status.textContent = "Cost saved."; await renderExpenses(); } catch (error) { status.textContent = `Could not save cost: ${error.message}`; } });
  await renderExpenses();
}

loadEventExpensePage();

async function loadClubExpensePage() {
  const form = document.querySelector("[data-club-expense-form]");
  const list = document.querySelector("[data-club-expense-list]");
  if (!form || !list) return;
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  const financialYear = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  form.querySelector("[name='date_incurred']").value = today.toISOString().slice(0, 10);
  const renderCosts = async () => {
    const costs = await requestSupabase(`/rest/v1/club_expenses?financial_year=eq.${financialYear}&select=*&order=date_incurred.desc`);
    const total = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
    list.innerHTML = `<div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Description</span><span role="columnheader">Date</span><span role="columnheader">Amount</span><span role="columnheader">Action</span></div>${costs.map((cost) => `<div role="row" class="admin-table-row"><span role="cell">${escapeHTML(cost.description)}</span><span role="cell">${escapeHTML(formatDateParts(cost.date_incurred).label)}</span><span role="cell">${formatCurrency(cost.amount)}</span><span role="cell"><button class="button secondary compact-button" type="button" data-delete-pl-entry="club_expenses" data-entry-id="${escapeHTML(cost.id)}">Remove</button></span></div>`).join("") || '<p class="empty-state">No shared club costs recorded for this financial year.</p>'}</div><p class="field-note"><strong>Total club costs: ${formatCurrency(total)}</strong></p>`;
  };
  form.addEventListener("submit", async (event) => { event.preventDefault(); const status = form.querySelector("[data-club-expense-status]"); const data = Object.fromEntries(new FormData(form)); try { await requestSupabase("/rest/v1/club_expenses", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...data, amount: Number(data.amount), financial_year: financialYear }) }); form.querySelector("[name='description']").value = ""; form.querySelector("[name='amount']").value = ""; status.textContent = "Club cost saved."; await renderCosts(); } catch (error) { status.textContent = `Could not save club cost: ${error.message}`; } });
  await renderCosts();
}

loadClubExpensePage();

async function loadPastProfitLossPage() {
  const list = document.querySelector("[data-past-pl-list]");
  if (!list) return;
  try {
    const archives = await requestSupabase("/rest/v1/financial_year_pl_archives?select=*&order=financial_year.desc");
    list.innerHTML = archives.length ? `<div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Financial year</span><span role="columnheader">Net profit</span><span role="columnheader">Download</span></div>${archives.map((archive) => { const r = archive.report || {}; const net = Number(r.event_income || 0) + Number(r.membership_income || 0) + Number(r.other_income || 0) - Number(r.event_expenses || 0) - Number(r.club_expenses || 0); return `<div role="row" class="admin-table-row"><span role="cell"><strong>${escapeHTML(archive.financial_year)}</strong></span><span role="cell">${formatCurrency(net)}</span><span role="cell"><button class="button secondary form-submit" type="button" data-download-past-pl='${escapeHTML(JSON.stringify(archive).replace(/'/g, "&#39;"))}'>Download PDF</button></span></div>`; }).join("")}</div>` : '<p class="empty-state">No completed financial-year P&amp;L reports have been archived yet.</p>';
  } catch (error) { list.innerHTML = '<p class="empty-state">Could not load past P&amp;L reports.</p>'; }
}
loadPastProfitLossPage();

async function loadOtherIncomePage() {
  const form = document.querySelector("[data-other-income-form]"); const list = document.querySelector("[data-other-income-list]");
  if (!form || !list) return;
  const now = new Date(); const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; const fy = `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  form.querySelector("[name='date_received']").value = now.toISOString().slice(0, 10);
  const render = async () => { const rows = await requestSupabase(`/rest/v1/other_income?financial_year=eq.${fy}&select=*&order=date_received.desc`); const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0); list.innerHTML = `<div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Description</span><span role="columnheader">Date</span><span role="columnheader">Amount</span><span role="columnheader">Action</span></div>${rows.map((row) => `<div role="row" class="admin-table-row"><span role="cell">${escapeHTML(row.description)}</span><span role="cell">${escapeHTML(formatDateParts(row.date_received).label)}</span><span role="cell">${formatCurrency(row.amount)}</span><span role="cell"><button class="button secondary compact-button" type="button" data-delete-pl-entry="other_income" data-entry-id="${escapeHTML(row.id)}">Remove</button></span></div>`).join("") || '<p class="empty-state">No other income recorded for this financial year.</p>'}</div><p class="field-note"><strong>Total other income: ${formatCurrency(total)}</strong></p>`; };
  form.addEventListener("submit", async (event) => { event.preventDefault(); const status = form.querySelector("[data-other-income-status]"); const data = Object.fromEntries(new FormData(form)); try { await requestSupabase("/rest/v1/other_income", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...data, amount: Number(data.amount), financial_year: fy }) }); form.querySelector("[name='description']").value = ""; form.querySelector("[name='amount']").value = ""; status.textContent = "Income saved."; await render(); } catch (error) { status.textContent = `Could not save income: ${error.message}`; } });
  await render();
}
loadOtherIncomePage();

async function loadMembershipRenewalsPage() {
  const container = document.querySelector("[data-membership-renewals]"); if (!container) return;
  try {
    const members = await requestSupabase("/rest/v1/members?select=*,membership_renewals(id,financial_year,amount,membership_type,paid_at,created_at)&order=last_name.asc,first_name.asc");
    container.innerHTML = members.length ? `<div class="admin-data-table memberships-table" role="table"><div role="row" class="admin-table-header"><span>Member</span><span>Membership number</span><span>Contact</span><span>Type</span><span>Riding level</span><span>Renewal</span><span>Payment</span></div>${members.flatMap((member) => {
      const renewals = [...(member.membership_renewals || [])].sort((a, b) => String(b.financial_year).localeCompare(String(a.financial_year)));
      const rows = renewals.length ? renewals : [null];
      return rows.map((renewal, index) => `<div role="row" class="admin-table-row"><span role="cell">${index === 0 ? `<a class="admin-table-title-link" href="membership-detail.html?member=${encodeURIComponent(member.id)}"><strong>${escapeHTML(`${member.first_name} ${member.last_name}`)}</strong></a>` : ""}</span><span role="cell">${index === 0 ? escapeHTML(member.membership_number) : ""}</span><span role="cell">${index === 0 ? `${escapeHTML(member.email)}<small>${escapeHTML(member.phone || "No phone supplied")}</small>` : ""}</span><span role="cell">${escapeHTML(humanizeFieldName(renewal?.membership_type || member.membership_type || "adult"))}</span><span role="cell">${index === 0 ? escapeHTML(member.riding_level || "Not supplied") : ""}</span><span role="cell">${renewal ? `${escapeHTML(renewal.financial_year)}<small>${formatCurrency(renewal.amount)}</small>` : "No renewal yet"}</span><span role="cell">${renewal ? (renewal.paid_at ? `<button class="button secondary compact-button" data-mark-membership-unpaid="${renewal.id}">Undo paid</button>` : `<button class="button secondary form-submit" data-mark-membership-paid="${renewal.id}">Mark paid</button>`) : ""}</span></div>`);
    }).join("")}</div>` : '<p class="empty-state">No members have registered yet.</p>';
  } catch (error) { container.innerHTML = '<p class="empty-state">Could not load memberships.</p>'; }
}
loadMembershipRenewalsPage();
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-mark-membership-paid]"); if (!button) return; await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(button.dataset.markMembershipPaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: new Date().toISOString() }) }); await loadMembershipRenewalsPage(); });

document.addEventListener("click", async (event) => { const button = event.target.closest("[data-mark-membership-unpaid]"); if (!button || !window.confirm("Mark this membership renewal as unpaid?")) return; await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(button.dataset.markMembershipUnpaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: null }) }); await loadMembershipRenewalsPage(); });

function memberDetailLine(label, value) {
  return `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value || "Not supplied")}</dd></div>`;
}

function getCurrentMembershipRenewal(member) {
  return [...(member?.membership_renewals || [])].sort((a, b) => String(b.financial_year).localeCompare(String(a.financial_year)))[0] || null;
}

function renderMembershipDetail(member) {
  const container = document.querySelector("[data-member-detail]");
  const title = document.querySelector("[data-member-detail-title]");
  const summary = document.querySelector("[data-member-detail-summary]");
  if (!container) return;
  const renewal = getCurrentMembershipRenewal(member);
  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Member";
  if (title) title.textContent = memberName;
  if (summary) summary.textContent = `${member.membership_number} | ${humanizeFieldName(member.membership_type || "adult")} member`;
  const emergencyName = [member.emergency_first_name, member.emergency_last_name].filter(Boolean).join(" ");
  container.innerHTML = `
    <div class="admin-actions">
      <a class="button secondary form-submit" href="memberships.html">Back to Memberships</a>
      <button class="button primary form-submit" type="button" data-edit-member-detail>Edit details</button>
      ${renewal ? (renewal.paid_at ? `<button class="button secondary form-submit" type="button" data-member-detail-unpaid="${escapeHTML(renewal.id)}">Mark unpaid</button>` : `<button class="button secondary form-submit" type="button" data-member-detail-paid="${escapeHTML(renewal.id)}">Mark paid</button>`) : ""}
      <button class="button secondary form-submit" type="button" data-delete-member="${escapeHTML(member.id)}">Delete member</button>
    </div>
    <section class="show-class-panel">
      <div class="form-heading">
        <p class="eyebrow">Membership details</p>
        <h2>${escapeHTML(member.membership_number)}</h2>
      </div>
      <dl class="show-extra-summary member-detail-summary">
        ${memberDetailLine("Membership type", humanizeFieldName(member.membership_type || "adult"))}
        ${memberDetailLine("Current renewal", renewal ? `${renewal.financial_year} · ${formatCurrency(renewal.amount)} · ${renewal.paid_at ? "Paid" : "Unpaid"}` : "No renewal recorded")}
        ${memberDetailLine("Email", member.email)}
        ${memberDetailLine("Phone", member.phone)}
        ${memberDetailLine("Birthday", member.birthday ? formatDateParts(member.birthday).label : "")}
        ${memberDetailLine("Address", member.address)}
        ${memberDetailLine("Riding level", member.riding_level)}
        ${memberDetailLine("Horse level", member.horse_level)}
        ${memberDetailLine("Emergency contact", emergencyName)}
        ${memberDetailLine("Emergency phone", member.emergency_phone)}
        ${memberDetailLine("Email notifications", member.email_notifications ? "Yes" : "No")}
      </dl>
    </section>
    <form class="form-panel" data-member-detail-form data-member-id="${escapeHTML(member.id)}" hidden>
      <div class="form-heading"><p class="eyebrow">Edit member</p><h2>Update membership details</h2></div>
      <div class="form-grid">
        <label>Membership type<select name="membership_type"><option value="adult"${member.membership_type === "adult" ? " selected" : ""}>Adult</option><option value="junior"${member.membership_type === "junior" ? " selected" : ""}>Junior</option></select></label>
        <label>First name<input name="first_name" value="${escapeHTML(member.first_name || "")}" required></label>
        <label>Last name<input name="last_name" value="${escapeHTML(member.last_name || "")}" required></label>
        <label>Email<input name="email" type="email" value="${escapeHTML(member.email || "")}" required></label>
        <label>Phone<input name="phone" type="tel" value="${escapeHTML(member.phone || "")}"></label>
        <label>Birthday<input name="birthday" type="date" value="${escapeHTML(member.birthday || "")}"></label>
        <label>Address<input name="address" value="${escapeHTML(member.address || "")}"></label>
        <label>Riding level<select name="riding_level"><option value="">Not supplied</option>${["Professional", "Experienced", "Intermediate", "Novice"].map((level) => `<option value="${level}"${member.riding_level === level ? " selected" : ""}>${level}</option>`).join("")}</select></label>
        <label>Horse level<select name="horse_level"><option value="">Not supplied</option>${["Experienced", "Novice", "Green"].map((level) => `<option value="${level}"${member.horse_level === level ? " selected" : ""}>${level}</option>`).join("")}</select></label>
        <label>Emergency first name<input name="emergency_first_name" value="${escapeHTML(member.emergency_first_name || "")}"></label>
        <label>Emergency last name<input name="emergency_last_name" value="${escapeHTML(member.emergency_last_name || "")}"></label>
        <label>Emergency phone<input name="emergency_phone" type="tel" value="${escapeHTML(member.emergency_phone || "")}"></label>
      </div>
      <label class="check-row"><input name="email_notifications" type="checkbox"${member.email_notifications ? " checked" : ""}><span>Email notifications</span></label>
      <div class="admin-actions"><button class="button primary form-submit" type="submit">Save member details</button><button class="button secondary form-submit" type="button" data-cancel-member-detail-edit>Cancel</button></div>
      <p class="form-status" data-member-detail-status></p>
    </form>
  `;
}

async function loadMembershipDetailPage() {
  const container = document.querySelector("[data-member-detail]");
  if (!container) return;
  const memberId = new URLSearchParams(window.location.search).get("member");
  if (!memberId) {
    container.innerHTML = '<p class="empty-state">No member was selected.</p>';
    return;
  }
  try {
    const rows = await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(memberId)}&select=*,membership_renewals(id,financial_year,amount,membership_type,paid_at,created_at,registration_id)`);
    const member = rows[0];
    if (!member) throw new Error("Member not found");
    renderMembershipDetail(member);
  } catch (error) {
    container.innerHTML = `<p class="empty-state">Could not load member details: ${escapeHTML(error.message)}</p>`;
  }
}

loadMembershipDetailPage();

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-member-detail]");
  if (editButton) {
    document.querySelector("[data-member-detail-form]")?.removeAttribute("hidden");
    editButton.setAttribute("hidden", "");
    return;
  }
  const cancelButton = event.target.closest("[data-cancel-member-detail-edit]");
  if (cancelButton) {
    document.querySelector("[data-member-detail-form]")?.setAttribute("hidden", "");
    document.querySelector("[data-edit-member-detail]")?.removeAttribute("hidden");
    return;
  }
  const paidButton = event.target.closest("[data-member-detail-paid]");
  if (paidButton) {
    await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(paidButton.dataset.memberDetailPaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: new Date().toISOString() }) });
    await loadMembershipDetailPage();
    return;
  }
  const unpaidButton = event.target.closest("[data-member-detail-unpaid]");
  if (unpaidButton) {
    if (!window.confirm("Mark this membership renewal as unpaid?")) return;
    await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(unpaidButton.dataset.memberDetailUnpaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: null }) });
    await loadMembershipDetailPage();
    return;
  }
  const deleteButton = event.target.closest("[data-delete-member]");
  if (deleteButton) {
    if (!window.confirm("Delete this member from the membership list? Historical form submissions will remain.")) return;
    await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(deleteButton.dataset.deleteMember)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    window.location.href = "memberships.html";
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-member-detail-form]");
  if (!form) return;
  event.preventDefault();
  const status = form.querySelector("[data-member-detail-status]");
  const formData = new FormData(form);
  const body = {
    membership_type: String(formData.get("membership_type") || "adult"),
    first_name: String(formData.get("first_name") || "").trim(),
    last_name: String(formData.get("last_name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    phone: String(formData.get("phone") || "").trim() || null,
    birthday: String(formData.get("birthday") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    riding_level: String(formData.get("riding_level") || "").trim() || null,
    horse_level: String(formData.get("horse_level") || "").trim() || null,
    emergency_first_name: String(formData.get("emergency_first_name") || "").trim() || null,
    emergency_last_name: String(formData.get("emergency_last_name") || "").trim() || null,
    emergency_phone: String(formData.get("emergency_phone") || "").trim() || null,
    email_notifications: formData.get("email_notifications") === "on",
    updated_at: new Date().toISOString(),
  };
  try {
    await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(form.dataset.memberId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (status) status.textContent = "Member details saved.";
    await loadMembershipDetailPage();
  } catch (error) {
    if (status) status.textContent = `Could not save member: ${error.message}`;
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-pl-entry]");
  if (!button || !window.confirm("Remove this financial entry? This cannot be undone.")) return;
  const table = button.dataset.deletePlEntry;
  if (!["event_expenses", "club_expenses", "other_income"].includes(table)) return;
  try {
    await requestSupabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(button.dataset.entryId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    window.location.reload();
  } catch (error) { alert(`Could not remove this entry: ${error.message}`); }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-download-past-pl]");
  if (!button || !window.jspdf) return;
  const archive = JSON.parse(button.dataset.downloadPastPl);
  const report = archive.report || {}; const pdf = new window.jspdf.jsPDF();
  pdf.setFontSize(18); pdf.text("Shoalhaven Extreme Obstacle Racing Club", 14, 18);
  pdf.setFontSize(14); pdf.text(`Profit & Loss | ${archive.financial_year}`, 14, 28);
  let y = 42; (report.events || []).forEach((item) => { pdf.setFontSize(10); pdf.text(`${item.title} | Income ${formatCurrency(item.income)} | Costs ${formatCurrency(item.expenses)} | Profit ${formatCurrency(item.profit)}`, 14, y); y += 8; });
  const totalIncome = Number(report.event_income || 0) + Number(report.membership_income || 0) + Number(report.other_income || 0);
  pdf.setFontSize(12); pdf.text(`Income: ${formatCurrency(totalIncome)}   Event costs: ${formatCurrency(report.event_expenses)}   Club costs: ${formatCurrency(report.club_expenses)}`, 14, y + 8);
  pdf.save(`seorc-profit-loss-${archive.financial_year}.pdf`);
});

function aggregateAnnualPoints(results, year) {
  const countedResults = results.filter((result) => {
    const resultYear = getShowResultYear(result);
    return resultYear === year && !result.scratched && (result.processed_at || result.result_place);
  });
  const riders = new Map();
  const combinations = new Map();

  countedResults.forEach((result) => {
    const participant = result.participant_name || "Name not supplied";
    const horseName = result.horse_name || "Horse not supplied";
    const points = getShowResultPoints(result);
    const event = getEventDetails(result.event_id);
    const riderKey = participant.toLowerCase();
    const comboKey = `${participant.toLowerCase()}::${horseName.toLowerCase()}`;

    if (!riders.has(riderKey)) {
      riders.set(riderKey, {
        name: participant,
        level: result.riding_class || "Not supplied",
        points: 0,
        entries: 0,
        events: new Set(),
      });
    }

    if (!combinations.has(comboKey)) {
      combinations.set(comboKey, {
        name: participant,
        horseName,
        points: 0,
        entries: 0,
        events: new Set(),
      });
    }

    const rider = riders.get(riderKey);
    const combination = combinations.get(comboKey);

    rider.points += points;
    rider.entries += 1;
    rider.events.add(event.id);

    combination.points += points;
    combination.entries += 1;
    combination.events.add(event.id);
  });

  const sortByPoints = (a, b) => b.points - a.points || a.name.localeCompare(b.name);

  return {
    countedResults,
    riders: [...riders.values()].sort(sortByPoints),
    combinations: [...combinations.values()].sort((a, b) => sortByPoints(a, b) || a.horseName.localeCompare(b.horseName)),
  };
}

function renderAnnualPointsTable(rows, type) {
  if (!rows.length) {
    return '<p class="empty-state">No processed show results have been counted for this calendar year yet.</p>';
  }

  const topTen = rows.slice(0, 10);
  let previousPoints = null;
  let previousRank = 0;

  return `
    <div class="admin-data-table points-table ${type === "combo" ? "points-combo-table" : "points-rider-table"}" role="table" aria-label="${type === "combo" ? "Rider and horse points" : "Rider points"}">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Rider</span>
        ${type === "rider" ? '<span role="columnheader">Rider level</span>' : ""}
        ${type === "combo" ? '<span role="columnheader">Horse</span>' : ""}
        <span role="columnheader">Points</span>
        <span role="columnheader">Entries</span>
        <span role="columnheader">Events</span>
      </div>
      ${topTen
        .map((row, index) => {
          const rank = row.points === previousPoints ? previousRank : index + 1;
          previousPoints = row.points;
          previousRank = rank;

          return `
            <div role="row" class="admin-table-row">
              <span role="cell"><strong>${rank}</strong></span>
              <span role="cell">${escapeHTML(row.name)}</span>
              ${type === "rider" ? `<span role="cell">${escapeHTML(row.level)}</span>` : ""}
              ${type === "combo" ? `<span role="cell">${escapeHTML(row.horseName)}</span>` : ""}
              <span role="cell"><strong>${formatPoints(row.points)}</strong></span>
              <span role="cell">${row.entries}</span>
              <span role="cell">${row.events.size}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

async function loadPointsPage() {
  const page = document.querySelector("[data-points-page]");
  const summary = document.querySelector("[data-points-summary]");
  const riderPoints = document.querySelector("[data-rider-points]");
  const comboPoints = document.querySelector("[data-combo-points]");
  const year = getPointsPageYear();

  if (!page) return;

  document.querySelector("[data-points-year]").textContent = String(year);

  try {
    const results = await fetchAllShowResults();
    const annualPoints = aggregateAnnualPoints(results, year);

    document.querySelector("[data-points-rider-count]").textContent = String(annualPoints.riders.length);
    document.querySelector("[data-points-combo-count]").textContent = String(annualPoints.combinations.length);
    document.querySelector("[data-points-result-count]").textContent = String(annualPoints.countedResults.length);

    if (summary) {
      summary.textContent = `${annualPoints.countedResults.length} processed paid-member results counted for ${year}.`;
    }

    if (riderPoints) {
      riderPoints.innerHTML = renderAnnualPointsTable(annualPoints.riders, "rider");
    }

    if (comboPoints) {
      comboPoints.innerHTML = renderAnnualPointsTable(annualPoints.combinations, "combo");
    }
  } catch (error) {
    if (summary) {
      summary.textContent = "Could not load points yet. Please check Supabase access.";
    }

    if (riderPoints) {
      riderPoints.innerHTML = '<p class="empty-state">Could not load rider points.</p>';
    }

    if (comboPoints) {
      comboPoints.innerHTML = '<p class="empty-state">Could not load rider and horse points.</p>';
    }

    console.error("Annual points load failed:", error);
  }
}

function reorderShowClassEntries(eventId, className, orderedEntryIds) {
  const order = readShowOrder();
  const groupKey = `${eventId}:${className}`;
  order[groupKey] = orderedEntryIds;
  writeShowOrder(order);
}

function isShowJudgingComplete(eventId, registrations, results) {
  const classNames = Object.keys(getShowClassGroupsWithResults(eventId, registrations, results));
  const processedClasses = new Set(
    results
      .filter((result) => result.event_id === eventId && result.processed_at)
      .map((result) => result.class_name)
  );
  return classNames.length > 0 && classNames.every((className) => processedClasses.has(className));
}

function renderEventEditForm(event, judgingComplete = false) {
  if (event.id === "club-members") return "";
  const isExternal = event.type.startsWith("external-");

  return `
    <form class="form-panel event-edit-form" data-event-edit-form data-event-id="${escapeHTML(event.id)}">
      <div class="form-heading">
        <p class="eyebrow">Event details</p>
        <h2>Edit event information</h2>
      </div>
      <div class="form-grid">
        <label>
          Title
          <input name="title" type="text" value="${escapeHTML(event.title)}" required>
        </label>
        <label>
          Date
          <input name="date" type="date" value="${escapeHTML(event.date || "")}" required>
        </label>
        <label>
          Location
          <input name="location" type="text" value="${escapeHTML(event.location)}" required>
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows="4">${escapeHTML(event.description || "")}</textarea>
      </label>
      ${isExternal ? `<div class="form-grid"><label>Provider link<input name="provider_url" type="url" value="${escapeHTML(event.event_settings?.provider_url || "")}" required></label><label>Cost<input name="external_cost" type="text" value="${escapeHTML(event.event_settings?.external_cost || "")}" placeholder="e.g. $45, see provider" required></label></div>` : ""}
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit">Save Event Details</button>
        ${isExternal ? `<button class="button secondary form-submit" type="button" data-delete-shared-event="${escapeHTML(event.id)}">Delete listing</button>` : `<button class="button secondary form-submit" type="button" data-cancel-event data-event-id="${escapeHTML(event.id)}" data-event-title="${escapeHTML(event.title)}">Cancel &amp; notify attendees</button>`}
        ${event.type === "show" ? `<button class="button primary form-submit" type="button" data-publish-event-results data-event-id="${escapeHTML(event.id)}"${judgingComplete ? "" : " disabled"}>${judgingComplete ? "Publish Scores" : "Scores to be completed"}</button>` : ""}
      </div>
      <p class="form-status" data-event-edit-status hidden></p>
    </form>
  `;
}

function renderEventPricingForm(event) {
  if (!["club", "clinic", "show"].includes(event.type)) return "";
  const settings = event.event_settings || {};
  const fields = event.type === "club"
    ? `<label>Club day fee<input name="club_day_fee" type="number" min="0" step="0.01" value="${Number(settings.club_day_fee ?? defaultClubDayFee)}"></label>`
    : event.type === "clinic"
      ? `<label>Clinic fee<input name="clinic_fee" type="number" min="0" step="0.01" value="${Number(settings.clinic_fee ?? defaultClinicFee)}"></label>`
    : `<fieldset class="pricing-section"><legend>Dinner</legend><div class="form-grid"><label>Dinner ticket price<input name="dinner_price" type="number" min="0" step="0.01" value="${Number(settings.dinner_price ?? 30)}"></label><label>Dinner vendor link<input name="dinner_vendor_url" type="url" value="${escapeHTML(settings.dinner_vendor_url || "")}" placeholder="https://..."></label><label>Custom dinner information<textarea name="custom_information" rows="4" placeholder="Information shown in the dinner section">${escapeHTML(settings.custom_information || "")}</textarea></label></div></fieldset><fieldset class="pricing-section"><legend>Camping and yards</legend><div class="form-grid"><label>Camping with power / night<input name="powered_camping_price" type="number" min="0" step="0.01" value="${Number(settings.powered_camping_price ?? 30)}"></label><label>Camping without power / night<input name="unpowered_camping_price" type="number" min="0" step="0.01" value="${Number(settings.unpowered_camping_price ?? 20)}"></label><label>Yard price<input name="yard_price" type="number" min="0" step="0.01" value="${Number(settings.yard_price ?? 5)}"></label></div></fieldset><fieldset class="pricing-section"><legend>Classes</legend><div class="form-grid">${showClassSlugs.map((slug) => `<label>${humanizeFieldName(slug)} class<input name="class_${slug}" type="number" min="0" step="0.01" value="${Number(settings.class_prices?.[slug] ?? getDefaultShowClassPrice(slug))}"></label>`).join("")}</div></fieldset>`;
  const pricingName = event.type === "show" ? "Show pricing" : event.type === "clinic" ? "Clinic pricing" : "Club day pricing";
  return `<details class="collapsible-admin-panel"><summary>${event.type === "show" ? "Show pricing and participant information" : pricingName}</summary><form class="form-panel" data-event-pricing-form data-event-id="${escapeHTML(event.id)}"><div class="form-heading"><p class="eyebrow">${pricingName}</p><h2>Participant options</h2></div>${event.type === "show" ? fields : `<div class="form-grid">${fields}</div>`}<button class="button primary form-submit" type="submit">Save prices and information</button><p class="form-status" data-event-pricing-status></p></form></details>`;
}

function renderClubMembersDetail(registrations) {
  const editingMember = registrations.find((registration) => registration.id === editingMemberId);
  const editPayload = editingMember?.payload || {};
  return `
    <div class="admin-data-table member-table" role="table" aria-label="Club members">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Name</span>
        <span role="columnheader">Email</span>
        <span role="columnheader">Phone</span>
        <span role="columnheader">Riding level</span>
        <span role="columnheader">Emergency contact</span>
        <span role="columnheader">Emergency phone</span>
      </div>
      ${registrations
        .map((registration) => {
          const payload = registration.payload || {};
          return `
            <div role="row" class="admin-table-row">
              <span role="cell">${escapeHTML(getParticipantName(registration))}<button class="text-link" type="button" data-edit-member data-registration-id="${escapeHTML(registration.id)}">Edit</button></span>
              <span role="cell">${escapeHTML(payload["club-email"] || "Not supplied")}</span>
              <span role="cell">${escapeHTML(payload["club-phone"] || "Not supplied")}</span>
              <span role="cell">${escapeHTML(payload["riding-level"] || "Not supplied")}</span>
              <span role="cell">${escapeHTML([payload["emergency-first-name"], payload["emergency-last-name"]].filter(Boolean).join(" ") || "Not supplied")}</span>
              <span role="cell">${escapeHTML(payload["emergency-phone"] || "Not supplied")}</span>
            </div>
          `;
        })
        .join("")}
    </div>
    ${editingMember ? `
      <form class="form-panel" data-member-edit-form data-registration-id="${escapeHTML(editingMember.id)}">
        <div class="form-heading"><p class="eyebrow">Annual member</p><h2>Edit member details</h2></div>
        <div class="form-grid">
          <label>First name<input name="club-first-name" type="text" value="${escapeHTML(editPayload["club-first-name"] || "")}" required></label>
          <label>Last name<input name="club-last-name" type="text" value="${escapeHTML(editPayload["club-last-name"] || "")}" required></label>
          <label>Email<input name="club-email" type="email" value="${escapeHTML(editPayload["club-email"] || "")}"></label>
          <label>Phone<input name="club-phone" type="tel" value="${escapeHTML(editPayload["club-phone"] || "")}"></label>
          <label>Riding level<select name="riding-level"><option value="">Not supplied</option>${["Professional", "Experienced", "Intermediate", "Novice"].map((level) => `<option${editPayload["riding-level"] === level ? " selected" : ""}>${level}</option>`).join("")}</select></label>
          <label>Emergency first name<input name="emergency-first-name" type="text" value="${escapeHTML(editPayload["emergency-first-name"] || "")}"></label>
          <label>Emergency last name<input name="emergency-last-name" type="text" value="${escapeHTML(editPayload["emergency-last-name"] || "")}"></label>
          <label>Emergency phone<input name="emergency-phone" type="tel" value="${escapeHTML(editPayload["emergency-phone"] || "")}"></label>
        </div>
        <div class="admin-actions"><button class="button primary form-submit" type="submit">Save member</button><button class="button secondary form-submit" type="button" data-cancel-member-edit>Cancel</button></div>
        <p class="form-status" data-member-edit-status></p>
      </form>` : ""}
  `;
}

function renderClubDayDetail(group) {
  const clubDayFee = Number(group.event.event_settings?.club_day_fee ?? defaultClubDayFee);
  return `
    <div class="admin-actions"><button class="button secondary form-submit" type="button" data-download-attendee-list data-event-id="${escapeHTML(group.event.id)}">Download attendee list</button></div>
    <p class="field-note">Club day fee: ${formatCurrency(clubDayFee)}. Each rider needing a day membership adds ${formatCurrency(defaultDayMembershipFee)} to their event total.</p>
    <div class="admin-data-table club-day-table" role="table" aria-label="${escapeHTML(group.event.title)} attendees">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Attended</span>
        <span role="columnheader">Name</span>
        <span role="columnheader">Horse</span>
        <span role="columnheader">Day membership form</span>
        <span role="columnheader">Cost</span>
      </div>
      ${group.registrations
        .map((registration) => {
          const payload = registration.payload || {};
          return `
            <div role="row" class="admin-table-row">
              <span role="cell"><input type="checkbox" aria-label="Mark ${escapeHTML(getParticipantName(registration))} as attended" data-attendance-registration="${escapeHTML(registration.id)}"${payload.attended === true ? " checked" : ""}></span>
              <span role="cell">${escapeHTML(getParticipantName(registration))}</span>
              <span role="cell">${escapeHTML(getRegistrationHorseNames(registration))}</span>
              <span role="cell">${needsDayMembershipForm(registration) ? "Bring form" : "Not required"}</span>
              <span role="cell">${formatCurrency(getRegistrationRevenue(registration))}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderClinicDetail(group) {
  const clinicFee = Number(group.event.event_settings?.clinic_fee ?? defaultClinicFee);
  return `<div class="admin-actions"><button class="button secondary form-submit" type="button" data-download-attendee-list data-event-id="${escapeHTML(group.event.id)}">Download attendee list</button></div><p class="field-note">Clinic fee: ${formatCurrency(clinicFee)}. Day-membership forms needed are clearly marked below.</p><div class="admin-data-table club-day-table" role="table" aria-label="${escapeHTML(group.event.title)} attendees"><div role="row" class="admin-table-header"><span role="columnheader">Attended</span><span role="columnheader">Name</span><span role="columnheader">Horse</span><span role="columnheader">Day membership form</span><span role="columnheader">Cost</span></div>${group.registrations.map((registration) => `<div role="row" class="admin-table-row"><span role="cell"><input type="checkbox" aria-label="Mark ${escapeHTML(getParticipantName(registration))} as attended" data-attendance-registration="${escapeHTML(registration.id)}"${registration.payload?.attended === true ? " checked" : ""}></span><span role="cell">${escapeHTML(getParticipantName(registration))}</span><span role="cell">${escapeHTML(getRegistrationHorseNames(registration))}</span><span role="cell">${needsDayMembershipForm(registration) ? "Bring form" : "Not required"}</span><span role="cell">${formatCurrency(getRegistrationRevenue(registration))}</span></div>`).join("") || '<p class="empty-state">No clinic registrations yet.</p>'}</div>`;
}

function renderShowDetail(eventId, group, results = []) {
  const classGroups = getShowClassGroupsWithResults(eventId, group.registrations, results);
  const classNames = sortShowClassNames(Object.keys(classGroups));
  const processedClasses = new Set(results.filter((result) => result.event_id === eventId && result.processed_at).map((result) => result.class_name));
  const classEntryTotal = Object.values(classGroups).reduce((total, entries) => total + entries.length, 0);
  const manualEntryTotal = Object.values(classGroups).flat().filter((entry) => entry.isManual).length;
  const horseTotal = getShowHorseCount(group.registrations) + manualEntryTotal;
  const nonMemberRegistrations = group.registrations.filter(needsDayMembershipForm);
  const dinnerRegistrations = group.registrations
    .map((registration) => ({
      registration,
      dinnerCount: getPayloadNumber(registration.payload || {}, "dinner-count"),
    }))
    .filter((entry) => entry.dinnerCount > 0);
  const dinnerTicketTotal = dinnerRegistrations.reduce((total, entry) => total + entry.dinnerCount, 0);
  const dinnerCostTotal = dinnerTicketTotal * 30;
  const campingRegistrations = group.registrations
    .map((registration) => {
      const payload = registration.payload || {};
      const campingTypes = [
        payload["camping-with-power"] === true ? "Power" : "",
        payload["camping-without-power"] === true ? "No power" : "",
      ].filter(Boolean);

      return {
        registration,
        campingType: campingTypes.join(", ") || "No camping",
        nightCount: getPayloadNumber(payload, "camping-night-count"),
        yardCount: getPayloadNumber(payload, "yard-count"),
        campingCost:
          ((payload["camping-with-power"] === true ? 30 : 0) +
          (payload["camping-without-power"] === true ? 20 : 0)) *
          getPayloadNumber(payload, "camping-night-count") +
          getPayloadNumber(payload, "yard-count") * 5,
        hasPower: payload["camping-with-power"] === true,
        hasNoPower: payload["camping-without-power"] === true,
        hasCamping: campingTypes.length > 0,
      };
    })
    .filter((entry) => entry.hasCamping || entry.yardCount > 0);
  const campingSummary = campingRegistrations.reduce(
    (summary, entry) => ({
      campers: summary.campers + (entry.hasCamping ? 1 : 0),
      powered: summary.powered + (entry.hasPower ? 1 : 0),
      unpowered: summary.unpowered + (entry.hasNoPower ? 1 : 0),
      nights: summary.nights + entry.nightCount,
      yards: summary.yards + entry.yardCount,
      cost: summary.cost + entry.campingCost,
    }),
    { campers: 0, powered: 0, unpowered: 0, nights: 0, yards: 0, cost: 0 }
  );

  const classSections = classNames.length
    ? classNames
    .map((className) => `
      <section class="show-class-panel">
        <div class="form-heading">
          <p class="eyebrow">Show class</p>
          <h2>${escapeHTML(className)}${processedClasses.has(className) ? ' <span class="class-complete-icon" title="Results processed" aria-label="Results processed">Complete</span>' : ""}</h2>
        </div>
        <div class="admin-data-table show-class-table" role="table" aria-label="${escapeHTML(className)} entries">
          <div role="row" class="admin-table-header">
            <span role="columnheader">Order</span>
            <span role="columnheader">Participant</span>
            <span role="columnheader">Horse</span>
            <span role="columnheader">Riding class</span>
            <span role="columnheader">Drag</span>
          </div>
          ${classGroups[className]
            .map((entry, index) => `
              <div role="row" class="admin-table-row show-draggable-row" draggable="true" data-drag-entry="${escapeHTML(entry.id)}" data-class-name="${escapeHTML(className)}">
                <span role="cell">${index + 1}</span>
                <span role="cell">${escapeHTML(entry.participant)}</span>
                <span role="cell">${escapeHTML(entry.horseName)}</span>
                <span role="cell">${escapeHTML(entry.ridingClass)}${entry.isManual ? "<small>Added manually</small>" : ""}</span>
                <span role="cell">
                  <button class="drag-handle" type="button" aria-label="Drag ${escapeHTML(entry.participant)}">Drag</button>
                </span>
              </div>
            `)
            .join("")}
        </div>
      </section>
    `)
    .join("")
    : '<p class="empty-state">No show class entries yet.</p>';

  const showSummarySection = `
    <details class="collapsible-admin-panel"><summary>Judge access</summary><section class="show-class-panel"><div class="form-heading"><p class="eyebrow">Judge access</p><h2>Assign a judge to this show</h2><p data-judge-assignment-summary>Checking current judge assignment...</p></div><form class="form-grid judge-access-form" data-judge-credentials-form data-event-id="${escapeHTML(eventId)}"><label>Judge login name<input name="username" type="text" pattern="[a-zA-Z0-9._-]+" autocomplete="username" required><span class="field-note">This exact name is used on the judge sign-in page.</span></label><label>New password<input name="password" type="text" minlength="5" required><span class="field-note">At least 5 characters. The password is visible while you set it.</span></label><button class="button secondary form-submit" type="submit">Assign judge &amp; save access</button><p class="form-status" data-judge-credentials-status></p></form></section></details>
  `;

  const dinnerSection = `
    <section class="show-class-panel">
      <div class="form-heading">
        <p class="eyebrow">Show extras</p>
        <h2>Dinner list</h2>
      </div>
      ${dinnerRegistrations.length
        ? `
          <dl class="show-extra-summary">
            <div>
              <dt>Total tickets</dt>
              <dd>${dinnerTicketTotal}</dd>
            </div>
            <div>
              <dt>Dinner total</dt>
              <dd>${formatCurrency(dinnerCostTotal)}</dd>
            </div>
          </dl>
          <div class="admin-data-table show-extra-table show-dinner-table" role="table" aria-label="Dinner tickets">
            <div role="row" class="admin-table-header">
              <span role="columnheader">Participant</span>
              <span role="columnheader">Email</span>
              <span role="columnheader">Dinner tickets</span>
            </div>
            ${dinnerRegistrations
              .map(({ registration, dinnerCount }) => {
                const payload = registration.payload || {};
                return `
                  <div role="row" class="admin-table-row">
                    <span role="cell">${escapeHTML(getParticipantName(registration))}</span>
                    <span role="cell">${escapeHTML(payload["participant-email"] || "Not supplied")}</span>
                    <span role="cell">${dinnerCount}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : '<p class="empty-state">No dinner tickets requested yet.</p>'}
    </section>
  `;

  const campingSection = `
    <section class="show-class-panel">
      <div class="form-heading">
        <p class="eyebrow">Show extras</p>
        <h2>Camping and yards</h2>
      </div>
      ${campingRegistrations.length
        ? `
          <dl class="show-extra-summary">
            <div>
              <dt>Campers</dt>
              <dd>${campingSummary.campers}</dd>
            </div>
            <div>
              <dt>Powered</dt>
              <dd>${campingSummary.powered}</dd>
            </div>
            <div>
              <dt>Unpowered</dt>
              <dd>${campingSummary.unpowered}</dd>
            </div>
            <div>
              <dt>Total nights</dt>
              <dd>${campingSummary.nights}</dd>
            </div>
            <div>
              <dt>Total yards</dt>
              <dd>${campingSummary.yards}</dd>
            </div>
            <div>
              <dt>Camping total</dt>
              <dd>${formatCurrency(campingSummary.cost)}</dd>
            </div>
          </dl>
          <div class="admin-data-table show-extra-table show-camping-table" role="table" aria-label="Camping and yards">
            <div role="row" class="admin-table-header">
              <span role="columnheader">Participant</span>
              <span role="columnheader">Camping</span>
              <span role="columnheader">Nights</span>
              <span role="columnheader">Yards</span>
              <span role="columnheader">Phone</span>
            </div>
            ${campingRegistrations
              .map(({ registration, campingType, nightCount, yardCount }) => {
                const payload = registration.payload || {};
                return `
                  <div role="row" class="admin-table-row">
                    <span role="cell">${escapeHTML(getParticipantName(registration))}</span>
                    <span role="cell">${escapeHTML(campingType)}</span>
                    <span role="cell">${nightCount}</span>
                    <span role="cell">${yardCount}</span>
                    <span role="cell">${escapeHTML(payload["participant-phone"] || "Not supplied")}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : '<p class="empty-state">No camping or yards requested yet.</p>'}
    </section>
  `;

  const nonMemberSection = `
    <section class="show-class-panel">
      <div class="form-heading">
        <p class="eyebrow">Membership</p>
        <h2>Non-members</h2>
      </div>
      ${nonMemberRegistrations.length
        ? `
          <dl class="show-extra-summary">
            <div>
              <dt>Day forms</dt>
              <dd>${nonMemberRegistrations.length}</dd>
            </div>
            <div>
              <dt>Membership total</dt>
              <dd>${formatCurrency(nonMemberRegistrations.length * defaultDayMembershipFee)}</dd>
            </div>
          </dl>
          <div class="admin-data-table show-non-member-table" role="table" aria-label="Non-members needing day membership">
            <div role="row" class="admin-table-header">
              <span role="columnheader">Participant</span>
              <span role="columnheader">Email</span>
              <span role="columnheader">Phone</span>
              <span role="columnheader">Membership</span>
            </div>
            ${nonMemberRegistrations
              .map((registration) => {
                const payload = registration.payload || {};
                return `
                  <div role="row" class="admin-table-row">
                    <span role="cell">${escapeHTML(getParticipantName(registration))}</span>
                    <span role="cell">${escapeHTML(payload["participant-email"] || "Not supplied")}</span>
                    <span role="cell">${escapeHTML(payload["participant-phone"] || "Not supplied")}</span>
                    <span role="cell">Day membership form needed</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : '<p class="empty-state">No non-members listed for this show yet.</p>'}
    </section>
  `;

  return `${showSummarySection}${classSections}${nonMemberSection}${dinnerSection}${campingSection}`;
}

function renderEventPage(registrations) {
  const page = document.querySelector("[data-event-page]");
  const content = document.querySelector("[data-event-page-content]");
  const title = document.querySelector("[data-event-page-title]");
  const summaryText = document.querySelector("[data-event-page-summary]");

  if (!page || !content) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event") || "club-members";
  const groups = groupRegistrationsByEvent(registrations);
  const group = groups[eventId] || { event: getEventDetails(eventId), registrations: [] };
  const summary = getEventSummary(group);
  const dateLabel = group.event.date ? formatDateParts(group.event.date).label : "Not dated";
  const showClassGroups = group.event.type === "show" ? getShowClassGroupsWithResults(eventId, group.registrations, showResults) : null;
  const showEntryCount = showClassGroups ? Object.values(showClassGroups).reduce((total, entries) => total + entries.length, 0) : 0;
  const showHorseCount = group.event.type === "show" ? getShowHorseCount(group.registrations) + Object.values(showClassGroups).flat().filter((entry) => entry.isManual).length : 0;
  const showRiderCount = group.event.type === "show" ? new Set(group.registrations.map(getParticipantName).filter(Boolean)).size : 0;

  const isMemberPage = eventId === "club-members";
  title.textContent = group.event.title;
  const pdfButton = document.querySelector("[data-show-pdf-download]");
  if (pdfButton) { pdfButton.hidden = group.event.type !== "show"; pdfButton.dataset.eventId = eventId; }
  const obstacleSetupLink = document.querySelector("[data-obstacle-setup-link]");
  if (obstacleSetupLink) { obstacleSetupLink.hidden = group.event.type !== "show"; obstacleSetupLink.href = `obstacle-setup.html?event=${encodeURIComponent(eventId)}`; }
  summaryText.textContent = isMemberPage ? `${summary.attendees} annual club member${summary.attendees === 1 ? "" : "s"} on record.` : `${dateLabel} | ${summary.attendees} registered | ${summary.dayMembershipForms} day membership forms | ${formatCurrency(summary.revenue)} total`;

  let detailContent = "";

  if (eventId === "club-members") {
    detailContent = renderClubMembersDetail(group.registrations);
  } else if (group.event.type === "show") {
    detailContent = renderShowDetail(eventId, group, showResults);
  } else if (group.event.type === "clinic") {
    detailContent = renderClinicDetail(group);
  } else if (group.event.type.startsWith("external-")) {
    detailContent = "";
  } else {
    detailContent = renderClubDayDetail(group);
  }

  content.innerHTML = `
    <section class="event-registration-detail">
      <div class="event-detail-heading">
        <div>
          <p class="eyebrow">${isMemberPage ? "Annual membership" : escapeHTML(typeLabels[group.event.type] || humanizeFieldName(group.event.type))}</p>
          <h3>${escapeHTML(group.event.title)}</h3>
          <p>${isMemberPage ? "Member records for the current calendar year." : `${escapeHTML(dateLabel)} at ${locationMapLink(group.event.location)}`}</p>
        </div>
        ${group.event.type === "show" ? `<dl class="event-detail-stats">
          <div><dt>Riders</dt><dd>${showRiderCount}</dd></div>
          <div><dt>Entries</dt><dd>${showEntryCount}</dd></div>
          <div><dt>Horses</dt><dd>${showHorseCount}</dd></div>
          <div><dt>Revenue</dt><dd>${formatCurrency(summary.revenue)}</dd></div>
        </dl>` : isMemberPage || group.event.type.startsWith("external-") ? "" : `<dl class="event-detail-stats">
          <div>
            <dt>Coming</dt>
            <dd>${summary.attendees}</dd>
          </div>
          <div>
            <dt>Day forms</dt>
            <dd>${summary.dayMembershipForms}</dd>
          </div>
          <div>
            <dt>Revenue</dt>
            <dd>${formatCurrency(summary.revenue)}</dd>
          </div>
        </dl>`}
      </div>
      ${renderEventEditForm(group.event, group.event.type === "show" && isShowJudgingComplete(eventId, group.registrations, showResults))}
      ${renderEventPricingForm(group.event)}
      ${detailContent}
    </section>
  `;
  enableOpenStreetMapLocationSearch();
  if (group.event.type === "show") loadJudgeAssignmentSummary(eventId);
}

async function loadJudgeAssignmentSummary(eventId) {
  const summary = document.querySelector("[data-judge-assignment-summary]");
  if (!summary) return;
  try {
    const assignments = await requestSupabase(`/rest/v1/judge_assignments?event_id=eq.${encodeURIComponent(eventId)}&select=judge_login`);
    const logins = assignments.map((assignment) => assignment.judge_login).filter(Boolean);
    summary.textContent = logins.length ? `Assigned judge login: ${logins.join(", ")}. This login can score this show only.` : "No judge login is assigned yet.";
  } catch (error) { summary.textContent = "Could not check the current judge assignment."; }
}

async function loadShowReportPage() {
  const report = document.querySelector("[data-show-report]");
  if (!report) return;
  const eventId = new URLSearchParams(window.location.search).get("event");
  const content = document.querySelector("[data-show-report-content]");
  if (!eventId || !content) return;
  try {
    const registrations = await fetchRegistrations();
    const results = await fetchShowResultsForEvent(eventId);
    const group = groupRegistrationsByEvent(registrations)[eventId] || { event: getEventDetails(eventId), registrations: [] };
    if (group.event.type !== "show") throw new Error("This report is available for show events only.");
    document.querySelector("[data-show-report-title]").textContent = group.event.title;
    document.querySelector("[data-show-report-summary]").textContent = `${formatDateParts(group.event.date).label} | ${group.event.location}`;
    const classEntries = Object.values(getShowClassGroupsWithResults(eventId, group.registrations, results)).reduce((total, entries) => total + entries.length, 0);
    const dinnerTickets = group.registrations.reduce((total, registration) => total + getPayloadNumber(registration.payload || {}, "dinner-count"), 0);
    const campers = group.registrations.filter((registration) => registration.payload?.["camping-with-power"] || registration.payload?.["camping-without-power"]).length;
    content.innerHTML = `<dl class="show-extra-summary show-overview-summary"><div><dt>Participants</dt><dd>${group.registrations.length}</dd></div><div><dt>Horses</dt><dd>${getShowHorseCount(group.registrations)}</dd></div><div><dt>Entries</dt><dd>${classEntries}</dd></div><div><dt>Campers</dt><dd>${campers}</dd></div><div><dt>Dinner tickets</dt><dd>${dinnerTickets}</dd></div><div><dt>Revenue</dt><dd>${formatCurrency(getEventSummary(group).revenue)}</dd></div></dl>${renderShowDetail(eventId, group, results)}`;
  } catch (error) { content.innerHTML = `<p class="empty-state">Could not load show report: ${escapeHTML(error.message)}</p>`; }
}

loadShowReportPage();

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-print-show-report]")) window.print();
});

let pdfLogoDataPromise;
async function getPdfLogoData() {
  pdfLogoDataPromise ||= fetch("assets/seorc-club-logo.png")
    .then((response) => { if (!response.ok) throw new Error("Logo unavailable"); return response.blob(); })
    .then((blob) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }))
    .catch(() => null);
  return pdfLogoDataPromise;
}

function getShowJudgeName(eventId) {
  return getEventDetails(eventId).judge_name || "________________";
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-show-pdf-download]");
  if (!button) return;
  if (!window.jspdf?.jsPDF) return alert("PDF download is still loading. Please try again.");
  button.disabled = true;
  try {
    const eventId = button.dataset.eventId;
    const registrations = await fetchRegistrations();
    const results = await fetchShowResultsForEvent(eventId);
    const group = groupRegistrationsByEvent(registrations)[eventId] || { event: getEventDetails(eventId), registrations: [] };
    const { jsPDF } = window.jspdf;
    const logoData = await getPdfLogoData();
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 14; let y = 16;
    const templateBrown = [107, 63, 29]; const templateGold = [185, 138, 75]; const templateLine = [201, 187, 160];
    const title = group.event.title || "SEORC Show";
    const addHeader = (heading) => { pdf.setFillColor(...templateBrown); pdf.rect(margin, y, 182, 15, "F"); if (logoData) pdf.addImage(logoData, "PNG", margin + 3, y + 1.5, 12, 12); pdf.setTextColor(245, 239, 226); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text("SEORC SHOW", margin + 19, y + 6.5); pdf.setFontSize(9); pdf.text(heading.toUpperCase(), margin + 19, y + 11.5); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`${group.event.title} | ${formatDateParts(group.event.date).label} | ${group.event.location}`, margin, y + 21); y += 29; };
    addHeader("Run sheets");
    const classes = getShowClassGroupsWithResults(eventId, group.registrations, results);
    sortShowClassNames(Object.keys(classes)).forEach((className) => { const entries = classes[className]; for (let start = 0; start < entries.length; start += 20) { const run = entries.slice(start, start + 20); const tableHeight = 17 + run.length * 8; if (y + tableHeight > 278) { pdf.addPage(); y = 16; addHeader("Run sheets"); } pdf.setFillColor(...templateGold); pdf.rect(margin, y, 182, 8, "F"); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(`${className}${entries.length > 20 ? ` - ${start + 1}-${Math.min(start + 20, entries.length)}` : ""}`, margin + 4, y + 5.3); y += 8; pdf.setFillColor(245, 239, 226); pdf.rect(margin, y, 182, 9, "F"); pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9 + run.length * 8); [margin + 24, margin + 105].forEach((x) => pdf.line(x, y, x, y + 9 + run.length * 8)); pdf.setFontSize(9); pdf.text("ORDER", margin + 4, y + 5.8); pdf.text("RIDER NAME", margin + 29, y + 5.8); pdf.text("HORSE NAME", margin + 110, y + 5.8); y += 9; pdf.setFont("helvetica", "normal"); run.forEach((entry, index) => { pdf.line(margin, y + 8, 196, y + 8); pdf.text(String(start + index + 1), margin + 8, y + 5.4); pdf.text(String(entry.participant).slice(0, 34), margin + 29, y + 5.4); pdf.text(String(entry.horseName).slice(0, 34), margin + 110, y + 5.4); y += 8; }); y += 8; } });
    pdf.addPage(); y = 16; addHeader("Day memberships required");
    const phone = (registration) => registration.payload?.["participant-phone"] || registration.payload?.["clinic-phone"] || "Not supplied";
    const drawListHeader = (labels, columns, offsets = []) => { pdf.setFillColor(...templateGold); pdf.rect(margin, y, 182, 9, "F"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); labels.forEach((label, index) => pdf.text(label, columns[index] + (offsets[index] ?? 4), y + 5.8)); y += 9; };
    const dayMembers = group.registrations.filter(needsDayMembershipForm); drawListHeader(["RIDER NAME", "PHONE", "HORSE"], [margin, margin + 75, margin + 125]); dayMembers.forEach((r) => { pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9); [margin + 71, margin + 121].forEach((x) => pdf.line(x, y, x, y + 9)); pdf.setFont("helvetica", "normal"); pdf.text(getParticipantName(r).slice(0, 28), margin + 4, y + 5.8); pdf.text(phone(r).slice(0, 20), margin + 75, y + 5.8); pdf.text(getRegistrationHorseNames(r).slice(0, 26), margin + 125, y + 5.8); y += 9; }); if (!dayMembers.length) { pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text("No day membership forms required.", margin + 4, y + 10); }
    pdf.addPage(); y = 16; addHeader("Dinner ticket sales");
    const dinner = group.registrations.map((r) => ({ registration: r, count: getPayloadNumber(r.payload || {}, "dinner-count") })).filter((item) => item.count > 0); drawListHeader(["RIDER NAME", "PHONE", "TICKETS"], [margin, margin + 95, margin + 153]); dinner.forEach(({ registration, count }) => { pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9); [margin + 91, margin + 149].forEach((x) => pdf.line(x, y, x, y + 9)); pdf.setFont("helvetica", "normal"); pdf.text(getParticipantName(registration).slice(0, 34), margin + 4, y + 5.8); pdf.text(phone(registration).slice(0, 20), margin + 95, y + 5.8); pdf.text(String(count), margin + 160, y + 5.8); y += 9; }); pdf.setFont("helvetica", "bold"); pdf.text(`TOTAL TICKETS: ${dinner.reduce((sum, item) => sum + item.count, 0)}`, margin + 4, y + 11);
    pdf.addPage(); y = 16; addHeader("Camping information");
    const camping = group.registrations.filter((r) => r.payload?.["camping-with-power"] || r.payload?.["camping-without-power"] || getPayloadNumber(r.payload || {}, "yard-count") > 0); const campingColumns = [margin, margin + 55, margin + 105, margin + 145, margin + 165]; drawListHeader(["RIDER NAME", "PHONE", "CAMPING", "NIGHTS", "YARDS"], campingColumns, [4, 4, 4, 4, 2]); camping.forEach((r) => { const p = r.payload || {}; pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9); campingColumns.slice(1).forEach((x) => pdf.line(x, y, x, y + 9)); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.text(getParticipantName(r).slice(0, 20), campingColumns[0] + 4, y + 5.8); pdf.text(phone(r).slice(0, 16), campingColumns[1] + 4, y + 5.8); pdf.text(p["camping-with-power"] ? "Powered" : p["camping-without-power"] ? "Unpowered" : "Yards", campingColumns[2] + 4, y + 5.8); pdf.text(String(getPayloadNumber(p, "camping-night-count")), campingColumns[3] + 4, y + 5.8); pdf.text(String(getPayloadNumber(p, "yard-count")), campingColumns[4] + 4, y + 5.8); y += 9; });
    pdf.save(`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-show-information.pdf`);
  } catch (error) { alert(`Could not download show PDF: ${error.message}`); } finally { button.disabled = false; }
});

async function downloadScoringCards(eventDetails, registrations) {
  if (!window.jspdf?.jsPDF) throw new Error("PDF download is still loading. Please try again.");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const cards = Object.entries(getShowClassGroupsWithResults(eventDetails.id, registrations, [])).flatMap(([className, entries]) => entries.map((entry, order) => ({ className, entry, order: order + 1 })));
  if (!cards.length) throw new Error("There are no show entries to create scoring cards for yet.");
  const [logoData, judgeName] = await Promise.all([getPdfLogoData(), getShowJudgeName(eventDetails.id)]);
  const obstacleNames = getObstacleNames(eventDetails);
  const brown = [107, 63, 29]; const gold = [185, 138, 75]; const line = [201, 187, 160];
  const drawCard = ({ className, entry, order }) => {
    const left = 14; const width = 182; let y = 12;
    pdf.setDrawColor(...line); pdf.setLineWidth(0.5); pdf.rect(left, y, width, 270);
    pdf.setFillColor(...brown); pdf.rect(left, y, width, 18, "F"); if (logoData) pdf.addImage(logoData, "PNG", left + 4, y + 2, 14, 14); pdf.setTextColor(245, 239, 226); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("SEORC SHOW", left + 23, y + 7.5); pdf.setFontSize(10); pdf.text("JUDGE SCORING CARD", left + 23, y + 13); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`${eventDetails.title} | ${formatDateParts(eventDetails.date).label}`, left + 4, y + 26); pdf.setFont("helvetica", "bold"); pdf.text("JUDGE:", left + 112, y + 26); pdf.setFont("helvetica", "normal"); pdf.text(String(judgeName), left + 132, y + 26); pdf.setFont("helvetica", "bold"); pdf.text("CLASS:", left + 4, y + 34); pdf.text("ORDER:", left + 112, y + 34); pdf.text("RIDER:", left + 4, y + 42); pdf.text("HORSE:", left + 112, y + 42); pdf.setFont("helvetica", "normal"); pdf.text(String(className), left + 24, y + 34); pdf.text(String(order), left + 132, y + 34); pdf.text(String(entry.participant).slice(0, 28), left + 25, y + 42); pdf.text(String(entry.horseName).slice(0, 28), left + 132, y + 42);
    y += 46; pdf.setFillColor(...gold); pdf.rect(left, y, width, 8, "F"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("#", left + 4, y + 5.2); pdf.text("OBSTACLE", left + 18, y + 5.2); pdf.text("SCORE / 10", left + 151, y + 5.2); pdf.setFont("helvetica", "normal"); pdf.setDrawColor(...line);
    obstacleNames.forEach((name, index) => { const rowY = y + 8 + index * 10; pdf.rect(left, rowY, width, 10); pdf.line(left + 14, rowY, left + 14, rowY + 10); pdf.line(left + 145, rowY, left + 145, rowY + 10); pdf.setFontSize(9); pdf.text(String(index + 1), left + 5, rowY + 6.5); pdf.text(String(name).slice(0, 55), left + 18, rowY + 6.5); });
    const scoreY = y + 8 + obstacleNames.length * 10 + 8; pdf.setFont("helvetica", "bold"); pdf.setFillColor(245, 239, 226); pdf.rect(left, scoreY, 86, 18, "FD"); pdf.rect(left + 96, scoreY, 86, 18, "FD"); pdf.text("TIME SCORE", left + 4, scoreY + 6); pdf.text("TOTAL", left + 100, scoreY + 6);
  };
  cards.forEach((card, index) => { if (index) pdf.addPage(); drawCard(card); });
  pdf.save(`${String(eventDetails.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-scoring-cards.pdf`);
}

async function loadObstacleSetupPage() {
  const page = document.querySelector("[data-obstacle-setup-form]");
  if (!page) return;
  const eventId = new URLSearchParams(window.location.search).get("event");
  const status = document.querySelector("[data-obstacle-setup-status]");
  const fields = document.querySelector("[data-obstacle-name-fields]");
  if (!eventId || !fields) return;
  await loadSharedEvents();
  const eventDetails = getEventDetails(eventId);
  if (eventDetails.type !== "show") { fields.innerHTML = '<p class="empty-state">Obstacle setup is available for show events only.</p>'; return; }
  document.querySelector("[data-obstacle-setup-title]").textContent = `${eventDetails.title} obstacles.`;
  document.querySelector("[data-obstacle-setup-summary]").textContent = "Set the names that will appear on this show’s judge scoring cards and online scoring sheet.";
  document.querySelector("[data-obstacle-back]").href = `admin-event.html?event=${encodeURIComponent(eventId)}`;
  page.querySelector("[name='judge_name']").value = eventDetails.judge_name || "";
  fields.innerHTML = getObstacleNames(eventDetails).map((name, index) => `<label>Obstacle ${index + 1}<input name="obstacle-name" value="${escapeHTML(name)}" maxlength="80" required></label>`).join("");
  page.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const names = [...page.querySelectorAll("[name='obstacle-name']")].map((input) => input.value.trim() || input.placeholder || "Obstacle");
    try { await requestSupabase(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ judge_name: String(page.querySelector("[name='judge_name']")?.value || "").trim() || null, event_settings: { ...(eventDetails.event_settings || {}), obstacle_names: names } }) }); await loadSharedEvents(); status.textContent = "Judge name and obstacle names saved."; }
    catch (error) { status.textContent = `Could not save obstacle names: ${error.message}`; }
  });
  document.querySelector("[data-score-card-download]").addEventListener("click", async () => {
    try { const registrations = await fetchRegistrations(); const currentEvent = getEventDetails(eventId); await downloadScoringCards(currentEvent, registrations); }
    catch (error) { alert(`Could not download scoring cards: ${error.message}`); }
  });
}

loadObstacleSetupPage();

function renderEventDashboard(registrations) {
  const dashboard = document.querySelector("[data-event-dashboard]");

  if (!dashboard) return;

  const groups = groupRegistrationsByEvent(registrations);
  const dashboardGroups = {};

  getEvents().forEach((event) => {
    dashboardGroups[event.id] = groups[event.id] || {
      event,
      registrations: [],
    };
  });

  Object.entries(groups).forEach(([eventId, group]) => {
    dashboardGroups[eventId] ||= group;
  });

  const groupEntries = Object.entries(dashboardGroups)
    .filter(([eventId, group]) => eventId !== "unknown-event" && group.event.id !== "club-members")
    .sort(([, a], [, b]) => String(a.event.date).localeCompare(String(b.event.date)));

  dashboard.innerHTML = "";

  dashboard.innerHTML = `
    <div class="admin-data-table event-overview-table" role="table" aria-label="Registration events">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Event</span>
        <span role="columnheader">Date</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Participants</span>
        <span role="columnheader">Day forms</span>
        <span role="columnheader">Revenue</span>
      </div>
      ${groupEntries
        .map(([eventId, group]) => {
          const summary = getEventSummary(group);
          const eventType = typeLabels[group.event.type] || humanizeFieldName(group.event.type);
          const dateLabel = group.event.date ? formatDateParts(group.event.date).label : "Not dated";

          return `
            <div role="row" class="admin-table-row">
              <span role="cell"><a class="admin-table-title-link" href="admin-event.html?event=${encodeURIComponent(eventId)}"><strong>${escapeHTML(group.event.title)}</strong><small>${escapeHTML(group.event.location)}</small></a></span>
              <span role="cell">${escapeHTML(dateLabel)}</span>
              <span role="cell">${escapeHTML(eventType)}</span>
              <span role="cell">${summary.attendees}</span>
              <span role="cell">${summary.dayMembershipForms}</span>
              <span role="cell">${formatCurrency(summary.revenue)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderJudgingDashboard(registrations, results = [], permittedEventIds = null) {
  const dashboard = document.querySelector("[data-judging-dashboard]");

  if (!dashboard) return;

  const groups = groupRegistrationsByEvent(registrations);
  const showEvents = getEvents().filter((event) => event.type === "show" && (!permittedEventIds || permittedEventIds.has(event.id)));

  dashboard.innerHTML = showEvents.length ? showEvents
    .map((event) => {
      const group = groups[event.id] || { event, registrations: [] };
      const eventResults = results.filter((result) => result.event_id === event.id);
      const classGroups = getShowClassGroupsWithResults(event.id, group.registrations, eventResults);
      const classNames = sortShowClassNames(Object.keys(classGroups));
      const processedClasses = new Set(eventResults.filter((result) => result.processed_at).map((result) => result.class_name));
      const judgingComplete = classNames.length > 0 && classNames.every((className) => processedClasses.has(className));
      const dateLabel = event.date ? formatDateParts(event.date).label : "Not dated";

      return `
        <section class="show-class-panel judging-event-panel">
          <div class="form-heading">
            <p class="eyebrow">Show</p>
            <h2>${escapeHTML(event.title)}</h2>
            <p>${escapeHTML(dateLabel)} at ${escapeHTML(event.location)}</p>
          </div>
          ${classNames.length
            ? `
              <div class="admin-data-table judging-class-table" role="table" aria-label="${escapeHTML(event.title)} judging classes">
                <div role="row" class="admin-table-header">
                  <span role="columnheader">Class</span>
                  <span role="columnheader">Entries</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Score</span>
                </div>
                ${classNames
                  .map((className) => `
                    <div role="row" class="admin-table-row">
                      <span role="cell"><strong>${escapeHTML(className)}</strong></span>
                      <span role="cell">${classGroups[className].length}</span>
                      <span role="cell">${processedClasses.has(className) ? '<span class="class-complete-icon">Complete</span>' : "Ready"}</span>
                      <span role="cell"><a class="button secondary compact-button" href="show-results.html?event=${encodeURIComponent(event.id)}&class=${encodeURIComponent(className)}">Open Scoring</a></span>
                    </div>
                  `)
                  .join("")}
              </div>
            `
            : '<p class="empty-state">No class entries found for this show yet.</p>'}
          ${judgingComplete ? '<div class="judging-complete-actions"><p class="class-complete-icon">All judging for this show is complete.</p><button class="button primary form-submit" type="button" data-judge-logout>Finish judging and log out</button></div>' : ""}
        </section>
      `;
    })
    .join("") : '<p class="empty-state">No assigned show information is available. Ask the admin to open the correct show event and save Judge access again.</p>';
}

function getResultPageParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    eventId: params.get("event") || "",
    className: params.get("class") || "",
  };
}

function mergeEntriesWithResults(eventId, className, registrations, results) {
  const classEntries = getShowClassEntriesForClass(eventId, className, registrations);
  const resultByEntryId = new Map(results.map((result) => [result.entry_id, result]));
  const mergedEntries = classEntries.map((entry) => normalizeResultEntry(entry, resultByEntryId.get(entry.id)));
  const existingEntryIds = new Set(classEntries.map((entry) => entry.id));
  const manualEntries = results
    .filter((result) => !existingEntryIds.has(result.entry_id))
    .map((result) => normalizeResultEntry({
      id: result.entry_id,
      participant: result.participant_name,
      horseName: result.horse_name,
      ridingClass: result.riding_class,
      isManual: true,
    }, result));

  return [...mergedEntries, ...manualEntries];
}

function renderResultsPodium(entries, processed = false) {
  const rankedEntries = processed
    ? [...entries]
      .filter((entry) => !entry.scratched)
      .sort((a, b) => {
        const aPlacing = Number(a.placing);
        const bPlacing = Number(b.placing);

        if (Number.isFinite(aPlacing) && Number.isFinite(bPlacing)) return aPlacing - bPlacing;
        if (Number.isFinite(aPlacing)) return -1;
        if (Number.isFinite(bPlacing)) return 1;
        return getRankedResults([a, b])[0] === a ? -1 : 1;
      })
      .slice(0, 4)
    : [];
  const labels = ["1st", "2nd", "3rd", "4th"];

  return `
    <section class="results-podium" data-results-podium>
      ${labels
        .map((label, index) => {
          const entry = rankedEntries[index];
          return `
            <article>
              <p class="eyebrow">${label}</p>
              <h2>${entry ? escapeHTML(entry.participant) : "Not processed yet"}</h2>
              <p>${entry ? `${escapeHTML(entry.horseName)} | ${getObstacleScoreTotal(entry)} points | ${formatTiming(entry.timingSeconds)}` : "Press Process Results when ready."}</p>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderObstacleInputs(entry) {
  const obstacleNames = getObstacleNames(getEventDetails(getResultPageParams().eventId));
  return Array.from({ length: showObstacleCount }, (_, index) => {
    const obstacleKey = `obstacle-${index + 1}`;
    const value = entry.obstacleScores?.[obstacleKey] ?? "";
    return `
      <label>
        ${index + 1}. ${escapeHTML(obstacleNames[index])}
        <input data-score-input data-obstacle-key="${obstacleKey}" type="number" min="0" max="10" step="0.5" value="${escapeHTML(String(value))}" ${entry.scratched ? "disabled" : ""}>
      </label>
    `;
  }).join("");
}

function renderResultsTable(entries) {
  if (!entries.length) {
    return '<p class="empty-state">No entries found for this class yet. Use Add Entry to create one manually.</p>';
  }

  return `
    <div class="results-entry-list" data-results-entry-list>
      ${entries
        .map((entry) => `
          <article class="results-entry-row${entry.scratched ? " is-scratched" : ""}" data-result-entry data-entry-id="${escapeHTML(entry.entryId)}" data-participant="${escapeHTML(entry.participant)}" data-horse="${escapeHTML(entry.horseName)}" data-riding-class="${escapeHTML(entry.ridingClass)}" data-scratched="${entry.scratched ? "true" : "false"}" data-placing="${escapeHTML(String(entry.placing || ""))}" data-processed-at="${escapeHTML(entry.processedAt || "")}">
            <div class="results-entry-main">
              <div>
                <h3>${escapeHTML(entry.participant)}</h3>
                <p>${escapeHTML(entry.horseName)}${entry.ridingClass ? ` | ${escapeHTML(entry.ridingClass)}` : ""}${entry.isManual ? " | Added manually" : ""}</p>
              </div>
              <button class="button secondary compact-button" type="button" data-scratch-toggle>${entry.scratched ? "Unscratch" : "Scratch"}</button>
            </div>
            <div class="obstacle-score-grid">
              ${renderObstacleInputs(entry)}
            </div>
            <div class="results-entry-footer">
              <label>
                Time (seconds)
                <input data-timing-input type="number" min="0" step="0.01" placeholder="0" value="${escapeHTML(String(entry.timingSeconds ?? ""))}" ${entry.scratched ? "disabled" : ""}>
              </label>
              <div>
                <span class="result-total-label">Obstacle total</span>
                <strong data-row-total>${getObstacleScoreTotal(entry)}</strong>
              </div>
              <p class="form-status compact" data-result-status>Not saved yet.</p>
            </div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderResultsPageContent(eventId, className, entries) {
  const content = document.querySelector("[data-results-content]");

  if (!content) return;

  const processed = hasProcessedResults(entries);
  const isPublished = entries.length > 0 && entries.every((entry) => entry.publishedAt);

  content.innerHTML = `
    <section class="results-toolbar">
      <button class="button primary form-submit" type="button" data-process-results>Process Results</button>
      <button class="button secondary form-submit" type="button" data-toggle-manual-entry>Add Manual Entry</button>
      <p class="results-warning" data-results-warning hidden></p>
      <p class="results-warning" data-save-warning hidden></p>
    </section>
    ${renderResultsPodium(entries, processed)}
    <section class="show-class-panel" data-manual-entry-panel hidden>
      <div class="form-heading">
        <p class="eyebrow">Manual entry</p>
        <h2>Add entry</h2>
      </div>
      <div class="form-grid add-result-grid">
        <label>
          Participant
          <input data-add-result-participant type="text">
        </label>
        <label>
          Horse
          <input data-add-result-horse type="text">
        </label>
        <label>
          Riding level
          <select data-add-result-riding-level><option value="">Select riding level</option><option>Professional</option><option>Amateur</option><option>Encouragement</option><option>Rookie</option><option>Junior</option></select>
        </label>
      </div>
      <button class="button primary form-submit" type="button" data-add-result-entry>Add Entry</button>
      <p class="field-note">Obstacle scores are out of 10. Enter time in seconds; the results summary displays it as mm:ss. Timing is used only to break ties in the same class, where lower time wins.</p>
    </section>
    ${renderResultsTable(entries)}
  `;
}

function getResultEntryFromRow(row) {
  const obstacleScores = {};

  row.querySelectorAll("[data-score-input]").forEach((input) => {
    const score = Number(input.value);
    obstacleScores[input.dataset.obstacleKey] = input.value === "" ? null : Math.min(10, Math.max(0, Number.isFinite(score) ? score : 0));
  });

  return {
    entryId: row.dataset.entryId,
    participant: row.dataset.participant,
    horseName: row.dataset.horse,
    ridingClass: row.dataset.ridingClass || "",
    obstacleScores,
    timingSeconds: row.querySelector("[data-timing-input]")?.value || "",
    scratched: row.dataset.scratched === "true",
    placing: row.dataset.placing ? Number(row.dataset.placing) : null,
    processedAt: row.dataset.processedAt || null,
  };
}

function getResultEntriesFromDom() {
  return [...document.querySelectorAll("[data-result-entry]")].map(getResultEntryFromRow);
}

function updateResultsTotalsFromDom() {
  document.querySelectorAll("[data-result-entry]").forEach((row) => {
    const entry = getResultEntryFromRow(row);
    const total = row.querySelector("[data-row-total]");
    if (total) total.textContent = String(getObstacleScoreTotal(entry));
  });
}

async function processResultsFromDom() {
  const entries = getResultEntriesFromDom();
  const podium = document.querySelector("[data-results-podium]");
  const warning = document.querySelector("[data-results-warning]");
  const processedAt = new Date().toISOString();
  const rankedActiveEntries = getRankedResults(entries).filter((entry) => !entry.scratched);

  updateResultsTotalsFromDom();

  if (warning) {
    const missingTiming = hasMissingTiming(entries);
    warning.hidden = !missingTiming;
    warning.textContent = missingTiming ? "Warning: not all active entries have a time allocated." : "";
  }

  rankedActiveEntries.forEach((entry, index) => {
    const row = document.querySelector(`[data-result-entry][data-entry-id="${CSS.escape(entry.entryId)}"]`);

    if (!row) return;

    row.dataset.placing = String(index + 1);
    row.dataset.processedAt = processedAt;
  });

  document.querySelectorAll("[data-result-entry].is-scratched").forEach((row) => {
    row.dataset.placing = "";
    row.dataset.processedAt = processedAt;
  });

  if (podium) {
    podium.outerHTML = renderResultsPodium(getResultEntriesFromDom(), true);
  }

  await Promise.all([...document.querySelectorAll("[data-result-entry]")].map((row) => saveResultRow(row)));
}

async function saveResultRow(row) {
  const { eventId, className } = getResultPageParams();
  const entry = getResultEntryFromRow(row);
  const status = row.querySelector("[data-result-status]");

  if (!eventId || !className) return;

  if (status) {
    status.textContent = "Saving...";
  }

  try {
    await upsertShowResult({
      event_id: eventId,
      class_name: className,
      entry_id: entry.entryId,
      participant_name: entry.participant,
      horse_name: entry.horseName,
      riding_class: entry.ridingClass,
      obstacle_scores: entry.obstacleScores,
      timing_seconds: entry.timingSeconds === "" ? null : Number(entry.timingSeconds),
      scratched: entry.scratched,
      result_place: entry.placing,
      processed_at: entry.processedAt || null,
    });

    if (status) {
      status.textContent = "Saved.";
    }

    const saveWarning = document.querySelector("[data-save-warning]");

    if (saveWarning) {
      saveWarning.hidden = true;
      saveWarning.textContent = "";
    }
  } catch (error) {
    if (status) {
      status.textContent = `Could not save: ${error.message}`;
    }

    const saveWarning = document.querySelector("[data-save-warning]");

    if (saveWarning) {
      saveWarning.hidden = false;
      saveWarning.textContent = `Scores are not saving yet: ${error.message}`;
    }

    console.error("Supabase result save failed:", error);
  }
}

function scheduleSaveResultRow(row) {
  const existingTimer = resultSaveTimers.get(row);

  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const status = row.querySelector("[data-result-status]");

  if (status) {
    status.textContent = "Waiting to save...";
  }

  const nextTimer = window.setTimeout(() => {
    resultSaveTimers.delete(row);
    saveResultRow(row);
  }, 700);

  resultSaveTimers.set(row, nextTimer);
}

async function loadResultsPage() {
  const page = document.querySelector("[data-results-page]");
  const content = document.querySelector("[data-results-content]");
  const title = document.querySelector("[data-results-title]");
  const summary = document.querySelector("[data-results-summary]");
  const backLink = document.querySelector("[data-results-back-link]");
  const { eventId, className } = getResultPageParams();

  if (!page || !content) return;

  if (!eventId || !className) {
    content.innerHTML = '<p class="empty-state">Missing event or class information.</p>';
    return;
  }

  if (title) title.textContent = `${className} results.`;
  if (summary) summary.textContent = "Loading entries and saved scores...";
  if (backLink) backLink.href = "judging.html";
  renderResultsPageContent(eventId, className, []);

  try {
    await loadSharedEvents();
    adminRegistrations = await fetchRegistrations();

    try {
      showResults = await fetchShowResults(eventId, className);
    } catch (error) {
      showResults = [];
      console.warn("Supabase show results fetch failed. Run supabase-schema.sql to create show_results.", error);
    }

    const entries = mergeEntriesWithResults(eventId, className, adminRegistrations, showResults);
    renderResultsPageContent(eventId, className, entries);

    if (summary) {
      summary.textContent = `${entries.length} entries | ${showObstacleCount} obstacles | timing breaks tied obstacle scores`;
    }
  } catch (error) {
    content.innerHTML = '<p class="empty-state">Could not load entries. Please check Supabase access.</p>';
    console.error("Show results page load failed:", error);
  }
}

async function loadJudgingPage() {
  const dashboard = document.querySelector("[data-judging-dashboard]");
  const summary = document.querySelector("[data-judging-summary]");

  if (!dashboard) return;

  renderJudgingDashboard([], []);

  try {
    await loadSharedEvents();
    adminRegistrations = await fetchRegistrations();
    const [adminRoles, assignments] = await Promise.all([
      requestSupabase("/rest/v1/admin_roles?select=user_id"),
      requestSupabase("/rest/v1/judge_assignments?select=event_id"),
    ]);
    const isAdmin = adminRoles.length > 0;
    const permittedEventIds = isAdmin ? null : new Set(assignments.map((assignment) => assignment.event_id));
    const showEvents = getEvents().filter((event) => event.type === "show" && (!permittedEventIds || permittedEventIds.has(event.id)));
    const resultSets = await Promise.all(showEvents.map(async (event) => {
      try {
        return await fetchShowResultsForEvent(event.id);
      } catch (error) {
        console.warn("Supabase show results fetch failed. Run supabase-schema.sql to create show_results.", error);
        return [];
      }
    }));

    showResults = resultSets.flat();
    renderJudgingDashboard(adminRegistrations, showResults, permittedEventIds);

    if (summary) {
      const classCount = [...document.querySelectorAll(".judging-class-table .admin-table-row")].length;
      const completedClassCount = showResults.filter((result) => result.processed_at).reduce((classes, result) => {
        classes.add(`${result.event_id}:${result.class_name}`);
        return classes;
      }, new Set()).size;
      summary.textContent = `${showEvents.length} show${showEvents.length === 1 ? "" : "s"} | ${completedClassCount} of ${classCount} classes judged`;
    }
  } catch (error) {
    dashboard.innerHTML = '<p class="empty-state">Could not load judging entries. Please check Supabase access.</p>';
    console.error("Judging dashboard load failed:", error);
  }
}

async function requestSupabase(path, options = {}) {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    throw new Error("Supabase is not configured for this page.");
  }

  const judgeArea = Boolean(document.querySelector("[data-judging-page], [data-results-page]"));
  const adminArea = Boolean(document.body.matches("[data-admin-role-required]") || document.querySelector("[data-admin-panel], [data-media-upload], [data-event-admin-form]"));
  const accessToken = judgeArea ? await getFreshJudgeAccessToken() : adminArea ? await getFreshAdminAccessToken() : null;
  const headers = {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${accessToken || supabaseConfig.anonKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(`${supabaseConfig.url}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Supabase request failed with status ${response.status}`;

    try {
      const details = await response.json();
      message = details.error_description || details.msg || details.message || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function fetchRegistrations() {
  return requestSupabase("/rest/v1/registrations?select=*&order=created_at.desc");
}

async function fetchShowResults(eventId, className) {
  const query = new URLSearchParams({
    event_id: `eq.${eventId}`,
    class_name: `eq.${className}`,
    select: "*",
    order: "created_at.asc",
  });

  return requestSupabase(`/rest/v1/show_results?${query.toString()}`);
}

async function fetchShowResultsForEvent(eventId) {
  const query = new URLSearchParams({
    event_id: `eq.${eventId}`,
    select: "*",
    order: "created_at.asc",
  });

  return requestSupabase(`/rest/v1/show_results?${query.toString()}`);
}

async function fetchAllShowResults() {
  return requestSupabase("/rest/v1/annual_points_entries?select=*&order=processed_at.asc");
}

async function upsertShowResult(result) {
  const query = new URLSearchParams({
    on_conflict: "event_id,class_name,entry_id",
  });

  const rows = await requestSupabase(`/rest/v1/show_results?${query.toString()}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      ...result,
      updated_at: new Date().toISOString(),
    }),
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

async function setEventResultsPublication(eventId) {
  const query = new URLSearchParams({ event_id: `eq.${eventId}`, processed_at: "not.is.null" });
  await requestSupabase(`/rest/v1/show_results?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ published_at: new Date().toISOString() }),
  });
}

async function deleteEventData(eventId) {
  const registrations = await fetchRegistrations().catch(() => adminRegistrations);
  const registrationIds = registrations
    .filter((registration) => getRegistrationEventId(registration) === eventId)
    .map((registration) => registration.id)
    .filter(Boolean);

  if (registrationIds.length) await requestSupabase(`/rest/v1/registrations?id=in.(${registrationIds.map(encodeURIComponent).join(",")})`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await requestSupabase(`/rest/v1/show_results?event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  adminRegistrations = adminRegistrations.filter((registration) => !registrationIds.includes(registration.id));
}

async function archiveEvent(eventId) {
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  const response = await fetch(`${config.url}/functions/v1/archive-event`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) });
  if (!response.ok) throw new Error((await response.json()).error || "Could not archive event");
}

async function loadRegistrations() {
  const registrationList = document.querySelector("[data-registration-list]");
  const dashboard = document.querySelector("[data-event-dashboard]");
  const eventPage = document.querySelector("[data-event-page]");

  if (!registrationList && !dashboard && !eventPage) return;

  if (registrationList) {
    registrationList.innerHTML = '<p class="empty-state">Loading registrations...</p>';
  }

  if (dashboard) {
    renderEventDashboard(adminRegistrations);
  }

  if (eventPage) {
    renderEventPage(adminRegistrations);
  }

  try {
    adminRegistrations = await fetchRegistrations();

    if (eventPage) {
      const eventId = new URLSearchParams(window.location.search).get("event") || "club-members";

      try {
        showResults = await fetchShowResultsForEvent(eventId);
      } catch (error) {
        showResults = [];
        console.warn("Supabase show results fetch failed. Run supabase-schema.sql to create show_results.", error);
      }
    }

    renderEventDashboard(adminRegistrations);
    renderRegistrationList(adminRegistrations);
    renderEventPage(adminRegistrations);
  } catch (error) {
    if (registrationList) {
      registrationList.innerHTML = '<p class="empty-state">Could not load registrations. Please check the temporary Supabase read policy.</p>';
    }

    const eventPageContent = document.querySelector("[data-event-page-content]");

    if (eventPageContent) {
      eventPageContent.innerHTML = '<p class="empty-state">Could not load registrations. Please check the temporary Supabase read policy.</p>';
    }

    console.error("Supabase registration fetch failed:", error);
  }
}

async function showAdminDashboard() {
  const panel = document.querySelector("[data-admin-panel]");

  if (!panel) return;

  panel.hidden = !await getFreshAdminAccessToken();
  if (panel.hidden) return;
  const roles = await requestSupabase("/rest/v1/admin_roles?select=user_id");
  if (!roles.length) {
    window.location.replace("admin-login.html");
    return;
  }
  renderAdminEventList();
  loadRegistrations();
}

if (document.body.matches("[data-admin-role-required]")) {
  (async () => {
    if (!await getFreshAdminAccessToken()) return window.location.replace("admin-login.html");
    const roles = await requestSupabase("/rest/v1/admin_roles?select=user_id");
    if (!roles.length) window.location.replace("admin-login.html");
  })();
}

const adminPanel = document.querySelector("[data-admin-panel]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminForm = document.querySelector("[data-event-admin-form]");
const refreshRegistrations = document.querySelector("[data-refresh-registrations]");
const mediaUploadForm = document.querySelector("[data-media-upload]");
const uploadedMediaList = document.querySelector("[data-uploaded-media-list]");
const judgeAssignmentForm = document.querySelector("[data-judge-assignment]");

if (adminPanel) {
  (async () => {
    if (!await getFreshAdminAccessToken()) {
      window.location.replace("admin-login.html");
      return;
    }
    showAdminDashboard();
  })();
}

if (document.body.matches("[data-admin-only]")) {
  (async () => {
    if (!await getFreshAdminAccessToken() && !await getFreshJudgeAccessToken()) window.location.replace("judge-login.html");
  })();
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = getSupabaseConfig();
    const status = adminLoginForm.querySelector("[data-admin-login-status]");
    const formData = new FormData(adminLoginForm);
    if (!config) return;
    status.textContent = "Signing in...";
    try {
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: config.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminLoginForm.matches("[data-judge-login]") ? `${String(formData.get("username") || "").trim().toLowerCase()}@judge.seorc.internal` : formData.get("email"), password: formData.get("password") }),
      });
      const session = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(session.msg || session.message || "Sign-in failed");
      const isJudgeLogin = adminLoginForm.matches("[data-judge-login]");
      if (isJudgeLogin) {
        const assignmentResponse = await fetch(`${config.url}/rest/v1/judge_assignments?select=event_id`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` } });
        const assignments = assignmentResponse.ok ? await assignmentResponse.json() : [];
        if (!assignments.length) throw new Error("This judge login has not been assigned to a show yet. Ask an admin to save Judge access for the show again.");
      }
      localStorage.setItem(isJudgeLogin ? judgeSessionStorageKey : adminSessionStorageKey, JSON.stringify(session));
      status.textContent = "Signed in.";
      window.location.href = adminLoginForm.dataset.loginDestination || "admin.html";
    } catch (error) {
      status.textContent = error.message || "Could not sign in. Please check the login name and password.";
    }
  });
}

if (mediaUploadForm) {
  if (!getAdminAccessToken()) {
    window.location.replace("admin-login.html");
  }

  mediaUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(mediaUploadForm);
    const files = [...mediaUploadForm.querySelector("[name='file']").files];
    const status = mediaUploadForm.querySelector("[data-media-upload-status]");
    const config = getSupabaseConfig();
    const token = await getFreshAdminAccessToken();
    if (!files.length || !config || !token) return;
    status.textContent = "Uploading...";
    try {
      await Promise.all(files.map(async (file, index) => { const path = `${Date.now()}-${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`; const upload = await fetch(`${config.url}/storage/v1/object/club-media/${encodeURIComponent(path)}`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file }); if (!upload.ok) { let details = ""; try { details = await upload.text(); } catch {} throw new Error(`Storage upload failed (${upload.status})${details ? `: ${details}` : ""}`); } await requestSupabase("/rest/v1/media_assets", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ storage_path: path, object_path: path, alt_text: "", caption: "", published_at: new Date().toISOString(), uploaded_by: JSON.parse(localStorage.getItem(adminSessionStorageKey)).user.id }) }); }));
      mediaUploadForm.reset();
      await loadUploadedMedia();
      status.textContent = "Uploaded as drafts.";
    } catch (error) { status.textContent = `Upload failed: ${error.message}`; }
  });
}

function mediaTitle(path) {
  return String(path || "Uploaded photo").replace(/^\d+-\d+-/, "").replace(/\.[^.]+$/, "");
}

async function loadUploadedMedia() {
  if (!uploadedMediaList) return;
  try {
    const assets = await requestSupabase("/rest/v1/media_assets?select=id,storage_path,object_path,homepage_slot,created_at&order=created_at.desc");
    uploadedMediaList.innerHTML = assets.length ? `<div class="admin-data-table" role="table"><div role="row" class="admin-table-header"><span role="columnheader">Title</span><span role="columnheader">Homepage</span><span role="columnheader">Action</span></div>${assets.map((asset) => { const path = asset.storage_path || asset.object_path; const options = [["", "Not used"], ["hero", "Hero"], ["gallery-1", "Gallery 1"], ["gallery-2", "Gallery 2"], ["gallery-3", "Gallery 3"], ["gallery-4", "Gallery 4"]].map(([value, label]) => `<option value="${value}"${asset.homepage_slot === value ? " selected" : ""}>${label}</option>`).join(""); return `<div role="row" class="admin-table-row"><span role="cell">${escapeHTML(mediaTitle(path))}</span><span role="cell"><select data-homepage-slot-select>${options}</select></span><span role="cell"><button class="button secondary compact-button" type="button" data-save-media-id="${escapeHTML(asset.id)}">Save</button> <button class="button secondary compact-button" type="button" data-delete-media-id="${escapeHTML(asset.id)}" data-delete-media-path="${escapeHTML(path || "")}">Delete</button></span></div>`; }).join("")}</div>` : '<p class="empty-state">No uploaded media yet.</p>';
  } catch (error) { uploadedMediaList.innerHTML = '<p class="empty-state">Could not load uploaded media.</p>'; }
}

if (uploadedMediaList) loadUploadedMedia();

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-import-built-in-media]");
  if (!button) return;
  const status = document.querySelector("[data-import-media-status]");
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  const user = JSON.parse(localStorage.getItem(adminSessionStorageKey) || "null")?.user;
  const photos = [
    ["assets/training-platform-rider.jpg", "Training platform rider"], ["assets/pole-bending-rider.jpg", "Pole bending rider"], ["assets/groundwork-obstacle-day.jpg", "Groundwork obstacle day"], ["assets/show-ring-rider.jpg", "Show ring rider"],
  ];
  if (!config || !token || !user) return;
  button.disabled = true;
  if (status) status.textContent = "Importing gallery...";
  try {
    await Promise.all(photos.map(async ([source]) => { const file = await fetch(source).then((response) => response.blob()); const path = `gallery-${source.split("/").pop()}`; const upload = await fetch(`${config.url}/storage/v1/object/club-media/${path}`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": file.type, "x-upsert": "true" }, body: file }); if (!upload.ok) throw new Error("Could not import gallery image"); await requestSupabase("/rest/v1/media_assets", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ storage_path: path, object_path: path, alt_text: "", caption: "", published_at: new Date().toISOString(), uploaded_by: user.id }) }); }));
    if (status) status.textContent = "Current gallery imported.";
    await loadUploadedMedia();
  } catch (error) { if (status) status.textContent = `Import failed: ${error.message}`; }
  finally { button.disabled = false; }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-media-id]");
  if (!button) return;
  const row = button.closest("[role='row']");
  const homepageSlot = row?.querySelector("[data-homepage-slot-select]")?.value || null;
  try {
    if (homepageSlot) await requestSupabase(`/rest/v1/media_assets?homepage_slot=eq.${encodeURIComponent(homepageSlot)}&id=neq.${encodeURIComponent(button.dataset.saveMediaId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ homepage_slot: null }) });
    await requestSupabase(`/rest/v1/media_assets?id=eq.${encodeURIComponent(button.dataset.saveMediaId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ homepage_slot: homepageSlot }) });
    await loadUploadedMedia();
  } catch (error) { alert(`Could not save homepage placement: ${error.message}`); }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-media-id]");
  if (!button || !window.confirm("Delete this photo permanently?")) return;
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  if (!config || !token) { alert("Admin sign-in is required to delete media."); return; }
  button.disabled = true;
  try {
    const path = button.dataset.deleteMediaPath;
    if (path) {
      const storageDelete = await fetch(`${config.url}/storage/v1/object/club-media`, {
        method: "DELETE",
        headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
      if (!storageDelete.ok) {
        const detail = await storageDelete.text().catch(() => "");
        throw new Error(`Storage deletion failed (${storageDelete.status})${detail ? `: ${detail}` : ""}`);
      }
    }
    const deletedAssets = await requestSupabase(`/rest/v1/media_assets?id=eq.${encodeURIComponent(button.dataset.deleteMediaId)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    if (!Array.isArray(deletedAssets) || !deletedAssets.length) throw new Error("Media record was not deleted from Supabase.");
    await loadUploadedMedia();
  } catch (error) { alert(`Could not delete photo: ${error.message}`); }
  finally { button.disabled = false; }
});

if (judgeAssignmentForm) {
  judgeAssignmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(judgeAssignmentForm);
    const status = judgeAssignmentForm.querySelector("[data-judge-assignment-status]");
    try {
      await requestSupabase("/rest/v1/judge_assignments", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ event_id: formData.get("event"), user_id: String(formData.get("userId")).trim(), assigned_by: JSON.parse(localStorage.getItem(adminSessionStorageKey)).user.id }) });
      judgeAssignmentForm.reset();
      status.textContent = "Judge access granted for that show.";
    } catch (error) { status.textContent = `Could not grant access: ${error.message}`; }
  });
}

if (document.querySelector("[data-event-page]")) {
  loadRegistrations();
}

if (document.querySelector("[data-results-page]")) {
  loadResultsPage();
}

if (document.querySelector("[data-judging-page]")) {
  (async () => {
    if (!await getFreshJudgeAccessToken() && !await getFreshAdminAccessToken()) window.location.replace("judge-login.html");
    else loadJudgingPage();
  })();
}

if (document.querySelector("[data-points-page]")) {
  loadPointsPage();
}

if (adminForm) {
  const externalFields = adminForm.querySelector("[data-external-event-fields]");
  const updateExternalFields = () => {
    if (!externalFields) return;
    const isExternal = String(adminForm.querySelector("[name='type']")?.value || "").startsWith("external-");
    externalFields.hidden = !isExternal;
    externalFields.querySelectorAll("input").forEach((input) => { input.required = isExternal; });
  };
  adminForm.querySelector("[name='type']")?.addEventListener("change", updateExternalFields);
  updateExternalFields();
  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(adminForm);
    const eventDate = formData.get("date");
    const newEvent = {
      id: `admin-${Date.now()}`,
      type: formData.get("type"),
      date: eventDate,
      title: formData.get("title").trim(),
      location: formData.get("location").trim(),
      description: formData.get("description").trim(),
      event_settings: String(formData.get("type")).startsWith("external-") ? { provider_url: String(formData.get("provider_url") || "").trim(), external_cost: String(formData.get("external_cost") || "").trim() } : String(formData.get("type")) === "club" ? { club_day_fee: defaultClubDayFee } : String(formData.get("type")) === "clinic" ? { clinic_fee: defaultClinicFee } : {},
    };

    try {
      const created = await requestSupabase("/rest/v1/events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(newEvent),
      });
      await loadSharedEvents();
      adminForm.reset();
      window.location.href = `admin-event.html?event=${encodeURIComponent(created?.[0]?.id || newEvent.id)}`;
    } catch (error) {
      console.error("Shared event save failed:", error);
      alert("Could not save the event. Please sign in as an admin and try again.");
    }
  });
}

if (refreshRegistrations) {
  refreshRegistrations.addEventListener("click", () => {
    loadRegistrations();
  });
}

const refreshEventDetail = document.querySelector("[data-refresh-event-detail]");

if (refreshEventDetail) {
  refreshEventDetail.addEventListener("click", () => {
    loadRegistrations();
  });
}

const refreshResults = document.querySelector("[data-refresh-results]");

if (refreshResults) {
  refreshResults.addEventListener("click", () => {
    loadResultsPage();
  });
}

document.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-drag-entry]");

  if (!row) return;

  draggedShowEntry = {
    entryId: row.dataset.dragEntry,
    className: row.dataset.className,
  };
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.dragEntry);
});

document.addEventListener("dragover", (event) => {
  const row = event.target.closest("[data-drag-entry]");

  if (!row || !draggedShowEntry || row.dataset.className !== draggedShowEntry.className) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".show-drag-over").forEach((item) => item.classList.remove("show-drag-over"));
  row.classList.add("show-drag-over");
});

document.addEventListener("drop", (event) => {
  const targetRow = event.target.closest("[data-drag-entry]");

  if (!targetRow || !draggedShowEntry || targetRow.dataset.className !== draggedShowEntry.className) return;

  event.preventDefault();

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event");
  const table = targetRow.closest(".show-class-table");

  if (!eventId || !table) return;
  if (targetRow.dataset.dragEntry === draggedShowEntry.entryId) return;

  const orderedEntryIds = [...table.querySelectorAll("[data-drag-entry]")]
    .map((row) => row.dataset.dragEntry)
    .filter((entryId) => entryId !== draggedShowEntry.entryId);
  const targetIndex = orderedEntryIds.indexOf(targetRow.dataset.dragEntry);
  orderedEntryIds.splice(targetIndex === -1 ? orderedEntryIds.length : targetIndex, 0, draggedShowEntry.entryId);
  reorderShowClassEntries(eventId, draggedShowEntry.className, orderedEntryIds);
  renderEventPage(adminRegistrations);
});

document.addEventListener("dragend", () => {
  draggedShowEntry = null;
  document.querySelectorAll(".is-dragging, .show-drag-over").forEach((item) => {
    item.classList.remove("is-dragging", "show-drag-over");
  });
});

document.addEventListener("input", (event) => {
  if (!event.target.closest("[data-results-page]")) return;

  if (event.target.matches("[data-score-input], [data-timing-input]")) {
    if (event.target.matches("[data-score-input]") && event.target.value !== "") {
      const score = Number(event.target.value);
      event.target.value = String(Math.min(10, Math.max(0, Number.isFinite(score) ? score : 0)));
    }
    updateResultsTotalsFromDom();
    const row = event.target.closest("[data-result-entry]");
    if (row) scheduleSaveResultRow(row);
  }
});

document.addEventListener("change", (event) => {
  if (!event.target.closest("[data-results-page]")) return;

  const row = event.target.closest("[data-result-entry]");

  if (row && event.target.matches("[data-score-input], [data-timing-input]")) {
    saveResultRow(row);
  }
});

document.addEventListener("click", async (event) => {
  const scratchButton = event.target.closest("[data-scratch-toggle]");

  if (!scratchButton) return;

  const row = scratchButton.closest("[data-result-entry]");

  if (!row) return;

  const isScratched = row.dataset.scratched !== "true";
  row.dataset.scratched = isScratched ? "true" : "false";
  row.classList.toggle("is-scratched", isScratched);
  scratchButton.textContent = isScratched ? "Unscratch" : "Scratch";
  row.querySelectorAll("[data-score-input], [data-timing-input]").forEach((input) => {
    input.disabled = isScratched;
  });

  updateResultsTotalsFromDom();
  await saveResultRow(row);
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-publish-event-results]");
  if (!button || !window.confirm("Publish completed results, remove judge access, and archive this event?")) return;
  const eventId = button.dataset.eventId;
  const eventRegistrations = adminRegistrations.filter((registration) => getRegistrationEventId(registration) === eventId);
  if (!isShowJudgingComplete(eventId, eventRegistrations, showResults.filter((result) => result.event_id === eventId))) { alert("All classes must be processed before results can be published and archived."); return; }
  button.disabled = true;
  try {
    if (!button.textContent.includes("Archive published")) await setEventResultsPublication(eventId);
    await requestSupabase(`/rest/v1/judge_assignments?event_id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" });
    await archiveEvent(eventId);
    window.location.href = "admin.html";
  } catch (error) { alert(`Could not publish and archive event: ${error.message}`); button.disabled = false; }
});

document.addEventListener("click", async (event) => {
  const cancelButton = event.target.closest("[data-cancel-event]");
  if (!cancelButton) return;
  const message = window.prompt("Optional message for registered attendees:");
  if (message === null) return;
  if (!window.confirm(`Cancel ${cancelButton.dataset.eventTitle} and email registered attendees?`)) return;
  const config = getSupabaseConfig();
  const token = getAdminAccessToken();
  if (!config || !token) return;
  cancelButton.disabled = true;
  try {
    const response = await fetch(`${config.url}/functions/v1/cancel-event`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: cancelButton.dataset.eventId, eventTitle: cancelButton.dataset.eventTitle, message }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Cancellation notification failed");
    alert(`${result.archived ? "Show cancelled and moved to Archived Events." : "Event cancelled and removed from public listings."} ${result.emailConfigured ? `${result.sentCount || 0} attendee email${result.recipientCount === 1 ? "" : "s"} sent.` : "Email delivery is not configured yet."}`);
    window.location.href = "admin.html";
  } catch (error) {
    alert(`Could not cancel this event: ${error.message}`);
  } finally {
    cancelButton.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-member]");
  if (!editButton) return;
  editingMemberId = editButton.dataset.registrationId;
  renderEventPage(adminRegistrations);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-cancel-member-edit]")) return;
  editingMemberId = null;
  renderEventPage(adminRegistrations);
});

document.addEventListener("click", async (event) => {
  const transferButton = event.target.closest("[data-transfer-attendee]");
  if (!transferButton) return;
  const row = transferButton.closest("[role='row']");
  const destinationId = row?.querySelector("[data-transfer-destination]")?.value;
  const destination = getEvents().find((item) => item.id === destinationId && item.type === "club");
  const registration = adminRegistrations.find((item) => item.id === transferButton.dataset.registrationId);
  if (!destination || !registration) { alert("Choose the destination club day first."); return; }
  if (!window.confirm(`Transfer ${getParticipantName(registration)} to ${destination.title}?`)) return;
  const payload = { ...registration.payload, "club-date": destination.id };
  transferButton.disabled = true;
  try {
    await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registration.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ payload }) });
    await requestSupabase("/rest/v1/attendee_transfers", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ registration_id: registration.id, from_event_id: transferButton.dataset.fromEvent, to_event_id: destination.id }) });
    await loadRegistrations();
  } catch (error) { alert(`Could not transfer attendee: ${error.message}`); transferButton.disabled = false; }
});

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-download-attendee-list]");
  if (!button) return;
  const eventId = button.dataset.eventId;
  const eventDetails = getEventDetails(eventId);
  const registrations = adminRegistrations.filter((registration) => getRegistrationEventId(registration) === eventId);
  const rows = [["Attended", "Rider name", "Horse name", "Day membership form", "Email", "Phone", "Cost"], ...registrations.map((registration) => {
    const payload = registration.payload || {};
    return [payload.attended === true ? "Yes" : "No", getParticipantName(registration), getRegistrationHorseNames(registration), needsDayMembershipForm(registration) ? "Bring form" : "Not required", payload["clinic-email"] || payload["participant-email"] || "", payload["clinic-phone"] || payload["participant-phone"] || "", formatCurrency(getRegistrationRevenue(registration))];
  })];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${String(eventDetails.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendee-list.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-attendance-registration]");
  if (!checkbox) return;
  const registration = adminRegistrations.find((item) => item.id === checkbox.dataset.attendanceRegistration);
  if (!registration) return;
  checkbox.disabled = true;
  try {
    const payload = { ...(registration.payload || {}), attended: checkbox.checked };
    await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registration.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ payload }) });
    registration.payload = payload;
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    alert(`Could not save attendance: ${error.message}`);
  } finally { checkbox.disabled = false; }
});

document.addEventListener("click", async (event) => {
  const processButton = event.target.closest("[data-process-results]");

  if (!processButton) return;

  processButton.disabled = true;
  processButton.textContent = "Processing...";

  try {
    await processResultsFromDom();
    await loadResultsPage();
  } finally {
    processButton.disabled = false;
    processButton.textContent = "Process Results";
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-judge-logout]")) return;
  localStorage.removeItem(judgeSessionStorageKey);
  window.location.href = "index.html";
});

document.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-toggle-manual-entry]");

  if (!toggleButton) return;

  const panel = document.querySelector("[data-manual-entry-panel]");

  if (!panel) return;

  panel.hidden = !panel.hidden;
  toggleButton.textContent = panel.hidden ? "Add Manual Entry" : "Hide Manual Entry";
});

document.addEventListener("click", async (event) => {
  const addButton = event.target.closest("[data-add-result-entry]");

  if (!addButton) return;

  const page = addButton.closest("[data-results-page]");
  const participantField = page?.querySelector("[data-add-result-participant]");
  const horseField = page?.querySelector("[data-add-result-horse]");
  const ridingLevelField = page?.querySelector("[data-add-result-riding-level]");
  const { eventId, className } = getResultPageParams();
  const participant = participantField?.value.trim();
  const horseName = horseField?.value.trim();

  if (!eventId || !className || !participant || !horseName) return;

  const entryId = `manual-${Date.now()}`;

  try {
    await upsertShowResult({
      event_id: eventId,
      class_name: className,
      entry_id: entryId,
      participant_name: participant,
      horse_name: horseName,
      riding_class: ridingLevelField?.value.trim() || "",
      obstacle_scores: {},
      timing_seconds: null,
      scratched: false,
    });

    if (participantField) participantField.value = "";
    if (horseField) horseField.value = "";
    if (ridingLevelField) ridingLevelField.value = "";
    await loadResultsPage();
  } catch (error) {
    console.error("Manual result entry save failed:", error);
  }
});

document.addEventListener("submit", async (event) => {
  const pricingForm = event.target.closest("[data-event-pricing-form]");
  if (pricingForm) {
    event.preventDefault();
    const formData = new FormData(pricingForm);
    const eventId = pricingForm.dataset.eventId;
    const currentEvent = getEventDetails(eventId);
    const classPrices = Object.fromEntries(showClassSlugs.map((slug) => [slug, Number(formData.get(`class_${slug}`) || 0)]));
    const settings = currentEvent.type === "club" ? { club_day_fee: Number(formData.get("club_day_fee") || 0) } : currentEvent.type === "clinic" ? { ...(currentEvent.event_settings || {}), clinic_fee: Number(formData.get("clinic_fee") || 0) } : { dinner_price: Number(formData.get("dinner_price") || 0), powered_camping_price: Number(formData.get("powered_camping_price") || 0), unpowered_camping_price: Number(formData.get("unpowered_camping_price") || 0), yard_price: Number(formData.get("yard_price") || 0), dinner_vendor_url: String(formData.get("dinner_vendor_url") || "").trim(), custom_information: String(formData.get("custom_information") || "").trim(), class_prices: classPrices };
    const status = pricingForm.querySelector("[data-event-pricing-status]");
    try {
      await requestSupabase(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ event_settings: settings }) });
      await loadSharedEvents();
      if (status) status.textContent = "Saved.";
    } catch (error) { if (status) status.textContent = `Could not save: ${error.message}`; }
    return;
  }
  const judgeForm = event.target.closest("[data-judge-credentials-form]");
  if (judgeForm) {
    event.preventDefault();
    const formData = new FormData(judgeForm);
    const status = judgeForm.querySelector("[data-judge-credentials-status]");
    const config = getSupabaseConfig();
    const token = getAdminAccessToken();
    fetch(`${config.url}/functions/v1/manage-judge-credentials`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ eventId: judgeForm.dataset.eventId, username: formData.get("username"), password: formData.get("password") }) })
      .then(async (response) => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "Could not save judge access"); status.textContent = `Assigned judge login “${result.loginName}” to this show. Use that exact login name on the judge sign-in page.`; await loadJudgeAssignmentSummary(judgeForm.dataset.eventId); })
      .catch((error) => { status.textContent = error.message; });
    return;
  }
  const memberForm = event.target.closest("[data-member-edit-form]");
  if (memberForm) {
    event.preventDefault();
    const registration = adminRegistrations.find((item) => item.id === memberForm.dataset.registrationId);
    if (!registration) return;
    const formData = new FormData(memberForm);
    const payload = { ...registration.payload };
    ["club-first-name", "club-last-name", "club-email", "club-phone", "riding-level", "emergency-first-name", "emergency-last-name", "emergency-phone"].forEach((field) => {
      payload[field] = String(formData.get(field) || "").trim();
    });
    const status = memberForm.querySelector("[data-member-edit-status]");
    try {
      await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registration.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ payload }) });
      editingMemberId = null;
      await loadRegistrations();
    } catch (error) {
      if (status) status.textContent = `Could not save member: ${error.message}`;
    }
    return;
  }
  const editForm = event.target.closest("[data-event-edit-form]");

  if (!editForm) return;

  event.preventDefault();

  const formData = new FormData(editForm);
  const eventId = editForm.dataset.eventId;
  const currentEvent = getEventDetails(eventId);
  const updatedEvent = {
    ...currentEvent,
    id: eventId,
    type: currentEvent.type,
    date: formData.get("date"),
    title: formData.get("title").trim(),
    location: formData.get("location").trim(),
    description: formData.get("description").trim(),
    judge_name: currentEvent.judge_name || null,
    event_settings: String(currentEvent.type).startsWith("external-") ? { ...(currentEvent.event_settings || {}), provider_url: String(formData.get("provider_url") || "").trim(), external_cost: String(formData.get("external_cost") || "").trim() } : currentEvent.event_settings || {},
  };
  const status = editForm.querySelector("[data-event-edit-status]");

  try {
    await requestSupabase(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ type: updatedEvent.type, date: updatedEvent.date, title: updatedEvent.title, location: updatedEvent.location, description: updatedEvent.description, judge_name: updatedEvent.judge_name, event_settings: updatedEvent.event_settings }) });
    await loadSharedEvents();
    if (status) { status.hidden = false; status.textContent = "Event details saved."; }
    renderEventPage(adminRegistrations);
  } catch (error) {
    if (status) { status.hidden = false; status.textContent = `Could not save event: ${error.message}`; }
  }
});

const showRegistrationForm = document.querySelector("[data-show-registration-form]");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function getPrice(field) {
  return Number(field.dataset.price || 0);
}

function updateHorseEntryNames(entry, index) {
  const horseNumber = index + 1;
  const heading = entry.querySelector(".horse-entry-heading h3");
  const horseName = entry.querySelector("input[name$='-name']");
  const classInputs = entry.querySelectorAll("[data-class-group] input[type='checkbox']");

  if (heading) {
    heading.textContent = `Horse ${horseNumber}`;
  }

  if (horseName) {
    horseName.name = `horse-${horseNumber}-name`;
  }

  classInputs.forEach((input, classIndex) => {
    input.name = `horse-${horseNumber}-class-${showClassSlugs[classIndex]}`;
  });
}

function updateHorseClassLimit(entry) {
  const classInputs = [...entry.querySelectorAll("[data-class-group] input[type='checkbox']")];
  const selectedCount = classInputs.filter((input) => input.checked).length;
  const limitMessage = entry.querySelector("[data-class-limit-message]");

  classInputs.forEach((input) => {
    input.disabled = !input.checked && selectedCount >= 3;
  });

  if (limitMessage) {
    limitMessage.hidden = selectedCount < 3;
  }
}

function updateAllHorseNames(form) {
  form.querySelectorAll("[data-horse-entry]").forEach((entry, index) => {
    updateHorseEntryNames(entry, index);
    updateHorseClassLimit(entry);
  });
}

function updateShowTotals(form) {
  if (!form) return;

  const checkedPriceFields = [...form.querySelectorAll("input[type='checkbox'][data-price]:checked, input[type='radio'][data-price]:checked")];
  const numberPriceFields = [...form.querySelectorAll("input[type='number'][data-price]")];
  const campingNightCount = Number(form.querySelector("[name='camping-night-count']")?.value || 0);
  const campingTotal = [...form.querySelectorAll("input[name='camping-with-power'][data-price]:checked, input[name='camping-without-power'][data-price]:checked")]
    .reduce((total, field) => total + getPrice(field) * campingNightCount, 0);
  const classTotal = checkedPriceFields
    .filter((field) => field.name.includes("-class-"))
    .reduce((total, field) => total + getPrice(field), 0);
  const membershipTotal = checkedPriceFields
    .filter((field) => field.name === "aeora-membership" && field.value === "day")
    .reduce((total, field) => total + getPrice(field), 0);
  const extrasCheckboxTotal = checkedPriceFields
    .filter((field) => !field.name.includes("-class-") && !field.name.startsWith("camping-") && field.name !== "aeora-membership")
    .reduce((total, field) => total + getPrice(field), 0);
  const extrasNumberTotal = numberPriceFields.reduce((total, field) => {
    if (field.name === "camping-night-count") return total;
    return total + Number(field.value || 0) * getPrice(field);
  }, 0);
  const extrasTotal = campingTotal + extrasCheckboxTotal + extrasNumberTotal;
  const grandTotal = classTotal + extrasTotal + membershipTotal;

  form.querySelector("[data-class-total]").textContent = formatCurrency(classTotal);
  form.querySelector("[data-extras-total]").textContent = formatCurrency(extrasTotal);
  form.querySelector("[data-membership-total]").textContent = formatCurrency(membershipTotal);
  form.querySelector("[data-grand-total]").textContent = formatCurrency(grandTotal);
  form.querySelector("[data-calculated-total]").value = String(grandTotal);
}

function addHorseEntry(form) {
  const horseList = form.querySelector("[data-horse-list]");
  const firstEntry = horseList?.querySelector("[data-horse-entry]");

  if (!horseList || !firstEntry) return;

  const newEntry = firstEntry.cloneNode(true);

  newEntry.querySelectorAll("input").forEach((input) => {
    if (input.type === "checkbox") {
      input.checked = false;
      input.disabled = false;
      return;
    }

    input.value = "";
  });

  const existingRemoveButton = newEntry.querySelector("[data-remove-horse]");

  if (existingRemoveButton) {
    existingRemoveButton.remove();
  }

  const heading = newEntry.querySelector(".horse-entry-heading");
  const removeButton = document.createElement("button");
  removeButton.className = "button secondary compact-button";
  removeButton.type = "button";
  removeButton.dataset.removeHorse = "";
  removeButton.textContent = "Remove";
  heading?.append(removeButton);

  horseList.append(newEntry);
  updateAllHorseNames(form);
  updateShowTotals(form);
}

if (showRegistrationForm) {
  updateAllHorseNames(showRegistrationForm);
  updateShowTotals(showRegistrationForm);

  showRegistrationForm.addEventListener("change", (event) => {
    const target = event.target;

    if (target.matches("[data-add-horse]") && target.checked) {
      addHorseEntry(showRegistrationForm);
      target.checked = false;
    }

    const horseEntry = target.closest("[data-horse-entry]");

    if (horseEntry && target.matches("[data-class-group] input[type='checkbox']")) {
      updateHorseClassLimit(horseEntry);
    }

    updateShowTotals(showRegistrationForm);
  });

  showRegistrationForm.addEventListener("input", () => {
    updateShowTotals(showRegistrationForm);
  });

  showRegistrationForm.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-horse]");

    if (!removeButton) return;

    removeButton.closest("[data-horse-entry]")?.remove();
    updateAllHorseNames(showRegistrationForm);
    updateShowTotals(showRegistrationForm);
  });
}

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteEvent;
  writeAdminEvents(readAdminEvents().filter((item) => item.id !== id));
  renderAdminEventList();
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-shared-event]");
  if (!button || !window.confirm("Delete this event listing?")) return;
  try {
    await deleteEventData(button.dataset.deleteSharedEvent);
    await requestSupabase(`/rest/v1/events?id=eq.${encodeURIComponent(button.dataset.deleteSharedEvent)}`, { method: "DELETE" });
    adminRegistrations = await fetchRegistrations().catch(() => adminRegistrations);
    await loadSharedEvents();
    renderAdminEventList();
  } catch (error) { alert(`Could not delete event: ${error.message}`); }
});

const staticForms = document.querySelectorAll("form:not([data-admin-login]):not([data-event-admin-form]):not([data-club-settings-form]):not([data-obstacle-setup-form]):not([data-member-detail-form])");

function getFormType() {
  const pageName = window.location.pathname.split("/").pop() || "index.html";
  return registrationFormTypes[pageName] || "website_form";
}

function getFormPayload(form) {
  function addPayloadValue(payload, name, value) {
    if (Object.prototype.hasOwnProperty.call(payload, name)) {
      payload[name] = Array.isArray(payload[name]) ? [...payload[name], value] : [payload[name], value];
      return payload;
    }

    payload[name] = value;
    return payload;
  }

  const payload = [...form.elements].reduce((payload, field) => {
    if (!field.name || field.disabled || ["submit", "button", "fieldset"].includes(field.type)) {
      return payload;
    }

    if (field.type === "checkbox") {
      return addPayloadValue(payload, field.name, field.checked);
    }

    if (field.type === "radio") {
      return field.checked ? addPayloadValue(payload, field.name, field.value) : payload;
    }

    return addPayloadValue(payload, field.name, field.value);
  }, {});

  if (form.matches("[data-show-registration-form]")) {
    payload["aeora-annual-membership"] = payload["aeora-membership"] === "annual";
    payload["aeora-day-membership"] = payload["aeora-membership"] === "day";
  }
  if (form.matches(".registration-form") && document.querySelector("[name='club-date']")) {
    const clubDayFee = Number(form.dataset.eventFee || defaultClubDayFee);
    payload["calculated-total"] = clubDayFee + (payload["club-day-day-membership"] === true ? defaultDayMembershipFee : 0);
  }
  if (form.matches("[data-annual-membership-form]")) payload["calculated-total"] = getSelectedMembershipFee(form);
  if (form.matches("[data-clinic-registration-form]")) payload["calculated-total"] = Number(form.dataset.eventFee || defaultClinicFee);

  return payload;
}

function setFormSubmitting(form, isSubmitting) {
  const submitButton = form.querySelector("[type='submit']");

  if (!submitButton) return;

  submitButton.disabled = isSubmitting;
  if (!submitButton.dataset.originalText) {
    submitButton.dataset.originalText = submitButton.textContent;
  }
  submitButton.textContent = isSubmitting ? "Submitting..." : submitButton.dataset.originalText;
}

async function submitRegistrationForm(form) {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    throw new Error("Supabase is not configured for this page.");
  }

  const submission = {
    form_type: getFormType(),
    page_path: window.location.pathname,
    payload: getFormPayload(form),
  };

  const response = await fetch(`${supabaseConfig.url}/rest/v1/registrations`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Submission failed (${response.status})`;
    try {
      const errorData = JSON.parse(errorBody);
      message = errorData.message || errorData.error || message;
    } catch {
      if (errorBody) message = errorBody;
    }
    throw new Error(message);
  }

}

staticForms.forEach((form) => {
  form.dataset.supabaseReady = window.SEORC_SUPABASE ? "true" : "false";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    let status = form.querySelector(".form-status");

    if (!status) {
      status = document.createElement("p");
      status.className = "form-status";
      status.setAttribute("role", "status");
      form.append(status);
    }

    setFormSubmitting(form, true);
    status.textContent = "Submitting...";

    try {
      await submitRegistrationForm(form);

      if (form.matches("[data-show-registration-form]")) {
        window.location.href = "show-registration-confirmation.html";
        return;
      }

      form.reset();
      populateEventSelects();
      status.textContent = "Thanks, your registration has been submitted.";
    } catch (error) {
      status.textContent = `Registration could not be submitted: ${error.message}`;
      console.error("Supabase registration submission failed:", error);
    } finally {
      setFormSubmitting(form, false);
    }
  });
});

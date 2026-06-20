const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const eventStorageKey = "seorcEvents";
const adminSessionStorageKey = "seorcAdminSession";
const eventOverrideStorageKey = "seorcEventOverrides";
const showOrderStorageKey = "seorcShowClassOrder";
const defaultClubDayFee = 30;
const defaultDayMembershipFee = 30;
const showObstacleCount = 14;
let adminRegistrations = [];
let showResults = [];
let remoteEvents = [];
let draggedShowEntry = null;
const resultSaveTimers = new WeakMap();
const typeLabels = {
  club: "Club Day",
  show: "Show",
  clinic: "Clinic",
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
  "show-registration.html": "show_registration",
};
const registrationFormLabels = {
  club_membership: "Club Membership",
  club_day_registration: "Club Day Registration",
  show_registration: "Show Registration",
  website_form: "Website Form",
};
const showClassSlugs = [
  "open",
  "limited-open",
  "amateur",
  "masters",
  "encouragement",
  "rookie",
  "junior",
  "young-rider",
  "green-horse",
];

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
  if (remoteEvents.length) return [...remoteEvents].sort((a, b) => a.date.localeCompare(b.date));
  const overrides = readEventOverrides();
  return [...defaultEvents, ...readAdminEvents()]
    .map((event) => ({ ...event, ...(overrides[event.id] || {}) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function loadSharedEvents() {
  try {
    remoteEvents = await requestSupabase("/rest/v1/events?select=*&order=date.asc");
    renderCalendarEvents();
    populateEventSelects();
    renderEventDashboard(adminRegistrations);
  } catch (error) {
    console.warn("Shared events could not be loaded; using the existing local list.", error);
  }
}

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
  return "club-day-registration.html";
}

function renderCalendarEvents(filter = "all") {
  const eventList = document.querySelector("[data-event-list]");

  if (!eventList) return;

  const today = new Date().toISOString().slice(0, 10);
  const events = getEvents().filter((event) => event.date >= today && (filter === "all" || event.type === filter));
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
        <p>${escapeHTML(event.location)}. ${escapeHTML(event.description)}</p>
      </div>
      <a class="text-link" href="${registrationPageForType(event.type)}">Register</a>
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
populateEventSelects();
loadSharedEvents();

async function loadAchievedEventsPage() {
  const container = document.querySelector("[data-achieved-event-list]");
  if (!container) return;
  try {
    const archived = await requestSupabase("/rest/v1/achieved_events?select=*&order=event_date.desc");
    container.innerHTML = archived.length ? archived.map((item) => {
      const event = item.event_data || {};
      const results = Array.isArray(item.results) ? item.results : [];
      return `<article class="event-item achieved-event"><time datetime="${escapeHTML(event.date || item.event_date)}"><span>${escapeHTML(formatDateParts(event.date || item.event_date).day)}</span>${escapeHTML(formatDateParts(event.date || item.event_date).month)}</time><div><p class="event-type">${escapeHTML(typeLabels[event.type] || "Achieved event")}</p><h2>${escapeHTML(event.title || "SEORC event")}</h2><p>${escapeHTML(event.location || "")}. ${escapeHTML(event.description || "")}</p><p><strong>${results.length}</strong> published result${results.length === 1 ? "" : "s"} recorded.</p></div></article>`;
    }).join("") : '<p class="empty-state">No achieved events have been archived yet.</p>';
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Could not load achieved events.</p>';
    console.error("Achieved events load failed:", error);
  }
}

loadAchievedEventsPage();

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

  const events = readAdminEvents().sort((a, b) => a.date.localeCompare(b.date));
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
      <button class="button secondary" type="button" data-delete-event="${event.id}">Delete</button>
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

  return payload["show-date"] || payload["club-date"] || payload["event-id"] || "unknown-event";
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
  const firstName = payload["participant-first-name"] || payload["club-day-first-name"] || payload["club-first-name"];
  const lastName = payload["participant-last-name"] || payload["club-day-last-name"] || payload["club-last-name"];
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
    return payload["club-day-aeora-member"] === false;
  }

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
        ridingClass: payload["riding-class"] || "Not supplied",
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

  const minutes = Math.floor(timing / 60);
  const seconds = timing - minutes * 60;
  const secondText = seconds.toFixed(2).padStart(5, "0");

  return `${minutes}:${secondText}`;
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
  return getObstacleScoreTotal({ obstacleScores: result.obstacle_scores || {} });
}

function formatPoints(points) {
  const value = Number(points);

  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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

  let previousPoints = null;
  let previousRank = 0;

  return `
    <div class="admin-data-table points-table ${type === "combo" ? "points-combo-table" : "points-rider-table"}" role="table" aria-label="${type === "combo" ? "Rider and horse points" : "Rider points"}">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Rider</span>
        ${type === "combo" ? '<span role="columnheader">Horse</span>' : ""}
        <span role="columnheader">Points</span>
        <span role="columnheader">Entries</span>
        <span role="columnheader">Events</span>
      </div>
      ${rows
        .map((row, index) => {
          const rank = row.points === previousPoints ? previousRank : index + 1;
          previousPoints = row.points;
          previousRank = rank;

          return `
            <div role="row" class="admin-table-row">
              <span role="cell"><strong>${rank}</strong></span>
              <span role="cell">${escapeHTML(row.name)}</span>
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
      summary.textContent = `${annualPoints.countedResults.length} processed results counted for ${year}.`;
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

function renderEventEditForm(event) {
  if (event.id === "club-members") return "";

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
        <label>
          Event type
          <select name="type" required>
            <option value="club"${event.type === "club" ? " selected" : ""}>Club Day</option>
            <option value="show"${event.type === "show" ? " selected" : ""}>Show</option>
            <option value="clinic"${event.type === "clinic" ? " selected" : ""}>Clinic</option>
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows="4">${escapeHTML(event.description || "")}</textarea>
      </label>
      <button class="button primary form-submit" type="submit">Save Event Details</button>
      <div class="admin-actions">
        <button class="button secondary form-submit" type="button" data-cancel-event data-event-id="${escapeHTML(event.id)}" data-event-title="${escapeHTML(event.title)}">Cancel &amp; notify attendees</button>
      </div>
      <p class="form-status" data-event-edit-status hidden></p>
    </form>
  `;
}

function renderClubMembersDetail(registrations) {
  return `
    <div class="admin-data-table member-table" role="table" aria-label="Club members">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Name</span>
        <span role="columnheader">Email</span>
        <span role="columnheader">Phone</span>
        <span role="columnheader">Riding level</span>
        <span role="columnheader">Horse level</span>
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
              <span role="cell">${escapeHTML(payload["horse-level"] || "Not supplied")}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderClubDayDetail(group) {
  return `
    <p class="field-note">Each rider needing a day membership adds ${formatCurrency(defaultDayMembershipFee)} to the event total. Paid club-day registrations use a temporary ${formatCurrency(defaultClubDayFee)} default fee.</p>
    <div class="admin-data-table club-day-table" role="table" aria-label="${escapeHTML(group.event.title)} attendees">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Name</span>
        <span role="columnheader">Horse</span>
        <span role="columnheader">Day membership</span>
        <span role="columnheader">Paid</span>
        <span role="columnheader">Cost</span>
      </div>
      ${group.registrations
        .map((registration) => {
          const payload = registration.payload || {};
          return `
            <div role="row" class="admin-table-row">
              <span role="cell">${escapeHTML(getParticipantName(registration))}</span>
              <span role="cell">${escapeHTML(getRegistrationHorseNames(registration))}</span>
              <span role="cell">${needsDayMembershipForm(registration) ? `Needed (${formatCurrency(defaultDayMembershipFee)})` : "Annual member"}</span>
              <span role="cell">${payload["club-day-paid"] === true ? "Yes" : "No"}</span>
              <span role="cell">${formatCurrency(getRegistrationRevenue(registration))}<button class="text-link" type="button" data-transfer-attendee data-registration-id="${escapeHTML(registration.id)}" data-from-event="${escapeHTML(getRegistrationEventId(registration))}">Transfer</button></span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderShowDetail(eventId, group, results = []) {
  const classGroups = getShowClassGroupsWithResults(eventId, group.registrations, results);
  const classNames = Object.keys(classGroups).sort();
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
    <dl class="show-extra-summary show-overview-summary">
      <div>
        <dt>Participants</dt>
        <dd>${group.registrations.length}</dd>
      </div>
      <div>
        <dt>Horses</dt>
        <dd>${horseTotal}</dd>
      </div>
      <div>
        <dt>Entries</dt>
        <dd>${classEntryTotal}</dd>
      </div>
    </dl>
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

  title.textContent = group.event.title;
  summaryText.textContent = `${dateLabel} | ${summary.attendees} registered | ${summary.dayMembershipForms} day membership forms | ${formatCurrency(summary.revenue)} total`;

  let detailContent = "";

  if (eventId === "club-members") {
    detailContent = renderClubMembersDetail(group.registrations);
  } else if (group.event.type === "show") {
    detailContent = renderShowDetail(eventId, group, showResults);
  } else {
    detailContent = renderClubDayDetail(group);
  }

  content.innerHTML = `
    <section class="event-registration-detail">
      <div class="event-detail-heading">
        <div>
          <p class="eyebrow">${escapeHTML(typeLabels[group.event.type] || humanizeFieldName(group.event.type))}</p>
          <h3>${escapeHTML(group.event.title)}</h3>
          <p>${escapeHTML(dateLabel)} at ${escapeHTML(group.event.location)}</p>
        </div>
        <dl class="event-detail-stats">
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
        </dl>
      </div>
      ${renderEventEditForm(group.event)}
      ${detailContent}
    </section>
  `;
}

function renderEventDashboard(registrations) {
  const dashboard = document.querySelector("[data-event-dashboard]");

  if (!dashboard) return;

  const groups = groupRegistrationsByEvent(registrations);
  const dashboardGroups = {
    "club-members": groups["club-members"] || {
      event: getEventDetails("club-members"),
      registrations: [],
    },
  };

  getEvents().forEach((event) => {
    dashboardGroups[event.id] = groups[event.id] || {
      event,
      registrations: [],
    };
  });

  Object.entries(groups).forEach(([eventId, group]) => {
    dashboardGroups[eventId] ||= group;
  });

  const groupEntries = Object.entries(dashboardGroups).sort(([, a], [, b]) => {
    if (a.event.id === "club-members") return -1;
    if (b.event.id === "club-members") return 1;
    return String(a.event.date).localeCompare(String(b.event.date));
  });

  dashboard.innerHTML = "";

  dashboard.innerHTML = `
    <div class="admin-data-table event-overview-table" role="table" aria-label="Registration events">
      <div role="row" class="admin-table-header">
        <span role="columnheader">Event</span>
        <span role="columnheader">Date</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Coming</span>
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

function renderJudgingDashboard(registrations, results = []) {
  const dashboard = document.querySelector("[data-judging-dashboard]");

  if (!dashboard) return;

  const groups = groupRegistrationsByEvent(registrations);
  const showEvents = getEvents().filter((event) => event.type === "show");

  dashboard.innerHTML = showEvents
    .map((event) => {
      const group = groups[event.id] || { event, registrations: [] };
      const eventResults = results.filter((result) => result.event_id === event.id);
      const classGroups = getShowClassGroupsWithResults(event.id, group.registrations, eventResults);
      const classNames = Object.keys(classGroups).sort();
      const processedClasses = new Set(eventResults.filter((result) => result.processed_at).map((result) => result.class_name));
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
        </section>
      `;
    })
    .join("");
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
  return Array.from({ length: showObstacleCount }, (_, index) => {
    const obstacleKey = `obstacle-${index + 1}`;
    const value = entry.obstacleScores?.[obstacleKey] ?? "";
    return `
      <label>
        O${index + 1}
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
                Timing seconds
                <input data-timing-input type="number" min="0" step="0.01" value="${escapeHTML(String(entry.timingSeconds ?? ""))}" ${entry.scratched ? "disabled" : ""}>
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
      <button class="button secondary form-submit" type="button" data-toggle-results-publication>${isPublished ? "Unpublish results" : "Publish results"}</button>
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
          Riding class
          <input data-add-result-riding-class type="text">
        </label>
      </div>
      <button class="button primary form-submit" type="button" data-add-result-entry>Add Entry</button>
      <p class="field-note">Obstacle scores are out of 10. Timing is used only to break ties in the same class; lower time wins the tie.</p>
    </section>
    ${renderResultsTable(entries)}
  `;
}

function getResultEntryFromRow(row) {
  const obstacleScores = {};

  row.querySelectorAll("[data-score-input]").forEach((input) => {
    obstacleScores[input.dataset.obstacleKey] = input.value === "" ? null : Number(input.value);
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
    adminRegistrations = await fetchRegistrations();
    const showEvents = getEvents().filter((event) => event.type === "show");
    const resultSets = await Promise.all(showEvents.map(async (event) => {
      try {
        return await fetchShowResultsForEvent(event.id);
      } catch (error) {
        console.warn("Supabase show results fetch failed. Run supabase-schema.sql to create show_results.", error);
        return [];
      }
    }));

    showResults = resultSets.flat();
    renderJudgingDashboard(adminRegistrations, showResults);

    if (summary) {
      const classCount = [...document.querySelectorAll(".judging-class-table .admin-table-row")].length;
      summary.textContent = `${showEvents.length} shows | ${classCount} classes ready for judging`;
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

  const headers = {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${getAdminAccessToken() || supabaseConfig.anonKey}`,
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

  return response.json();
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
  return requestSupabase("/rest/v1/show_results?select=*&order=created_at.asc");
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

async function setResultsPublication(published) {
  const { eventId, className } = getResultPageParams();
  const query = new URLSearchParams({ event_id: `eq.${eventId}`, class_name: `eq.${className}` });
  await requestSupabase(`/rest/v1/show_results?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ published_at: published ? new Date().toISOString() : null }),
  });
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

function showAdminDashboard() {
  const panel = document.querySelector("[data-admin-panel]");

  if (!panel) return;

  panel.hidden = !getAdminAccessToken();
  if (panel.hidden) return;
  renderAdminEventList();
  loadRegistrations();
}

const adminPanel = document.querySelector("[data-admin-panel]");
const adminLoginForm = document.querySelector("[data-admin-login]");
const adminForm = document.querySelector("[data-event-admin-form]");
const refreshRegistrations = document.querySelector("[data-refresh-registrations]");
const mediaUploadForm = document.querySelector("[data-media-upload]");
const judgeAssignmentForm = document.querySelector("[data-judge-assignment]");

if (adminPanel) {
  showAdminDashboard();
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
        body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
      });
      if (!response.ok) throw new Error("Sign-in failed");
      localStorage.setItem(adminSessionStorageKey, JSON.stringify(await response.json()));
      status.textContent = "Signed in.";
      showAdminDashboard();
    } catch (error) {
      status.textContent = "Could not sign in. Please check the email and password.";
    }
  });
}

if (mediaUploadForm) {
  mediaUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(mediaUploadForm);
    const file = formData.get("file");
    const status = mediaUploadForm.querySelector("[data-media-upload-status]");
    const config = getSupabaseConfig();
    const token = getAdminAccessToken();
    if (!(file instanceof File) || !config || !token) return;
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    status.textContent = "Uploading...";
    try {
      const upload = await fetch(`${config.url}/storage/v1/object/club-media/${encodeURIComponent(path)}`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
      if (!upload.ok) throw new Error("Upload failed");
      await requestSupabase("/rest/v1/media_assets", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ storage_path: path, alt_text: String(formData.get("alt") || ""), caption: String(formData.get("caption") || "") || null, uploaded_by: JSON.parse(localStorage.getItem(adminSessionStorageKey)).user.id }) });
      mediaUploadForm.reset();
      status.textContent = "Uploaded as a draft. Publish it from Supabase media_assets when ready.";
    } catch (error) { status.textContent = `Upload failed: ${error.message}`; }
  });
}

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
  loadJudgingPage();
}

if (document.querySelector("[data-points-page]")) {
  loadPointsPage();
}

if (adminForm) {
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
    };

    try {
      await requestSupabase("/rest/v1/events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(newEvent),
      });
      await loadSharedEvents();
      adminForm.reset();
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
  const publishButton = event.target.closest("[data-toggle-results-publication]");
  if (!publishButton) return;
  const shouldPublish = publishButton.textContent.includes("Publish");
  publishButton.disabled = true;
  try {
    await setResultsPublication(shouldPublish);
    await loadResultsPage();
  } catch (error) {
    alert(`Could not ${shouldPublish ? "publish" : "unpublish"} results: ${error.message}`);
  } finally {
    publishButton.disabled = false;
  }
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
    if (!response.ok) throw new Error("Cancellation notification failed");
    alert("Event cancelled and attendees have been notified.");
  } catch (error) {
    alert(`Could not cancel this event: ${error.message}`);
  } finally {
    cancelButton.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-member]");
  if (!editButton) return;
  const registration = adminRegistrations.find((item) => item.id === editButton.dataset.registrationId);
  if (!registration) return;
  const firstName = window.prompt("First name", registration.payload["club-first-name"] || "");
  if (firstName === null) return;
  const lastName = window.prompt("Last name", registration.payload["club-last-name"] || "");
  if (lastName === null) return;
  const payload = { ...registration.payload, "club-first-name": firstName.trim(), "club-last-name": lastName.trim() };
  await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registration.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ payload }) });
  await loadRegistrations();
});

document.addEventListener("click", async (event) => {
  const transferButton = event.target.closest("[data-transfer-attendee]");
  if (!transferButton) return;
  const destinations = getEvents().filter((item) => item.type === "club" && item.id !== transferButton.dataset.fromEvent);
  const choice = window.prompt(`Transfer to event ID:\n${destinations.map((item) => `${item.id} — ${item.title}`).join("\n")}`);
  const destination = destinations.find((item) => item.id === choice?.trim());
  const registration = adminRegistrations.find((item) => item.id === transferButton.dataset.registrationId);
  if (!destination || !registration) return;
  const payload = { ...registration.payload, "club-date": destination.id };
  await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registration.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ payload }) });
  await requestSupabase("/rest/v1/attendee_transfers", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ registration_id: registration.id, from_event_id: transferButton.dataset.fromEvent, to_event_id: destination.id }) });
  await loadRegistrations();
});

document.addEventListener("click", async (event) => {
  const processButton = event.target.closest("[data-process-results]");

  if (!processButton) return;

  processButton.disabled = true;
  processButton.textContent = "Processing...";

  try {
    await processResultsFromDom();
  } finally {
    processButton.disabled = false;
    processButton.textContent = "Process Results";
  }
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
  const ridingClassField = page?.querySelector("[data-add-result-riding-class]");
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
      riding_class: ridingClassField?.value.trim() || "",
      obstacle_scores: {},
      timing_seconds: null,
      scratched: false,
    });

    if (participantField) participantField.value = "";
    if (horseField) horseField.value = "";
    if (ridingClassField) ridingClassField.value = "";
    await loadResultsPage();
  } catch (error) {
    console.error("Manual result entry save failed:", error);
  }
});

document.addEventListener("submit", (event) => {
  const editForm = event.target.closest("[data-event-edit-form]");

  if (!editForm) return;

  event.preventDefault();

  const formData = new FormData(editForm);
  const eventId = editForm.dataset.eventId;
  const currentEvent = getEventDetails(eventId);
  const updatedEvent = {
    ...currentEvent,
    id: eventId,
    type: formData.get("type"),
    date: formData.get("date"),
    title: formData.get("title").trim(),
    location: formData.get("location").trim(),
    description: formData.get("description").trim(),
  };
  const status = editForm.querySelector("[data-event-edit-status]");

  writeEventOverride(updatedEvent);

  if (status) {
    status.hidden = false;
    status.textContent = "Event details saved in this browser.";
  }

  renderCalendarEvents();
  populateEventSelects();
  renderEventPage(adminRegistrations);
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

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-event]");

  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteEvent;
  writeAdminEvents(readAdminEvents().filter((item) => item.id !== id));
  renderAdminEventList();
});

const staticForms = document.querySelectorAll("form:not([data-admin-login]):not([data-event-admin-form])");

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
      Prefer: "return=representation",
    },
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    throw new Error(`Supabase submission failed with status ${response.status}`);
  }

  const registrations = await response.json();
  const registration = Array.isArray(registrations) ? registrations[0] : registrations;

  if (registration?.id && registration?.confirmation_token) {
    fetch(`${supabaseConfig.url}/functions/v1/registration-confirmation`, {
      method: "POST",
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registrationId: registration.id,
        confirmationToken: registration.confirmation_token,
      }),
    }).catch((error) => console.warn("Registration confirmation email was not sent:", error));
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
      status.textContent = "Registration could not be submitted. Please try again or contact the club.";
      console.error("Supabase registration submission failed:", error);
    } finally {
      setFormSubmitting(form, false);
    }
  });
});

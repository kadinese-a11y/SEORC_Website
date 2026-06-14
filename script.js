const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const eventStorageKey = "seorcEvents";
const adminSessionKey = "seorcAdminLoggedIn";
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

function getEvents() {
  return [...defaultEvents, ...readAdminEvents()].sort((a, b) => a.date.localeCompare(b.date));
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

  const events = getEvents().filter((event) => filter === "all" || event.type === filter);
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

function setAdminVisibility(isLoggedIn) {
  const login = document.querySelector("[data-admin-login]");
  const panel = document.querySelector("[data-admin-panel]");

  if (!login || !panel) return;

  login.hidden = isLoggedIn;
  panel.hidden = !isLoggedIn;
  renderAdminEventList();
}

const adminLogin = document.querySelector("[data-admin-login]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminForm = document.querySelector("[data-event-admin-form]");
const adminLogout = document.querySelector("[data-admin-logout]");

if (adminLogin && adminPanel) {
  setAdminVisibility(sessionStorage.getItem(adminSessionKey) === "true");

  adminLogin.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(adminLogin);
    const username = formData.get("username");
    const password = formData.get("password");

    if (username === "admin" && password === "seorc2026") {
      sessionStorage.setItem(adminSessionKey, "true");
      setAdminVisibility(true);
      adminLogin.reset();
      return;
    }

    let status = adminLogin.querySelector(".form-status");

    if (!status) {
      status = document.createElement("p");
      status.className = "form-status";
      status.setAttribute("role", "status");
      adminLogin.append(status);
    }

    status.textContent = "Login details did not match.";
  });
}

if (adminForm) {
  adminForm.addEventListener("submit", (event) => {
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

    writeAdminEvents([...readAdminEvents(), newEvent]);
    adminForm.reset();
    renderAdminEventList();
  });
}

if (adminLogout) {
  adminLogout.addEventListener("click", () => {
    sessionStorage.removeItem(adminSessionKey);
    setAdminVisibility(false);
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
  return [...form.elements].reduce((payload, field) => {
    if (!field.name || field.disabled || ["submit", "button", "fieldset"].includes(field.type)) {
      return payload;
    }

    if (field.type === "checkbox") {
      payload[field.name] = field.checked;
      return payload;
    }

    payload[field.name] = field.value;
    return payload;
  }, {});
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
  const supabaseConfig = window.SEORC_SUPABASE;

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
    throw new Error(`Supabase submission failed with status ${response.status}`);
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

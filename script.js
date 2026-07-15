const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const eventStorageKey = "seorcEvents";
const adminSessionStorageKey = "seorcAdminSession";
const judgeSessionStorageKey = "seorcJudgeSession";
const eventOverrideStorageKey = "seorcEventOverrides";
const showOrderStorageKey = "seorcShowClassOrder";
const membershipConfirmationStorageKey = "seorcMembershipConfirmation";
const adminPanelOpenStateStorageKey = "seorcAdminPanelOpenState";
const defaultClubDayFee = 40;
const defaultJuniorClubDayFee = 35;
const defaultDayMembershipFee = 15;
const defaultYoungRiderDayMembershipFee = 15;
const defaultClinicFee = 170;
const ridingLevelOptions = ["Professional", "Amateur", "Rookie", "Encouragement"];
let annualMembershipFee = 20;
let juniorMembershipFee = 15;
let clubDayFee = defaultClubDayFee;
let juniorClubDayFee = defaultJuniorClubDayFee;
let dayMembershipFee = defaultDayMembershipFee;
let youngRiderDayMembershipFee = defaultYoungRiderDayMembershipFee;
const showObstacleCount = 14;
let adminRegistrations = [];
let showResults = [];
let eventExpenses = [];
let remoteEvents = [];
let draggedShowEntry = null;
let editingMemberId = null;
let editingShowEntryId = null;
const resultSaveTimers = new WeakMap();
const typeLabels = {
  club: "Club Day",
  show: "Show",
  clinic: "Clinic",
  "external-show": "External Show",
  "external-clinic": "External Clinic",
};
const defaultEvents = [];

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
function renderRidingLevelOptions(selectedValue = "", placeholder = "Select riding level") {
  return `<option value="">${escapeHTML(placeholder)}</option>${ridingLevelOptions
    .map((level) => `<option value="${escapeHTML(level)}"${selectedValue === level ? " selected" : ""}>${escapeHTML(level)}</option>`)
    .join("")}`;
}
function populateRidingLevelSelects(root = document) {
  root.querySelectorAll("[data-riding-level-select]").forEach((select) => {
    const currentValue = select.value || select.dataset.selected || "";
    const placeholder = select.dataset.placeholder || "Select riding level";
    select.innerHTML = renderRidingLevelOptions(currentValue, placeholder);
  });
}

function ensureModalRoot() {
  let modal = document.querySelector("[data-modal-root]");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "modal-root";
  modal.dataset.modalRoot = "";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-backdrop" data-close-modal></div>
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-close-modal aria-label="Close popup">×</button>
      <div class="modal-content" data-modal-content></div>
    </section>
  `;
  document.body.append(modal);
  return modal;
}

function openModal(contentHtml) {
  const modal = ensureModalRoot();
  const content = modal.querySelector("[data-modal-content]");
  if (content) content.innerHTML = contentHtml;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  const modal = document.querySelector("[data-modal-root]");
  if (!modal) return;
  modal.hidden = true;
  const content = modal.querySelector("[data-modal-content]");
  if (content) content.innerHTML = "";
  document.body.classList.remove("modal-open");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector("[data-modal-root]:not([hidden])")) {
    closeModal();
  }
});

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
    return [...remoteEvents].filter((event) => !isPastExternalEvent(event)).sort((a, b) => a.date.localeCompare(b.date));
  }
  const overrides = readEventOverrides();
  return [...defaultEvents, ...readAdminEvents()]
    .map((event) => ({ ...event, ...(overrides[event.id] || {}) }))
    .filter((event) => !isPastExternalEvent(event))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function isPastExternalEvent(event, today = new Date().toISOString().slice(0, 10)) {
  return event?.type?.startsWith("external-") && event.date && event.date < today;
}

async function loadSharedEvents() {
  try {
    remoteEvents = await requestSupabase("/rest/v1/events?cancelled_at=is.null&select=*&order=date.asc");
    cleanupPastExternalEvents();
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
    if (type === "club" && info) {
      form.dataset.eventFee = String(getClubDayStandardFee(event));
      form.dataset.juniorClubDayFee = String(getClubDayJuniorFee(event));
      form.dataset.dayMembershipFee = String(getClubDayMembershipFee(event));
      form.dataset.youngRiderDayMembershipFee = String(getYoungRiderDayMembershipFee());
      info.textContent = event ? `Adult club day: ${formatCurrency(getClubDayStandardFee(event))}. Junior club day: ${formatCurrency(getClubDayJuniorFee(event))}. Adult AEORA day membership: ${formatCurrency(getClubDayMembershipFee(event))}. Junior AEORA day membership: ${formatCurrency(getYoungRiderDayMembershipFee())}` : "";
      updateClubDayTotal(form);
    }
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

function getClubDayStandardFee(event) {
  return Number(event?.event_settings?.club_day_fee ?? clubDayFee);
}

function getClubDayJuniorFee(event) {
  return Number(event?.event_settings?.club_day_junior_fee ?? event?.event_settings?.club_day_young_rider_fee ?? juniorClubDayFee);
}

function getClubDayMembershipFee(event) {
  return dayMembershipFee;
}

function getYoungRiderDayMembershipFee() {
  return youngRiderDayMembershipFee;
}

function getDayMembershipFeeForPayload(payload = {}) {
  return isJuniorDayMembershipPayload(payload) ? getYoungRiderDayMembershipFee() : dayMembershipFee;
}

function getClubDayBaseFeeForPayload(payload = {}, event) {
  return isJuniorDayMembershipPayload(payload) ? getClubDayJuniorFee(event) : getClubDayStandardFee(event);
}

function isJuniorDayMembershipPayload(payload = {}) {
  if (payload?.["club-day-rider-type"] === "junior") return true;
  if (payload?.["club-day-young-rider"] === true) return true;
  if (String(payload["riding-level"] || "").toLowerCase().includes("young rider")) return true;
  return Object.entries(payload).some(([key, value]) => {
    return value === true && /^horse-\d+-class-young-rider$/.test(key);
  });
}

function updateClubDayTotal(form) {
  if (!form?.matches(".registration-form") || !form.querySelector("[name='club-date']")) return;
  const isJunior = form.querySelector("[name='club-day-rider-type']")?.value === "junior";
  const selectedClubDayFee = isJunior
    ? Number(form.dataset.juniorClubDayFee || juniorClubDayFee)
    : Number(form.dataset.eventFee || clubDayFee);
  const dayMembershipAdded = form.querySelector("[name='club-day-day-membership']")?.checked;
  const selectedDayMembershipFee = dayMembershipAdded
    ? isJunior
      ? Number(form.dataset.youngRiderDayMembershipFee || youngRiderDayMembershipFee)
      : Number(form.dataset.dayMembershipFee || dayMembershipFee)
    : 0;
  const total = selectedClubDayFee + selectedDayMembershipFee;
  const totalElement = form.querySelector("[data-club-day-total]");
  if (totalElement) totalElement.textContent = formatCurrency(total);
  const baseElement = form.querySelector("[data-club-day-base-fee]");
  if (baseElement) baseElement.textContent = formatCurrency(selectedClubDayFee);
  const membershipElement = form.querySelector("[data-club-day-membership-fee]");
  if (membershipElement) membershipElement.textContent = formatCurrency(selectedDayMembershipFee);
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
  if (event.target.matches("[name='club-day-day-membership'], [name='club-day-rider-type']")) updateClubDayTotal(event.target.closest("form"));
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

function renderAdminTable({ columns, rows, className = "", ariaLabel = "", emptyMessage = "No records to show." }) {
  if (!rows.length) return `<p class="empty-state">${escapeHTML(emptyMessage)}</p>`;

  const classes = ["admin-data-table", className].filter(Boolean).join(" ");

  return `
    <div class="${escapeHTML(classes)}" role="table"${ariaLabel ? ` aria-label="${escapeHTML(ariaLabel)}"` : ""}>
      <div role="row" class="admin-table-header">
        ${columns.map((column) => `<span role="columnheader">${escapeHTML(column)}</span>`).join("")}
      </div>
      ${rows.map((row) => `
        <div role="row" class="admin-table-row">
          ${row.map((cell) => `<span role="cell">${cell}</span>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function getShopImageUrl(item) {
  return item.image_url || "assets/seorc-club-logo.png";
}

function getShopStockLabel(status) {
  if (status === "sold_out") return "Sold out";
  if (status === "preorder") return "Pre-order";
  return "Available";
}

function renderShopOrderModal(item) {
  const itemPrice = Number(item.price || 0);
  return `
    <form class="form-panel modal-edit-panel" data-shop-order-modal data-item-id="${escapeHTML(item.id)}">
      <div class="form-heading modal-heading">
        <p class="eyebrow">Shop order</p>
        <h2 id="modal-title">${escapeHTML(item.name)}</h2>
        <p>${escapeHTML(item.description || "")}</p>
      </div>
      <div class="shop-order-summary">
        <img src="${escapeHTML(getShopImageUrl(item))}" alt="">
        <dl class="payment-list compact-payment-list">
          <div><dt>Item price</dt><dd>${formatCurrency(itemPrice)}</dd></div>
          <div><dt>Quantity</dt><dd><input name="quantity" type="number" min="1" step="1" value="1" data-shop-order-quantity></dd></div>
          <div><dt>Total</dt><dd data-shop-order-total>${formatCurrency(itemPrice)}</dd></div>
        </dl>
      </div>
      <div class="form-grid">
        <label>Purchaser name<input name="customer_name" autocomplete="name" required></label>
        <label>Email<input name="customer_email" type="email" autocomplete="email" required></label>
        <label>Total order amount<input name="total_amount" value="${formatCurrency(itemPrice)}" readonly data-shop-order-total-input></label>
      </div>
      <label>Address<textarea name="address" rows="3" autocomplete="street-address" required></textarea></label>
      <label>Comments for purchase<textarea name="comments" rows="3" placeholder="Size, colour, pickup notes, or other details."></textarea></label>
      <section class="shop-bank-panel">
        <p class="eyebrow">Bank transfer</p>
        <dl class="payment-list compact-payment-list">
          <div><dt>Account name</dt><dd>Shoalhaven Extreme Obstacle Racing Club</dd></div>
          <div><dt>BSB</dt><dd>062 - 585</dd></div>
          <div><dt>Account number</dt><dd>11072610</dd></div>
          <div><dt>Reference</dt><dd data-shop-order-reference>Created when order is sent</dd></div>
        </dl>
      </section>
      <p class="field-note">Submit this order first. Your order reference will appear here and should be used as the bank transfer reference.</p>
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit">Send order</button>
        <button class="button secondary form-submit" type="button" data-close-modal>Close</button>
      </div>
      <p class="form-status" data-shop-order-status></p>
    </form>
  `;
}

async function fetchShopItems() {
  return requestSupabase("/rest/v1/shop_items?select=*&order=sort_order.asc,name.asc");
}

async function fetchShopOrders(filter = "waiting") {
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  if (!config || !token) throw new Error("Admin sign-in is required.");
  const response = await fetch(`${config.url}/functions/v1/shop-orders-admin?status=${encodeURIComponent(filter)}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not load shop orders.");
  return result.orders || [];
}

function renderShopItemCard(item) {
  const soldOut = item.stock_status === "sold_out";
  return `
    <article class="shop-item-card">
      <div class="shop-item-media">
        <img src="${escapeHTML(getShopImageUrl(item))}" alt="${escapeHTML(item.name)}">
        <span class="status-pill ${soldOut ? "status-expired" : "status-active"}">${escapeHTML(getShopStockLabel(item.stock_status))}</span>
      </div>
      <div class="shop-item-body">
        <div>
          <h3>${escapeHTML(item.name)}</h3>
          <p>${escapeHTML(item.description || "")}</p>
        </div>
        <div class="shop-item-footer">
          <strong>${formatCurrency(Number(item.price || 0))}</strong>
          ${soldOut ? '<span class="button secondary form-submit disabled-link">Sold out</span>' : `<button class="button primary form-submit" type="button" data-order-shop-item="${escapeHTML(item.id)}">Order</button>`}
        </div>
      </div>
    </article>
  `;
}

async function loadShopFront() {
  const container = document.querySelector("[data-shop-front]");
  if (!container) return;

  try {
    const items = await fetchShopItems();
    window.shopItems = items;
    container.innerHTML = items.length
      ? items.map(renderShopItemCard).join("")
      : '<p class="empty-state">No shop items are listed yet.</p>';
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Could not load shop items. Please try again soon.</p>';
    console.error("Shop items could not be loaded:", error);
  }
}

function resetShopItemForm() {
  closeModal();
}

function renderShopItemFormModal(item = {}) {
  const isEditing = Boolean(item.id);
  const imageUrl = item.image_url || "";
  return `
    <form class="form-panel modal-edit-panel" data-shop-item-form>
      <div class="form-heading modal-heading">
        <p class="eyebrow">Shop item</p>
        <h2 id="modal-title">${isEditing ? "Edit item" : "Add new item"}</h2>
      </div>
      <input name="id" type="hidden" value="${escapeHTML(item.id || "")}">
      <input name="image_url" type="hidden" value="${escapeHTML(imageUrl)}">
      <div class="form-grid">
        <label>Item name<input name="name" value="${escapeHTML(item.name || "")}" required></label>
        <label>Price (AUD)<input name="price" type="number" min="0" step="0.01" value="${escapeHTML(item.price ?? "")}" required></label>
        <label>Stock status<select name="stock_status"><option value="available"${item.stock_status === "available" || !item.stock_status ? " selected" : ""}>Available</option><option value="preorder"${item.stock_status === "preorder" ? " selected" : ""}>Pre-order</option><option value="sold_out"${item.stock_status === "sold_out" ? " selected" : ""}>Sold out</option></select></label>
        <label>Sort order<input name="sort_order" type="number" step="1" value="${escapeHTML(item.sort_order ?? "0")}"></label>
        <label>Product image<input name="image_file" type="file" accept="image/*"><span class="field-note">Upload a product photo or leave blank to keep the current image.</span></label>
      </div>
      <div class="shop-image-preview" data-shop-image-preview${imageUrl ? "" : " hidden"}>
        <img src="${escapeHTML(imageUrl || "assets/seorc-club-logo.png")}" alt="">
      </div>
      <label>Description<textarea name="description" rows="4" required>${escapeHTML(item.description || "")}</textarea></label>
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit">Save item</button>
        <button class="button secondary form-submit" type="button" data-close-modal>Cancel</button>
      </div>
      <p class="form-status" data-shop-item-status></p>
    </form>
  `;
}

function openShopItemModal(item = {}) {
  openModal(renderShopItemFormModal(item));
}

async function uploadAdminMediaFile(file, prefix = "media") {
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  if (!config || !token) throw new Error("Admin sign-in is required to upload media.");
  const cleanedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${prefix}-${Date.now()}-${cleanedName}`;
  const response = await fetch(`${config.url}/storage/v1/object/club-media/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: file,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Media upload failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return `${config.url}/storage/v1/object/public/club-media/${encodeURIComponent(path)}`;
}

async function uploadShopItemImage(file) {
  return uploadAdminMediaFile(file, "shop");
}

function renderShopAdminList(items) {
  const container = document.querySelector("[data-shop-admin-list]");
  if (!container) return;

  container.innerHTML = renderAdminTable({
    columns: ["Item", "Price", "Status", "Show in shop", "Sort", "Action"],
    className: "shop-admin-table",
    ariaLabel: "Shop items",
    emptyMessage: "No shop items yet.",
    rows: items.map((item) => [
      `<button class="admin-table-title-link table-button-link" type="button" data-edit-shop-item="${escapeHTML(item.id)}"><strong>${escapeHTML(item.name)}</strong></button><small>${escapeHTML(item.description || "No description")}</small>`,
      formatCurrency(Number(item.price || 0)),
      escapeHTML(getShopStockLabel(item.stock_status)),
      `<input type="checkbox" aria-label="Show ${escapeHTML(item.name)} in shop" data-toggle-shop-published="${escapeHTML(item.id)}"${item.published ? " checked" : ""}>`,
      String(item.sort_order ?? 0),
      `<button class="button secondary compact-button" type="button" data-delete-shop-item="${escapeHTML(item.id)}">Delete</button>`,
    ]),
  });
}

async function loadShopAdmin() {
  const container = document.querySelector("[data-shop-admin-list]");
  if (!container) return;

  try {
    const items = await fetchShopItems();
    window.shopItems = items;
    renderShopAdminList(items);
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Could not load shop items. Please check admin access.</p>';
    console.error("Shop admin items could not be loaded:", error);
  }
}

function renderShopOrderList(orders) {
  const container = document.querySelector("[data-shop-order-list]");
  if (!container) return;

  container.innerHTML = renderAdminTable({
    columns: ["Reference", "Order", "Customer", "Total", "Sent out"],
    className: "shop-orders-table",
    ariaLabel: "Shop orders",
    emptyMessage: "No shop orders yet.",
    rows: orders.map((order) => [
      `<strong>${escapeHTML(order.order_reference)}</strong><small>${escapeHTML(formatDateTime(order.created_at))}</small>`,
      `${escapeHTML(order.item_name)}<small>Qty ${escapeHTML(order.quantity)}${order.comments ? ` · ${escapeHTML(order.comments)}` : ""}</small>`,
      `${escapeHTML(order.customer_name)}<small>${escapeHTML(order.customer_email)} · ${escapeHTML(order.customer_address)}</small>`,
      formatCurrency(Number(order.total_amount || 0)),
      `<label class="compact-check"><input type="checkbox" data-toggle-shop-order-sent="${escapeHTML(order.id)}"${order.sent_out ? " checked" : ""}><span>${order.sent_out ? "Sent" : "Waiting"}</span></label>`,
    ]),
  });
}

async function loadShopOrders(filterOverride = "") {
  const container = document.querySelector("[data-shop-order-list]");
  if (!container) return;
  if (!await getFreshAdminAccessToken()) return;
  const select = document.querySelector("[data-shop-order-filter]");
  const filter = filterOverride || select?.value || container.dataset.shopOrderList || "waiting";

  try {
    const orders = await fetchShopOrders(filter);
    window.shopOrders = orders;
    renderShopOrderList(orders);
  } catch (error) {
    container.innerHTML = `<p class="empty-state">Could not load shop orders: ${escapeHTML(error.message)}</p>`;
    console.error("Shop orders could not be loaded:", error);
  }
}

function readAdminPanelOpenState() {
  try {
    return JSON.parse(localStorage.getItem(adminPanelOpenStateStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writeAdminPanelOpenState(key, isOpen) {
  const state = readAdminPanelOpenState();
  state[key] = isOpen;
  localStorage.setItem(adminPanelOpenStateStorageKey, JSON.stringify(state));
}

function renderCollapsibleAdminPanel(summary, content, { open = false, key = "", meta = "" } = {}) {
  const state = key ? readAdminPanelOpenState() : {};
  const isOpen = key && Object.prototype.hasOwnProperty.call(state, key) ? state[key] === true : open;
  return `<details class="collapsible-admin-panel"${key ? ` data-panel-key="${escapeHTML(key)}"` : ""}${isOpen ? " open" : ""}><summary><span>${escapeHTML(summary)}</span>${meta ? `<span class="collapsible-summary-meta">${escapeHTML(meta)}</span>` : ""}</summary>${content}</details>`;
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

function registrationsAreClosed(event) {
  return event?.event_settings?.registrations_closed === true;
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
      ${event.type.startsWith("external-")
        ? (event.event_settings?.provider_url ? `<a class="text-link" href="${escapeHTML(event.event_settings.provider_url)}" target="_blank" rel="noopener">Register</a>` : '<span class="field-note">Provider details coming soon.</span>')
        : registrationsAreClosed(event)
          ? '<span class="registration-closed-pill">Full</span>'
          : `<a class="text-link" href="${registrationPageForType(event.type)}">Register</a>`}
    `;
    eventList.append(item);
  });
}

function populateEventSelects() {
  document.querySelectorAll("[data-event-select]").forEach((select) => {
    const type = select.dataset.eventSelect;
    const placeholder = select.querySelector("option[value='']")?.textContent || "Select event";
    const options = getEvents().filter((event) => event.type === type && !registrationsAreClosed(event));

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
populateRidingLevelSelects();
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
    set("riding-level", member.riding_level);
    if (member.membership_type) set(`${prefix}-rider-type`, member.membership_type === "junior" ? "junior" : "adult");
    updateClubDayTotal(form); alert("Member details filled in.");
  } catch (error) { alert(`Could not look up membership: ${error.message}`); }
});

async function loadClubSettings() {
  try {
    const settings = await requestSupabase("/rest/v1/club_settings?select=setting_key,membership_fee");
    const adultFee = Number(settings.find((setting) => setting.setting_key === "annual_membership_fee")?.membership_fee);
    const juniorFee = Number(settings.find((setting) => setting.setting_key === "junior_membership_fee")?.membership_fee);
    const clubFee = Number(settings.find((setting) => setting.setting_key === "club_day_fee")?.membership_fee);
    const juniorClubFee = Number(settings.find((setting) => setting.setting_key === "club_day_junior_fee")?.membership_fee);
    const legacyYoungRiderClubFee = Number(settings.find((setting) => setting.setting_key === "club_day_young_rider_fee")?.membership_fee);
    const legacyAeoraDayFee = Number(settings.find((setting) => setting.setting_key === "aeora_day_membership_fee")?.membership_fee);
    const aeoraDayFee = Number(settings.find((setting) => setting.setting_key === "aeora_day_membership_adult_fee")?.membership_fee);
    const youngRiderAeoraDayFee = Number(settings.find((setting) => setting.setting_key === "aeora_day_membership_young_rider_fee")?.membership_fee);
    if (Number.isFinite(adultFee)) annualMembershipFee = adultFee;
    if (Number.isFinite(juniorFee)) juniorMembershipFee = juniorFee;
    if (Number.isFinite(clubFee)) clubDayFee = clubFee;
    if (Number.isFinite(juniorClubFee)) juniorClubDayFee = juniorClubFee;
    else if (Number.isFinite(legacyYoungRiderClubFee)) juniorClubDayFee = legacyYoungRiderClubFee;
    if (Number.isFinite(aeoraDayFee)) dayMembershipFee = aeoraDayFee;
    else if (Number.isFinite(legacyAeoraDayFee)) dayMembershipFee = legacyAeoraDayFee;
    if (Number.isFinite(youngRiderAeoraDayFee)) youngRiderDayMembershipFee = youngRiderAeoraDayFee;
    else if (Number.isFinite(legacyAeoraDayFee)) youngRiderDayMembershipFee = legacyAeoraDayFee;
  } catch (error) {
    console.warn("Membership pricing could not be loaded; using the standard fee.", error);
  }
  document.querySelectorAll("[data-annual-membership-form]").forEach(updateAnnualMembershipCost);
  applySelectedEventSettings();
  document.querySelectorAll(".registration-form").forEach(updateClubDayTotal);
  document.querySelectorAll("[data-club-settings-form] [name='membership_fee']").forEach((input) => { input.value = annualMembershipFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='junior_membership_fee']").forEach((input) => { input.value = juniorMembershipFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='club_day_fee']").forEach((input) => { input.value = clubDayFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='club_day_junior_fee']").forEach((input) => { input.value = juniorClubDayFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='aeora_day_membership_adult_fee']").forEach((input) => { input.value = dayMembershipFee.toFixed(2); });
  document.querySelectorAll("[data-club-settings-form] [name='aeora_day_membership_young_rider_fee']").forEach((input) => { input.value = youngRiderDayMembershipFee.toFixed(2); });
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
  const juniorClubFee = form.querySelector("[name='club_day_junior_fee']") ? Number(formData.get("club_day_junior_fee")) : juniorClubDayFee;
  const aeoraDayFee = form.querySelector("[name='aeora_day_membership_adult_fee']") ? Number(formData.get("aeora_day_membership_adult_fee")) : dayMembershipFee;
  const youngRiderAeoraDayFee = form.querySelector("[name='aeora_day_membership_young_rider_fee']") ? Number(formData.get("aeora_day_membership_young_rider_fee")) : youngRiderDayMembershipFee;
  try {
    await Promise.all([
      requestSupabase("/rest/v1/club_settings?setting_key=eq.annual_membership_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: membershipFee, updated_at: new Date().toISOString() }) }),
      requestSupabase("/rest/v1/club_settings?setting_key=eq.junior_membership_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: juniorFee, updated_at: new Date().toISOString() }) }),
      requestSupabase("/rest/v1/club_settings?setting_key=eq.club_day_junior_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: juniorClubFee, updated_at: new Date().toISOString() }) }),
      requestSupabase("/rest/v1/club_settings?setting_key=eq.aeora_day_membership_adult_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: aeoraDayFee, updated_at: new Date().toISOString() }) }),
      requestSupabase("/rest/v1/club_settings?setting_key=eq.aeora_day_membership_young_rider_fee", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ membership_fee: youngRiderAeoraDayFee, updated_at: new Date().toISOString() }) }),
    ]);
    annualMembershipFee = membershipFee;
    juniorMembershipFee = juniorFee;
    juniorClubDayFee = juniorClubFee;
    dayMembershipFee = aeoraDayFee;
    youngRiderDayMembershipFee = youngRiderAeoraDayFee;
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
    container.innerHTML = renderAdminTable({
      columns: ["Event", "Date", "Participants", "Entries", "Revenue"],
      className: "archived-event-overview-table",
      emptyMessage: "No achieved events have been archived yet.",
      rows: archived.map((item) => {
        const event = item.event_data || {};
        const results = Array.isArray(item.results) ? item.results : [];
        const summary = event.archive_summary || {};
        const eventRegistrations = registrations.filter((registration) => getRegistrationEventId(registration) === item.event_id);
        const participants = summary.participants ?? (eventRegistrations.length || new Set(results.map((result) => result.participant_name).filter(Boolean)).size);
        const revenue = summary.revenue ?? getEventSummary({ registrations: eventRegistrations }).revenue;
        const dateLabel = formatDateParts(event.date || item.event_date).label;

        return [
          `<a class="admin-table-title-link" href="archived-event.html?event=${encodeURIComponent(item.event_id)}"><strong>${escapeHTML(event.title || "SEORC event")}</strong><small>${escapeHTML(typeLabels[event.type] || "Achieved event")} · ${escapeHTML(event.location || "Location not recorded")}</small></a>`,
          escapeHTML(dateLabel),
          String(participants),
          String(results.length),
          formatCurrency(revenue),
        ];
      }),
    });
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
    const archivedClassSections = classes.length
      ? classes.map((className) => {
        const classResults = results
          .filter((result) => result.class_name === className)
          .sort((a, b) => (a.result_place || 999) - (b.result_place || 999));
        const rankedClassResults = getRankedArchivedClassResults(classResults);

        return `
          <section class="show-class-panel">
            <div class="form-heading">
              <p class="eyebrow">Archived class</p>
              <h2>${escapeHTML(className)}</h2>
            </div>
            ${renderAdminTable({
              columns: ["Rank", "Participant", "Horse", "Total points", "Time"],
              className: "show-class-table",
              rows: rankedClassResults.map((result) => [
                escapeHTML(String(result.display_place || "—")),
                escapeHTML(result.participant_name),
                escapeHTML(result.horse_name),
                escapeHTML(formatPoints(getShowResultPoints(result))),
                result.scratched ? "Scratched" : escapeHTML(formatTiming(getShowResultTimingSeconds(result))),
              ]),
            })}
          </section>
        `;
      }).join("")
      : '<p class="empty-state">No published class results were stored with this event.</p>';
    content.innerHTML = cancellationNotice + archivedSummary + archivedClassSections;
  } catch (error) { content.innerHTML = '<p class="empty-state">Could not load this archived event.</p>'; }
}

loadArchivedEventPage();

function downloadArchivedPointsCsv(event, results) {
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const eventDate = event.date ? formatDateParts(event.date).label : "Not recorded";
  const rows = [["Event date", "Class", "Entries", "Place", "Rider", "Horse", "Total points", "Time"]];
  sortShowClassNames([...new Set(results.map((result) => result.class_name))]).forEach((className) => {
    const classResults = results.filter((result) => result.class_name === className);
    getRankedArchivedClassResults(classResults)
      .filter((result) => Number(result.display_place) >= 1 && Number(result.display_place) <= 4)
      .forEach((result) => rows.push([eventDate, className, classResults.length, result.display_place, result.participant_name, result.horse_name, getShowResultPoints(result), formatTiming(getShowResultTimingSeconds(result))]));
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

function getPayloadEventId(payload = {}) {
  return payload["show-date"] || payload["club-date"] || payload["clinic-date"] || payload["event-id"] || "";
}

function assertRegistrationEventIsOpen(payload) {
  const eventId = getPayloadEventId(payload);
  const event = getEvents().find((item) => item.id === eventId);

  if (event && registrationsAreClosed(event)) {
    throw new Error(`${event.title} is full and registrations are now closed.`);
  }
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

function getFormNumber(formData, key) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isShowRegistrationPaid(registration) {
  const payload = registration?.payload || {};
  return payload["show-paid"] === true || Boolean(payload["show-paid-at"]);
}

function getShowRegistrationTotal(registration, event = getEventDetails(getRegistrationEventId(registration))) {
  const payload = registration.payload || {};
  const calculatedTotal = Number(payload["calculated-total"]);
  return Number.isFinite(calculatedTotal) && calculatedTotal > 0 ? calculatedTotal : calculateShowRegistrationTotal(payload, event);
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

function getRegistrationEmail(registration) {
  const payload = registration?.payload || {};
  const email = payload["participant-email"] || payload["club-day-email"] || payload["clinic-email"];
  return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : "";
}

function getAttendeeEmailCount(eventId, registrations = adminRegistrations) {
  return new Set(registrations
    .filter((registration) => getRegistrationEventId(registration) === eventId)
    .map(getRegistrationEmail)
    .filter(Boolean)).size;
}

function getRegistrationRevenue(registration) {
  const payload = registration.payload || {};
  const calculatedTotal = Number(payload["calculated-total"]);
  const event = getEventDetails(getRegistrationEventId(registration));
  const dayMembershipTotal = needsDayMembershipForm(registration) ? getDayMembershipFeeForPayload(payload, event) : 0;

  if (registration.form_type === "show_registration") {
    if (!isShowRegistrationPaid(registration)) return 0;
    return Math.max(getShowRegistrationTotal(registration, event) - getShowPassThroughTotal(registration, event), 0);
  }

  if ((registration.form_type === "club_day_registration" || registration.form_type === "clinic_registration") && !isEventRegistrationPaid(registration)) {
    return 0;
  }

  if (Number.isFinite(calculatedTotal) && calculatedTotal > 0) {
    return calculatedTotal;
  }

  if (registration.form_type === "club_day_registration" && payload["club-day-paid"] === true) {
    return getClubDayBaseFeeForPayload(payload, event) + dayMembershipTotal;
  }

  return dayMembershipTotal;
}

function getShowPricing(event) {
  const settings = event?.event_settings || {};
  return {
    dayMembership: dayMembershipFee,
    youngRiderDayMembership: youngRiderDayMembershipFee,
    dinner: Number(settings.dinner_price ?? 30),
    poweredCamping: Number(settings.powered_camping_price ?? 30),
    unpoweredCamping: Number(settings.unpowered_camping_price ?? 20),
    yard: Number(settings.yard_price ?? 5),
  };
}

function calculateShowRegistrationTotal(payload, event) {
  const pricing = getShowPricing(event);
  const classPrices = event?.event_settings?.class_prices || {};
  const horseNumbers = new Set(Object.keys(payload)
    .map((key) => key.match(/^horse-(\d+)-/)?.[1])
    .filter(Boolean));
  const classTotal = [...horseNumbers].reduce((horseTotal, horseNumber) => {
    return horseTotal + showClassSlugs.reduce((classTotalForHorse, slug) => {
      return classTotalForHorse + (payload[`horse-${horseNumber}-class-${slug}`] === true ? Number(classPrices[slug] ?? getDefaultShowClassPrice(slug)) : 0);
    }, 0);
  }, 0);
  const dayMembership = (payload["aeora-day-membership"] === true || payload["aeora-membership"] === "day") ? getDayMembershipFeeForPayload(payload, event) : 0;
  const dinner = getPayloadNumber(payload, "dinner-count") * pricing.dinner;
  const nightCount = getPayloadNumber(payload, "camping-night-count");
  const camping = (
    (payload["camping-with-power"] === true ? pricing.poweredCamping : 0) +
    (payload["camping-without-power"] === true ? pricing.unpoweredCamping : 0)
  ) * nightCount;
  const yards = getPayloadNumber(payload, "yard-count") * pricing.yard;

  return classTotal + dayMembership + dinner + camping + yards;
}

function getShowPassThroughTotal(registration, event = getEventDetails(getRegistrationEventId(registration))) {
  const payload = registration.payload || {};
  const pricing = getShowPricing(event);
  const nightCount = getPayloadNumber(payload, "camping-night-count");
  const dayMembership = needsDayMembershipForm(registration) ? getDayMembershipFeeForPayload(payload, event) : 0;
  const dinner = getPayloadNumber(payload, "dinner-count") * pricing.dinner;
  const camping = (
    (payload["camping-with-power"] === true ? pricing.poweredCamping : 0) +
    (payload["camping-without-power"] === true ? pricing.unpoweredCamping : 0)
  ) * nightCount;
  const yards = getPayloadNumber(payload, "yard-count") * pricing.yard;

  return dayMembership + dinner + camping + yards;
}

function getShowFinancialSummary(event, registrations) {
  return registrations.reduce((summary, registration) => {
    const total = getShowRegistrationTotal(registration, event);
    const collected = isShowRegistrationPaid(registration) ? total : 0;
    const passThrough = getShowPassThroughTotal(registration, event);
    const pricing = getShowPricing(event);
    const payload = registration.payload || {};
    const nightCount = getPayloadNumber(payload, "camping-night-count");
    const dayMembership = isShowRegistrationPaid(registration) && needsDayMembershipForm(registration) ? getDayMembershipFeeForPayload(payload, event) : 0;
    const dinner = isShowRegistrationPaid(registration) ? getPayloadNumber(payload, "dinner-count") * pricing.dinner : 0;
    const campingAndYards = isShowRegistrationPaid(registration)
      ? (
        ((payload["camping-with-power"] === true ? pricing.poweredCamping : 0) +
        (payload["camping-without-power"] === true ? pricing.unpoweredCamping : 0)) * nightCount +
        getPayloadNumber(payload, "yard-count") * pricing.yard
      )
      : 0;

    return {
      totalCollected: summary.totalCollected + collected,
      dayMemberships: summary.dayMemberships + dayMembership,
      dinner: summary.dinner + dinner,
      campingAndYards: summary.campingAndYards + campingAndYards,
      clubRevenue: summary.clubRevenue + Math.max(collected - passThrough, 0),
    };
  }, { totalCollected: 0, dayMemberships: 0, dinner: 0, campingAndYards: 0, clubRevenue: 0 });
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

function getShowHorseNumbers(payload = {}) {
  const numbers = new Set();
  Object.entries(payload).forEach(([key, value]) => {
    const match = key.match(/^horse-(\d+)-/);
    if (match && value !== "" && value !== false && value !== null && value !== undefined) numbers.add(match[1]);
  });
  return [...numbers].sort((a, b) => Number(a) - Number(b));
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
    timingSeconds: getShowResultTimingSeconds(result),
    scratched: result.scratched === true,
    placing: result.result_place ?? null,
    processedAt: result.processed_at || null,
    publishedAt: result.published_at || null,
    resultId: result.id || null,
    isManual: entry.isManual === true,
  };
}

function getObstacleScoreTotal(entry) {
  return Object.values(entry.obstacleScores || {}).reduce((total, value) => {
    const score = Number(value);
    return total + (Number.isFinite(score) ? score : 0);
  }, 0);
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

function getShowResultTimingSeconds(result = {}) {
  return result.timing_seconds ?? result.time_seconds ?? result.time ?? result.seconds ?? "";
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
  if (result.points !== undefined && result.points !== null && result.points !== "") return Number(result.points) || 0;
  return getObstacleScoreTotal({ obstacleScores: result.obstacle_scores || {} });
}

function getArchivedResultTimingValue(result) {
  const timing = Number(getShowResultTimingSeconds(result));
  return Number.isFinite(timing) ? timing : Number.POSITIVE_INFINITY;
}

function getRankedArchivedClassResults(classResults) {
  const activeResults = classResults
    .filter((result) => !result.scratched)
    .sort((a, b) => {
      const pointDifference = getShowResultPoints(b) - getShowResultPoints(a);
      if (pointDifference !== 0) return pointDifference;

      const timingDifference = getArchivedResultTimingValue(a) - getArchivedResultTimingValue(b);
      if (timingDifference !== 0) return timingDifference;

      return String(a.participant_name || "").localeCompare(String(b.participant_name || ""))
        || String(a.horse_name || "").localeCompare(String(b.horse_name || ""))
        || String(a.id || "").localeCompare(String(b.id || ""));
    })
    .map((result, index) => ({ ...result, display_place: index + 1 }));

  const scratchedResults = classResults
    .filter((result) => result.scratched)
    .sort((a, b) => String(a.participant_name || "").localeCompare(String(b.participant_name || "")))
    .map((result) => ({ ...result, display_place: null }));

  return [...activeResults, ...scratchedResults];
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
    content.innerHTML = `<dl class="show-extra-summary show-overview-summary"><div><dt>Event income</dt><dd>${formatCurrency(income)}</dd></div><div><dt>Membership income</dt><dd>${formatCurrency(membershipIncome)}</dd></div><div><dt>Other income</dt><dd>${formatCurrency(otherIncomeTotal)}</dd></div><div><dt>Event expenses</dt><dd>${formatCurrency(eventExpenses)}</dd></div><div><dt>Club expenses</dt><dd>${formatCurrency(sharedExpenses)}</dd></div><div><dt>Net profit</dt><dd>${formatCurrency(totalIncome - eventExpenses - sharedExpenses)}</dd></div></dl><section class="show-class-panel"><div class="form-heading"><p class="eyebrow">Events</p><h2>Event Profit &amp; Loss</h2></div>${renderAdminTable({ columns: ["Event", "Income", "Expenses", "Profit"], emptyMessage: "No events in this financial year yet.", rows: events.map((event) => [`<strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(formatDateParts(event.event_date).label)}</small>`, formatCurrency(event.income), formatCurrency(event.expenses), formatCurrency(event.profit)]) })}</section>`;
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
    list.innerHTML = `${renderAdminTable({ columns: ["Description", "Date", "Amount", "Action"], emptyMessage: "No costs recorded for this event.", rows: expenses.map((expense) => [escapeHTML(expense.description), escapeHTML(formatDateParts(expense.date_incurred).label), formatCurrency(expense.amount), `<button class="button secondary compact-button" type="button" data-delete-pl-entry="event_expenses" data-entry-id="${escapeHTML(expense.id)}">Remove</button>`]) })}<p class="field-note"><strong>Total costs: ${formatCurrency(total)}</strong></p>`;
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
    list.innerHTML = `${renderAdminTable({ columns: ["Description", "Date", "Amount", "Action"], emptyMessage: "No shared club costs recorded for this financial year.", rows: costs.map((cost) => [escapeHTML(cost.description), escapeHTML(formatDateParts(cost.date_incurred).label), formatCurrency(cost.amount), `<button class="button secondary compact-button" type="button" data-delete-pl-entry="club_expenses" data-entry-id="${escapeHTML(cost.id)}">Remove</button>`]) })}<p class="field-note"><strong>Total club costs: ${formatCurrency(total)}</strong></p>`;
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
    list.innerHTML = renderAdminTable({
      columns: ["Financial year", "Net profit", "Download"],
      emptyMessage: "No completed financial-year P&L reports have been archived yet.",
      rows: archives.map((archive) => {
        const r = archive.report || {};
        const net = Number(r.event_income || 0) + Number(r.membership_income || 0) + Number(r.other_income || 0) - Number(r.event_expenses || 0) - Number(r.club_expenses || 0);
        return [
          `<strong>${escapeHTML(archive.financial_year)}</strong>`,
          formatCurrency(net),
          `<button class="button secondary form-submit" type="button" data-download-past-pl='${escapeHTML(JSON.stringify(archive).replace(/'/g, "&#39;"))}'>Download PDF</button>`,
        ];
      }),
    });
  } catch (error) { list.innerHTML = '<p class="empty-state">Could not load past P&amp;L reports.</p>'; }
}
loadPastProfitLossPage();

async function loadOtherIncomePage() {
  const form = document.querySelector("[data-other-income-form]"); const list = document.querySelector("[data-other-income-list]");
  if (!form || !list) return;
  const now = new Date(); const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; const fy = `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  form.querySelector("[name='date_received']").value = now.toISOString().slice(0, 10);
  const render = async () => { const rows = await requestSupabase(`/rest/v1/other_income?financial_year=eq.${fy}&select=*&order=date_received.desc`); const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0); list.innerHTML = `${renderAdminTable({ columns: ["Description", "Date", "Amount", "Action"], emptyMessage: "No other income recorded for this financial year.", rows: rows.map((row) => [escapeHTML(row.description), escapeHTML(formatDateParts(row.date_received).label), formatCurrency(row.amount), `<button class="button secondary compact-button" type="button" data-delete-pl-entry="other_income" data-entry-id="${escapeHTML(row.id)}">Remove</button>`]) })}<p class="field-note"><strong>Total other income: ${formatCurrency(total)}</strong></p>`; };
  form.addEventListener("submit", async (event) => { event.preventDefault(); const status = form.querySelector("[data-other-income-status]"); const data = Object.fromEntries(new FormData(form)); try { await requestSupabase("/rest/v1/other_income", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...data, amount: Number(data.amount), financial_year: fy }) }); form.querySelector("[name='description']").value = ""; form.querySelector("[name='amount']").value = ""; status.textContent = "Income saved."; await render(); } catch (error) { status.textContent = `Could not save income: ${error.message}`; } });
  await render();
}
loadOtherIncomePage();

let membershipDirectoryMembers = [];

function getCurrentAustralianFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function getMemberRenewalForYear(member, financialYear = getCurrentAustralianFinancialYear()) {
  return (member?.membership_renewals || []).find((renewal) => renewal.financial_year === financialYear) || null;
}

function getMembershipFeeForType(type) {
  return type === "junior" ? juniorMembershipFee : annualMembershipFee;
}

function getNextAustralianFinancialYear(date = new Date()) {
  const current = getCurrentAustralianFinancialYear(date);
  const startYear = Number(current.slice(0, 4)) + 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function getPayableMembershipFinancialYears() {
  return [getCurrentAustralianFinancialYear(), getNextAustralianFinancialYear()];
}

function getMembershipYearCount(member) {
  return new Set((member?.membership_renewals || []).filter((renewal) => renewal.paid_at).map((renewal) => renewal.financial_year).filter(Boolean)).size;
}

function getMembershipStatus(member) {
  const renewal = getMemberRenewalForYear(member);
  return renewal?.paid_at ? "Active" : "Expired";
}

function getMemberSearchText(member) {
  return [
    member.membership_number,
    member.first_name,
    member.last_name,
    member.riding_level,
    member.email,
    member.phone,
    member.membership_type,
    getMembershipStatus(member),
  ].filter(Boolean).join(" ").toLowerCase();
}

function renderMembershipPaidYearControl(member) {
  const currentFinancialYear = getCurrentAustralianFinancialYear();
  const currentRenewal = getMemberRenewalForYear(member, currentFinancialYear);
  const selectedFinancialYear = currentRenewal?.financial_year || currentFinancialYear;
  const options = getPayableMembershipFinancialYears().map((financialYear) => {
    const renewal = getMemberRenewalForYear(member, financialYear);
    const label = renewal ? `${financialYear} (${renewal.paid_at ? "paid" : "unpaid"})` : `${financialYear} (new)`;
    return `<option value="${escapeHTML(financialYear)}"${financialYear === selectedFinancialYear ? " selected" : ""}>${escapeHTML(label)}</option>`;
  }).join("");

  return `
    <form class="membership-fy-form" data-member-paid-fy-form data-member-id="${escapeHTML(member.id)}">
      <label><span class="sr-only">Paid financial year</span><select name="financial_year">${options}</select></label>
      <div class="membership-fy-actions">
        <button class="button primary compact-button" type="submit" name="paid_action" value="paid">Mark paid</button>
        <button class="button secondary compact-button" type="submit" name="paid_action" value="unpaid">Mark unpaid</button>
      </div>
      <p class="form-status" data-member-paid-fy-status hidden></p>
    </form>
  `;
}

function renderMembershipDirectory() {
  const container = document.querySelector("[data-membership-renewals]");
  if (!container) return;

  const searchTerm = document.querySelector("[data-membership-search]")?.value.trim().toLowerCase() || "";
  const members = membershipDirectoryMembers.filter((member) => !searchTerm || getMemberSearchText(member).includes(searchTerm));

  if (!membershipDirectoryMembers.length) {
    container.innerHTML = '<p class="empty-state">No members have registered yet.</p>';
    return;
  }

  if (!members.length) {
    container.innerHTML = '<p class="empty-state">No members match that search.</p>';
    return;
  }

  container.innerHTML = renderAdminTable({
    columns: ["Membership number", "Name", "Riding level", "Current FY", "Paid FY"],
    className: "memberships-table",
    rows: members.map((member) => {
      const status = getMembershipStatus(member);
      const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Name not supplied";
      const renewal = getMemberRenewalForYear(member);

      return [
        escapeHTML(member.membership_number || "Not supplied"),
        `<button class="admin-table-title-link table-button-link" type="button" data-open-member-modal="${escapeHTML(member.id)}"><strong>${escapeHTML(memberName)}</strong></button><small>${escapeHTML(member.email || "No email supplied")}</small>`,
        escapeHTML(member.riding_level || "Not supplied"),
        `<span class="status-pill ${status === "Active" ? "status-active" : "status-expired"}">${status}</span><small>${renewal ? `${escapeHTML(renewal.financial_year)} · ${renewal.paid_at ? "Paid" : "Unpaid"}` : `No ${escapeHTML(getCurrentAustralianFinancialYear())} renewal`}</small>`,
        renderMembershipPaidYearControl(member),
      ];
    }),
  });
}

async function loadMembershipRenewalsPage() {
  const container = document.querySelector("[data-membership-renewals]"); if (!container) return;
  try {
    const members = await requestSupabase("/rest/v1/members?select=*,membership_renewals(id,financial_year,amount,membership_type,paid_at,created_at)&order=last_name.asc,first_name.asc");
    membershipDirectoryMembers = members;
    renderMembershipDirectory();
  } catch (error) { container.innerHTML = '<p class="empty-state">Could not load memberships.</p>'; }
}
loadMembershipRenewalsPage();
document.addEventListener("input", (event) => { if (event.target.matches("[data-membership-search]")) renderMembershipDirectory(); });
document.addEventListener("click", async (event) => { const button = event.target.closest("[data-mark-membership-paid]"); if (!button) return; await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(button.dataset.markMembershipPaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: new Date().toISOString() }) }); await loadMembershipRenewalsPage(); });

document.addEventListener("click", async (event) => { const button = event.target.closest("[data-mark-membership-unpaid]"); if (!button || !window.confirm("Mark this membership renewal as unpaid?")) return; await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(button.dataset.markMembershipUnpaid)}`, { method: "PATCH", body: JSON.stringify({ paid_at: null }) }); await loadMembershipRenewalsPage(); });

async function updateMemberPaidFinancialYear(memberId, financialYear, paid) {
  const member = membershipDirectoryMembers.find((item) => item.id === memberId) || await getMemberDetails(memberId);
  const renewal = getMemberRenewalForYear(member, financialYear);
  const body = {
    membership_type: member.membership_type || "adult",
    amount: getMembershipFeeForType(member.membership_type),
    paid_at: paid ? new Date().toISOString() : null,
  };
  if (renewal) {
    await requestSupabase(`/rest/v1/membership_renewals?id=eq.${encodeURIComponent(renewal.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
    return;
  }
  if (!paid) return;
  await requestSupabase("/rest/v1/membership_renewals", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      member_id: memberId,
      financial_year: financialYear,
      ...body,
    }),
  });
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-member-paid-fy-form]");
  if (!form) return;
  event.preventDefault();
  const submitter = event.submitter;
  const paid = submitter?.value !== "unpaid";
  const status = form.querySelector("[data-member-paid-fy-status]");
  const financialYear = String(new FormData(form).get("financial_year") || getCurrentAustralianFinancialYear());
  if (!paid && !window.confirm(`Mark ${financialYear} as unpaid for this member?`)) return;
  if (status) {
    status.hidden = false;
    status.textContent = paid ? "Saving paid year..." : "Saving unpaid year...";
  }
  try {
    await updateMemberPaidFinancialYear(form.dataset.memberId, financialYear, paid);
    await loadMembershipRenewalsPage();
  } catch (error) {
    if (status) status.textContent = `Could not update FY: ${error.message}`;
  }
});

function hasGreenHorse(member) {
  const value = String(member?.horse_level || "").toLowerCase();
  return value === "green" || value === "true" || value === "yes";
}

function renderMembershipDetailContent(member) {
  return `
    <div class="admin-actions">
      <button class="button secondary form-submit" type="button" data-delete-member="${escapeHTML(member.id)}">Delete member</button>
    </div>
    <form class="form-panel" data-member-detail-form data-member-id="${escapeHTML(member.id)}">
      <div class="form-heading"><p class="eyebrow">Edit member</p><h2>Update membership details</h2></div>
      <div class="form-grid">
        <label>Membership type<select name="membership_type"><option value="adult"${member.membership_type === "adult" ? " selected" : ""}>Adult</option><option value="junior"${member.membership_type === "junior" ? " selected" : ""}>Junior</option></select></label>
        <label>First name<input name="first_name" value="${escapeHTML(member.first_name || "")}" required></label>
        <label>Last name<input name="last_name" value="${escapeHTML(member.last_name || "")}" required></label>
        <label>Email<input name="email" type="email" value="${escapeHTML(member.email || "")}" required></label>
        <label>Phone<input name="phone" type="tel" value="${escapeHTML(member.phone || "")}"></label>
        <label>Birthday<input name="birthday" type="date" value="${escapeHTML(member.birthday || "")}"></label>
        <label>Address<input name="address" value="${escapeHTML(member.address || "")}"></label>
        <label>Riding level<select name="riding_level">${renderRidingLevelOptions(member.riding_level || "", "Not supplied")}</select></label>
        <label>Emergency first name<input name="emergency_first_name" value="${escapeHTML(member.emergency_first_name || "")}"></label>
        <label>Emergency last name<input name="emergency_last_name" value="${escapeHTML(member.emergency_last_name || "")}"></label>
        <label>Emergency phone<input name="emergency_phone" type="tel" value="${escapeHTML(member.emergency_phone || "")}"></label>
      </div>
      <label class="check-row"><input name="horse_level" type="checkbox" value="Green"${hasGreenHorse(member) ? " checked" : ""}><span>Green horse</span></label>
      <label class="check-row"><input name="aeora_membership_acknowledged" type="checkbox"${member.aeora_membership_acknowledged ? " checked" : ""}><span>AEORA membership confirmed</span></label>
      <label class="check-row"><input name="email_notifications" type="checkbox"${member.email_notifications ? " checked" : ""}><span>Email notifications</span></label>
      <div class="admin-actions"><button class="button primary form-submit" type="submit">Save member details</button><button class="button secondary form-submit" type="button" data-close-modal>Close</button></div>
      <p class="form-status" data-member-detail-status></p>
    </form>
  `;
}

async function getMemberDetails(memberId) {
  const rows = await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(memberId)}&select=*,membership_renewals(id,financial_year,amount,membership_type,paid_at,created_at,registration_id)`);
  const member = rows[0];
  if (!member) throw new Error("Member not found");
  return member;
}

async function openMembershipModal(memberId) {
  const member = await getMemberDetails(memberId);
  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Member";
  const membershipYears = getMembershipYearCount(member);
  openModal(`
    <div class="form-heading modal-heading">
      <p class="eyebrow">Membership details</p>
      <h2 id="modal-title">${escapeHTML(memberName)}</h2>
      <p>${escapeHTML(member.membership_number || "No membership number recorded")} · ${escapeHTML(humanizeFieldName(member.membership_type || "adult"))} member · ${membershipYears ? `${membershipYears} financial year${membershipYears === 1 ? "" : "s"} on record` : "No paid years on record"}</p>
    </div>
    ${renderMembershipDetailContent(member)}
  `);
}

document.addEventListener("click", async (event) => {
  const memberModalButton = event.target.closest("[data-open-member-modal]");
  if (memberModalButton) {
    try {
      openModal('<p class="empty-state">Loading member details...</p>');
      await openMembershipModal(memberModalButton.dataset.openMemberModal);
    } catch (error) {
      openModal(`<p class="empty-state">Could not load member details: ${escapeHTML(error.message)}</p>`);
    }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-member]");
  if (deleteButton) {
    if (!window.confirm("Delete this member from the membership list? Historical form submissions will remain.")) return;
    await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(deleteButton.dataset.deleteMember)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (document.querySelector("[data-modal-root]:not([hidden])")) {
      closeModal();
      await loadMembershipRenewalsPage();
      return;
    }
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
    horse_level: formData.get("horse_level") === "Green" ? "Green" : null,
    emergency_first_name: String(formData.get("emergency_first_name") || "").trim() || null,
    emergency_last_name: String(formData.get("emergency_last_name") || "").trim() || null,
    emergency_phone: String(formData.get("emergency_phone") || "").trim() || null,
    aeora_membership_acknowledged: formData.get("aeora_membership_acknowledged") === "on",
    email_notifications: formData.get("email_notifications") === "on",
    updated_at: new Date().toISOString(),
  };
  try {
    await requestSupabase(`/rest/v1/members?id=eq.${encodeURIComponent(form.dataset.memberId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (status) status.textContent = "Member details saved.";
    if (form.closest("[data-modal-root]")) {
      await loadMembershipRenewalsPage();
      await openMembershipModal(form.dataset.memberId);
      return;
    }
    await loadMembershipRenewalsPage();
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

const annualPointCategoryOrder = ["Professional", "Amateur", "Rookie", "Encouragement", "Junior"];

function renderAnnualCategoryTable(rows, category) {
  return renderAdminTable({
    columns: ["Rank", "Rider", "Horse", "Points", "Entries", "Events"],
    className: "points-table points-category-table",
    ariaLabel: `${category} annual points`,
    emptyMessage: "No published Shoalhaven member results have been counted in this category yet.",
    rows: rows.map((row) => [
      `<strong>${row.rank}</strong>`,
      escapeHTML(row.participant_name || "Name not supplied"),
      escapeHTML(row.horse_name || "Horse not supplied"),
      `<strong>${formatPoints(row.points)}</strong>`,
      String(Number(row.entries || 0)),
      String(Number(row.events || 0)),
    ]),
  });
}

function renderAnnualCategoryLeaderboards(rows) {
  const categoryOrder = [...annualPointCategoryOrder, ...new Set(rows.map((row) => row.points_category).filter((category) => !annualPointCategoryOrder.includes(category)))];
  return categoryOrder
    .map((category) => {
      const categoryRows = rows
        .filter((row) => row.points_category === category)
        .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999) || Number(b.points || 0) - Number(a.points || 0) || String(a.participant_name || "").localeCompare(String(b.participant_name || "")));

      return `
        <section class="show-class-panel points-category-panel">
          <div class="form-heading">
            <p class="eyebrow">Top 5 horse and rider combinations</p>
            <h2>${escapeHTML(category)} points</h2>
          </div>
          ${renderAnnualCategoryTable(categoryRows, category)}
        </section>
      `;
    })
    .join("");
}

async function loadPointsPage() {
  const page = document.querySelector("[data-points-page]");
  const summary = document.querySelector("[data-points-summary]");
  const categoryPoints = document.querySelector("[data-category-points]");
  const year = getPointsPageYear();

  if (!page) return;

  document.querySelector("[data-points-year]").textContent = String(year);

  try {
    const annualPoints = await fetchAnnualPointsData(year);

    document.querySelector("[data-points-rider-count]").textContent = String(new Set(annualPoints.leaderboard.map((row) => row.participant_name)).size);
    document.querySelector("[data-points-combo-count]").textContent = String(annualPoints.combinations.length);
    document.querySelector("[data-points-result-count]").textContent = String(annualPoints.resultCount);

    if (summary) {
      summary.textContent = `${annualPoints.resultCount} published Shoalhaven member results counted for ${year}. Points are calculated by horse and rider combination.`;
    }

    if (categoryPoints) {
      categoryPoints.innerHTML = renderAnnualCategoryLeaderboards(annualPoints.leaderboard);
    }
  } catch (error) {
    if (summary) {
      summary.textContent = "Could not load points yet. Please check Supabase access.";
    }

    if (categoryPoints) {
      categoryPoints.innerHTML = '<p class="empty-state">Could not load annual category points.</p>';
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
  const attendeeEmailCount = getAttendeeEmailCount(event.id);

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
        ${!isExternal ? `<button class="button secondary form-submit" type="button" data-email-attendees data-event-id="${escapeHTML(event.id)}" data-event-title="${escapeHTML(event.title)}">Email attendees${attendeeEmailCount ? ` (${attendeeEmailCount})` : ""}</button>` : ""}
        ${!isExternal ? `<button class="button secondary form-submit" type="button" data-toggle-event-registrations data-event-id="${escapeHTML(event.id)}" data-registrations-closed="${registrationsAreClosed(event) ? "true" : "false"}">${registrationsAreClosed(event) ? "Re-open registrations" : "Close registrations"}</button>` : ""}
        ${isExternal ? `<button class="button secondary form-submit" type="button" data-delete-shared-event="${escapeHTML(event.id)}">Delete listing</button>` : `<button class="button secondary form-submit" type="button" data-cancel-event data-event-id="${escapeHTML(event.id)}" data-event-title="${escapeHTML(event.title)}">Cancel &amp; notify attendees</button>`}
        ${event.type === "show" ? `<button class="button primary form-submit" type="button" data-publish-event-results data-event-id="${escapeHTML(event.id)}"${judgingComplete ? "" : " disabled"}>${judgingComplete ? "Publish Scores" : "Scores to be completed"}</button>` : ""}
      </div>
      ${registrationsAreClosed(event) ? '<p class="registration-closed-notice">Registrations are currently closed for this event.</p>' : ""}
      <p class="form-status" data-event-edit-status hidden></p>
    </form>
  `;
}

function renderEventPricingForm(event) {
  if (!["club", "clinic", "show"].includes(event.type)) return "";
  const settings = event.event_settings || {};
  const fields = event.type === "club"
    ? `<label>Adult club day fee<input name="club_day_fee" type="number" min="0" step="0.01" value="${getClubDayStandardFee(event)}"></label><label>Junior club day fee<input name="club_day_junior_fee" type="number" min="0" step="0.01" value="${getClubDayJuniorFee(event)}"></label>`
    : event.type === "clinic"
      ? `<label>Clinic fee<input name="clinic_fee" type="number" min="0" step="0.01" value="${Number(settings.clinic_fee ?? defaultClinicFee)}"></label>`
    : `<fieldset class="pricing-section"><legend>Dinner</legend><div class="form-grid"><label>Dinner ticket price<input name="dinner_price" type="number" min="0" step="0.01" value="${Number(settings.dinner_price ?? 30)}"></label><label>Dinner vendor link<input name="dinner_vendor_url" type="url" value="${escapeHTML(settings.dinner_vendor_url || "")}" placeholder="https://..."></label><label>Custom dinner information<textarea name="custom_information" rows="4" placeholder="Information shown in the dinner section">${escapeHTML(settings.custom_information || "")}</textarea></label></div></fieldset><fieldset class="pricing-section"><legend>Camping and yards</legend><div class="form-grid"><label>Camping with power / night<input name="powered_camping_price" type="number" min="0" step="0.01" value="${Number(settings.powered_camping_price ?? 30)}"></label><label>Camping without power / night<input name="unpowered_camping_price" type="number" min="0" step="0.01" value="${Number(settings.unpowered_camping_price ?? 20)}"></label><label>Yard price<input name="yard_price" type="number" min="0" step="0.01" value="${Number(settings.yard_price ?? 5)}"></label></div></fieldset><fieldset class="pricing-section"><legend>Classes</legend><div class="form-grid">${showClassSlugs.map((slug) => `<label>${humanizeFieldName(slug)} class<input name="class_${slug}" type="number" min="0" step="0.01" value="${Number(settings.class_prices?.[slug] ?? getDefaultShowClassPrice(slug))}"></label>`).join("")}</div></fieldset>`;
  const pricingName = event.type === "show" ? "Show pricing" : event.type === "clinic" ? "Clinic pricing" : "Club day pricing";
  return renderCollapsibleAdminPanel(event.type === "show" ? "Show pricing and participant information" : pricingName, `<form class="form-panel" data-event-pricing-form data-event-id="${escapeHTML(event.id)}"><div class="form-heading"><p class="eyebrow">${pricingName}</p><h2>Participant options</h2></div>${event.type === "show" ? fields : `<div class="form-grid">${fields}</div>`}<button class="button primary form-submit" type="submit">Save prices and information</button><p class="form-status" data-event-pricing-status></p></form>`, { key: `${event.id}:pricing` });
}

function renderShowFinancePanel(eventId, event, registrations, expenses = []) {
  const summary = getShowFinancialSummary(event, registrations);
  const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const totalPaidOut = summary.dayMemberships + summary.campingAndYards + summary.dinner + expenseTotal;
  const showRevenue = summary.totalCollected - totalPaidOut;
  const payoutRows = [
    { label: "Entry revenue", date: "", amount: summary.clubRevenue, action: "<small>Auto calculated from paid entries</small>" },
    { label: "AEORA day memberships", date: "", amount: summary.dayMemberships, action: "" },
    { label: "Camping and yards", date: "", amount: summary.campingAndYards, action: "" },
    { label: "Dinner tickets", date: "", amount: summary.dinner, action: "" },
    ...expenses.map((expense) => ({
      label: expense.description,
      date: formatDateParts(expense.date_incurred).label,
      amount: Number(expense.amount || 0),
      action: `<button class="button secondary compact-button" type="button" data-delete-pl-entry="event_expenses" data-entry-id="${escapeHTML(expense.id)}">Remove</button>`,
    })),
  ];

  return `
    ${renderCollapsibleAdminPanel("Show finance", `
      <section class="show-class-panel">
        <div class="form-heading">
          <p class="eyebrow">Show finances</p>
          <h2>Club revenue and payouts</h2>
          <p>Show revenue is total collected minus AEORA day memberships, camping, yards, dinner tickets, and recorded show costs.</p>
        </div>
        <dl class="show-extra-summary show-overview-summary show-finance-summary">
          <div><dt>Total collected</dt><dd>${formatCurrency(summary.totalCollected)}</dd></div>
          <div><dt>Total paid out</dt><dd>${formatCurrency(totalPaidOut)}</dd></div>
          <div><dt>Show revenue</dt><dd>${formatCurrency(showRevenue)}</dd></div>
        </dl>
        ${renderAdminTable({
          columns: ["Line item", "Date", "Amount", "Action"],
          className: "show-finance-table",
          ariaLabel: "Show finance payouts and costs",
          rows: payoutRows.map((row) => [
            escapeHTML(row.label),
            escapeHTML(row.date || "Auto calculated"),
            formatCurrency(row.amount),
            row.action || "<small>Included in payout total</small>",
          ]),
        })}
        <form class="form-grid" data-show-cost-form data-event-id="${escapeHTML(eventId)}">
          <label>Cost type<input name="description" type="text" placeholder="e.g. Grounds hire, judging fee" required></label>
          <label>Amount (AUD)<input name="amount" type="number" min="0" step="0.01" required></label>
          <label>Date incurred<input name="date_incurred" type="date" value="${escapeHTML(new Date().toISOString().slice(0, 10))}" required></label>
          <button class="button primary form-submit" type="submit">Add show cost</button>
          <p class="form-status" data-show-cost-status></p>
        </form>
      </section>
    `, { key: `${eventId}:finance`, meta: `Revenue ${formatCurrency(showRevenue)}` })}
  `;
}

function renderClubMembersDetail(registrations) {
  const editingMember = registrations.find((registration) => registration.id === editingMemberId);
  const editPayload = editingMember?.payload || {};
  return `
    ${renderAdminTable({
      columns: ["Name", "Email", "Phone", "Riding level", "Emergency contact", "Emergency phone"],
      className: "member-table",
      ariaLabel: "Club members",
      rows: registrations.map((registration) => {
        const payload = registration.payload || {};
        return [
          `${escapeHTML(getParticipantName(registration))}<button class="text-link" type="button" data-edit-member data-registration-id="${escapeHTML(registration.id)}">Edit</button>`,
          escapeHTML(payload["club-email"] || "Not supplied"),
          escapeHTML(payload["club-phone"] || "Not supplied"),
          escapeHTML(payload["riding-level"] || "Not supplied"),
          escapeHTML([payload["emergency-first-name"], payload["emergency-last-name"]].filter(Boolean).join(" ") || "Not supplied"),
          escapeHTML(payload["emergency-phone"] || "Not supplied"),
        ];
      }),
    })}
    ${editingMember ? `
      <form class="form-panel" data-member-edit-form data-registration-id="${escapeHTML(editingMember.id)}">
        <div class="form-heading"><p class="eyebrow">Annual member</p><h2>Edit member details</h2></div>
        <div class="form-grid">
          <label>First name<input name="club-first-name" type="text" value="${escapeHTML(editPayload["club-first-name"] || "")}" required></label>
          <label>Last name<input name="club-last-name" type="text" value="${escapeHTML(editPayload["club-last-name"] || "")}" required></label>
          <label>Email<input name="club-email" type="email" value="${escapeHTML(editPayload["club-email"] || "")}"></label>
          <label>Phone<input name="club-phone" type="tel" value="${escapeHTML(editPayload["club-phone"] || "")}"></label>
          <label>Riding level<select name="riding-level">${renderRidingLevelOptions(editPayload["riding-level"] || "", "Not supplied")}</select></label>
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
  const standardFee = getClubDayStandardFee(group.event);
  const juniorFee = getClubDayJuniorFee(group.event);
  const selectedDayMembershipFee = getClubDayMembershipFee(group.event);
  return `
    <div class="admin-actions"><button class="button secondary form-submit" type="button" data-download-attendee-list data-event-id="${escapeHTML(group.event.id)}">Download attendee list</button></div>
    <p class="field-note">Adult club day: ${formatCurrency(standardFee)}. Junior club day: ${formatCurrency(juniorFee)}. Adult AEORA day membership: ${formatCurrency(selectedDayMembershipFee)}. Junior AEORA day membership: ${formatCurrency(getYoungRiderDayMembershipFee())}.</p>
    ${renderEventPaymentSection(group.event.id, group, { includeTransfer: true })}
  `;
}

function renderClinicDetail(group) {
  const clinicFee = Number(group.event.event_settings?.clinic_fee ?? defaultClinicFee);
  return `
    <div class="admin-actions"><button class="button secondary form-submit" type="button" data-download-attendee-list data-event-id="${escapeHTML(group.event.id)}">Download attendee list</button></div>
    <p class="field-note">Clinic fee: ${formatCurrency(clinicFee)}. Day-membership forms needed are clearly marked below.</p>
    ${renderEventPaymentSection(group.event.id, group)}
  `;
}

function renderEmailAttendeesModal(eventId, eventTitle) {
  const recipientCount = getAttendeeEmailCount(eventId);
  const defaultSubject = eventTitle ? `Update for ${eventTitle}` : "SEORC event update";

  return `
    <form class="form-panel modal-edit-panel" data-email-attendees-form data-event-id="${escapeHTML(eventId)}">
      <div class="form-heading modal-heading">
        <p class="eyebrow">Email attendees</p>
        <h2 id="modal-title">${escapeHTML(eventTitle || "Event update")}</h2>
        <p>${recipientCount} attendee email${recipientCount === 1 ? "" : "s"} will receive this update.</p>
      </div>
      <label>Subject<input name="subject" type="text" value="${escapeHTML(defaultSubject)}" required></label>
      <label>Message<textarea name="message" rows="8" placeholder="Write the update attendees need to receive." required></textarea></label>
      <label>Media upload<input name="media_file" type="file" accept="image/*,.pdf"><span class="field-note">Optional: upload an image or PDF to include with this email.</span></label>
      <div class="shop-image-preview email-media-preview" data-email-media-preview hidden>
        <img src="" alt="">
      </div>
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit"${recipientCount ? "" : " disabled"}>Send email</button>
        <button class="button secondary form-submit" type="button" data-close-modal>Cancel</button>
      </div>
      <p class="form-status" data-email-attendees-status></p>
    </form>
  `;
}

function renderEventRegistrationEditPanel(registration) {
  const payload = registration.payload || {};
  const isClinic = registration.form_type === "clinic_registration";
  const eventId = getRegistrationEventId(registration);
  const event = getEventDetails(eventId);
  const prefix = isClinic ? "clinic" : "club-day";
  const horseField = isClinic ? "clinic-horse-name" : "club-day-horse-name";
  const paidField = isClinic ? "clinic-paid" : "club-day-paid";
  const dayMembershipField = isClinic ? "clinic-day-membership" : "club-day-day-membership";
  const riderType = payload["club-day-rider-type"] || (payload["club-day-young-rider"] === true ? "junior" : "adult");

  return `
    <form class="form-panel modal-edit-panel" data-event-registration-edit-form data-registration-id="${escapeHTML(registration.id)}" data-event-id="${escapeHTML(eventId)}" data-form-type="${escapeHTML(registration.form_type)}">
      <div class="form-heading modal-heading">
        <p class="eyebrow">Edit registration</p>
        <h2 id="modal-title">${escapeHTML(getParticipantName(registration))}</h2>
        <p>${escapeHTML(event.title || "Event registration")}</p>
      </div>
      <div class="form-grid">
        <label>First name<input name="${prefix}-first-name" value="${escapeHTML(payload[`${prefix}-first-name`] || "")}" required></label>
        <label>Last name<input name="${prefix}-last-name" value="${escapeHTML(payload[`${prefix}-last-name`] || "")}" required></label>
        <label>Email<input name="${prefix}-email" type="email" value="${escapeHTML(payload[`${prefix}-email`] || "")}"></label>
        <label>Phone<input name="${prefix}-phone" type="tel" value="${escapeHTML(payload[`${prefix}-phone`] || "")}"></label>
        <label>Horse name<input name="${horseField}" value="${escapeHTML(payload[horseField] || "")}" required></label>
      </div>
      <label class="check-row"><input name="${paidField}" type="checkbox"${payload[paidField] === true ? " checked" : ""}><span>Paid</span></label>
      ${isClinic ? "" : `<label>Rider type<select name="club-day-rider-type"><option value="adult"${riderType === "adult" ? " selected" : ""}>Adult</option><option value="junior"${riderType === "junior" ? " selected" : ""}>Junior</option></select></label>`}
      <label class="check-row"><input name="${dayMembershipField}" type="checkbox"${payload[dayMembershipField] === true ? " checked" : ""}><span>Needs AEORA day membership form</span></label>
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit">Save registration</button>
        <button class="button secondary form-submit" type="button" data-close-modal>Cancel</button>
      </div>
      <p class="form-status" data-event-registration-edit-status></p>
    </form>
  `;
}

function isEventRegistrationPaid(registration) {
  if (registration.form_type === "show_registration") return isShowRegistrationPaid(registration);
  if (registration.form_type === "club_day_registration") return registration.payload?.["club-day-paid"] === true;
  if (registration.form_type === "clinic_registration") return registration.payload?.["clinic-paid"] === true;
  return false;
}

function getEventRegistrationPayableTotal(registration, event = getEventDetails(getRegistrationEventId(registration))) {
  if (registration.form_type === "show_registration") return getShowRegistrationTotal(registration, event);
  const calculatedTotal = Number(registration.payload?.["calculated-total"]);
  if (Number.isFinite(calculatedTotal) && calculatedTotal > 0) return calculatedTotal;
  if (registration.form_type === "club_day_registration") return getClubDayBaseFeeForPayload(registration.payload || {}, event) + (needsDayMembershipForm(registration) ? getDayMembershipFeeForPayload(registration.payload || {}, event) : 0);
  if (registration.form_type === "clinic_registration") return Number(event.event_settings?.clinic_fee ?? defaultClinicFee);
  return 0;
}

function renderPaymentParticipantCell(registration) {
  const participantName = getParticipantName(registration);
  const payload = registration.payload || {};
  const email = payload["participant-email"] || payload["club-day-email"] || payload["clinic-email"] || "No email supplied";

  if (registration.form_type === "show_registration") {
    return `<button class="text-link table-text-link" type="button" data-edit-show-entry data-entry-id="${escapeHTML(registration.id)}:all:payment">${escapeHTML(participantName)}</button><small>${escapeHTML(email)}</small>`;
  }

  return `<button class="text-link table-text-link" type="button" data-edit-event-registration="${escapeHTML(registration.id)}">${escapeHTML(participantName)}</button><small>${escapeHTML(email)}</small>`;
}

function renderEventPaymentSection(eventId, group, { includeTransfer = false } = {}) {
  const paidCount = group.registrations.filter(isEventRegistrationPaid).length;
  const totalPayable = group.registrations.reduce((total, registration) => total + getEventRegistrationPayableTotal(registration, group.event), 0);
  const totalPaid = group.registrations.reduce((total, registration) => total + (isEventRegistrationPaid(registration) ? getEventRegistrationPayableTotal(registration, group.event) : 0), 0);
  const columns = ["Paid", "Participant", "Horse/s", "Total", "Status", ...(includeTransfer ? ["Transfer"] : []), "Action"];

  return `
    <div class="form-heading compact-section-heading">
      <p class="eyebrow">Payments</p>
      <h2>Payment list</h2>
      <p>${paidCount} of ${group.registrations.length} registration${group.registrations.length === 1 ? "" : "s"} marked paid. ${formatCurrency(totalPaid)} collected from ${formatCurrency(totalPayable)} payable.</p>
    </div>
    ${renderAdminTable({
      columns,
      className: includeTransfer ? "event-payment-table event-payment-transfer-table" : "event-payment-table",
      ariaLabel: `${group.event.title} payment list`,
      emptyMessage: "No registrations yet.",
      rows: group.registrations.map((registration) => {
        const payload = registration.payload || {};
        const paid = isEventRegistrationPaid(registration);
        const participant = getParticipantName(registration);
        const deleteButton = registration.form_type === "show_registration"
          ? `<button class="button secondary compact-button" type="button" data-delete-show-registration="${escapeHTML(registration.id)}" data-event-id="${escapeHTML(eventId)}" data-participant-name="${escapeHTML(participant)}">Delete</button>`
          : `<button class="button secondary compact-button" type="button" data-delete-event-registration="${escapeHTML(registration.id)}" data-participant-name="${escapeHTML(participant)}">Delete</button>`;
        const row = [
          `<input type="checkbox" aria-label="Mark ${escapeHTML(participant)} as paid" data-payment-registration="${escapeHTML(registration.id)}"${paid ? " checked" : ""}>`,
          renderPaymentParticipantCell(registration),
          escapeHTML(getRegistrationHorseNames(registration)),
          formatCurrency(getEventRegistrationPayableTotal(registration, group.event)),
          `<span class="status-pill ${paid ? "status-active" : "status-expired"}">${paid ? "Paid" : "Unpaid"}</span>${payload["show-paid-at"] ? `<small>${escapeHTML(formatDateParts(String(payload["show-paid-at"]).slice(0, 10)).label)}</small>` : ""}`,
        ];

        if (includeTransfer) row.push(`<button class="button secondary compact-button" type="button" data-open-transfer-modal="${escapeHTML(registration.id)}" data-from-event="${escapeHTML(eventId)}">Transfer</button>`);
        row.push(deleteButton);
        return row;
      }),
    })}
  `;
}

function renderTransferAttendeeModal(registration, fromEventId) {
  const participantName = getParticipantName(registration);
  const destinations = getEvents()
    .filter((event) => event.type === "club" && event.id !== fromEventId)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  return `
    <form class="form-panel modal-edit-panel" data-transfer-attendee-form data-registration-id="${escapeHTML(registration.id)}" data-from-event="${escapeHTML(fromEventId)}">
      <div class="form-heading modal-heading">
        <p class="eyebrow">Transfer attendee</p>
        <h2 id="modal-title">${escapeHTML(participantName)}</h2>
        <p>Move this registration to another club day.</p>
      </div>
      <label>Transfer to
        <select name="destination_event_id" required>
          <option value="">Choose club day</option>
          ${destinations.map((event) => `<option value="${escapeHTML(event.id)}">${escapeHTML(`${formatDateParts(event.date).label} · ${event.title}`)}</option>`).join("")}
        </select>
      </label>
      ${destinations.length ? "" : '<p class="empty-state">No other club days are available yet.</p>'}
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit"${destinations.length ? "" : " disabled"}>Transfer attendee</button>
        <button class="button secondary form-submit" type="button" data-close-modal>Cancel</button>
      </div>
      <p class="form-status" data-transfer-attendee-status></p>
    </form>
  `;
}

function getShowEntryEditTarget(entryId, registrations) {
  const [registrationId, horseNumber] = String(entryId || "").split(":");
  const registration = registrations.find((item) => item.id === registrationId);

  if (!registration || !horseNumber) return null;

  return { registration, horseNumber };
}

function renderShowEntryEditPanel(eventId, group) {
  const target = getShowEntryEditTarget(editingShowEntryId, group.registrations);

  if (!target) return "";

  const { registration, horseNumber } = target;
  const payload = registration.payload || {};
  const pricing = getShowPricing(group.event);
  const classPrices = group.event?.event_settings?.class_prices || {};
  const participantName = getParticipantName(registration);
  const allHorseNumbers = getShowHorseNumbers(payload);
  const horseNumbers = horseNumber === "all" ? (allHorseNumbers.length ? allHorseNumbers : ["1"]) : [horseNumber];
  const canDeleteHorse = allHorseNumbers.length > 1;
  const membershipValue = payload["aeora-membership"] || (payload["aeora-day-membership"] ? "day" : payload["aeora-annual-membership"] ? "annual" : "none");
  const horseFieldsets = horseNumbers.map((currentHorseNumber) => {
    const horseNameField = `horse-${currentHorseNumber}-name`;
    return `
      <fieldset>
        <legend>Horse ${escapeHTML(currentHorseNumber)} and classes</legend>
        ${canDeleteHorse ? `<div class="admin-actions horse-edit-actions"><button class="button secondary compact-button" type="button" data-delete-show-horse="${escapeHTML(currentHorseNumber)}" data-registration-id="${escapeHTML(registration.id)}" data-event-id="${escapeHTML(eventId)}">Delete horse</button></div>` : ""}
        <label>Horse name<input name="${escapeHTML(horseNameField)}" type="text" value="${escapeHTML(payload[horseNameField] || "")}" required></label>
        <div class="checkbox-grid">
          ${showClassSlugs.map((slug) => {
            const className = humanizeFieldName(slug);
            const price = Number(classPrices[slug] ?? getDefaultShowClassPrice(slug));
            const fieldName = `horse-${currentHorseNumber}-class-${slug}`;
            return `<label class="check-row"><input name="${escapeHTML(fieldName)}" type="checkbox"${payload[fieldName] === true ? " checked" : ""}><span>${escapeHTML(className)} <strong>${formatCurrency(price)}</strong></span></label>`;
          }).join("")}
        </div>
      </fieldset>
    `;
  }).join("");

  return `
    <form class="form-panel show-entry-edit-panel modal-edit-panel" data-show-entry-edit-form data-registration-id="${escapeHTML(registration.id)}" data-event-id="${escapeHTML(eventId)}" data-horse-number="${escapeHTML(horseNumber)}">
      <div class="form-heading modal-heading">
        <p class="eyebrow">Edit show entry</p>
        <h2 id="modal-title">${escapeHTML(participantName || "Show participant")}</h2>
        <p>Update the rider details, selected classes, extras, or membership options for this entry.</p>
      </div>
      <div class="form-grid">
        <label>First name<input name="participant-first-name" type="text" value="${escapeHTML(payload["participant-first-name"] || "")}" required></label>
        <label>Last name<input name="participant-last-name" type="text" value="${escapeHTML(payload["participant-last-name"] || "")}" required></label>
        <label>Email<input name="participant-email" type="email" value="${escapeHTML(payload["participant-email"] || "")}"></label>
        <label>Phone<input name="participant-phone" type="tel" value="${escapeHTML(payload["participant-phone"] || "")}"></label>
        <label>Date of birth<input name="participant-date-of-birth" type="date" value="${escapeHTML(payload["participant-date-of-birth"] || "")}"></label>
        <label>Riding Level<select name="riding-level">${renderRidingLevelOptions(payload["riding-level"] || "", "Not supplied")}</select></label>
        <label>Membership number<input name="membership-number" type="text" value="${escapeHTML(payload["membership-number"] || "")}"></label>
        <label>Membership email<input name="membership-email" type="email" value="${escapeHTML(payload["membership-email"] || "")}"></label>
      </div>
      ${horseFieldsets}
      <fieldset>
        <legend>Membership and extras</legend>
        <div class="form-grid">
          <label>AEORA membership<select name="aeora-membership">
            <option value="none"${membershipValue === "none" ? " selected" : ""}>Already covered / not required</option>
            <option value="day"${membershipValue === "day" ? " selected" : ""}>Day membership (${formatCurrency(pricing.dayMembership)})</option>
            <option value="annual"${membershipValue === "annual" ? " selected" : ""}>Annual membership</option>
          </select></label>
          <label>Dinner tickets<input name="dinner-count" type="number" min="0" step="1" value="${escapeHTML(payload["dinner-count"] || "0")}"></label>
          <label>Camping nights<input name="camping-night-count" type="number" min="0" step="1" value="${escapeHTML(payload["camping-night-count"] || "0")}"></label>
          <label>Yards<input name="yard-count" type="number" min="0" step="1" value="${escapeHTML(payload["yard-count"] || "0")}"></label>
        </div>
        <label class="check-row"><input name="camping-with-power" type="checkbox"${payload["camping-with-power"] === true ? " checked" : ""}><span>Camping with power (${formatCurrency(pricing.poweredCamping)} per night)</span></label>
        <label class="check-row"><input name="camping-without-power" type="checkbox"${payload["camping-without-power"] === true ? " checked" : ""}><span>Camping without power (${formatCurrency(pricing.unpoweredCamping)} per night)</span></label>
      </fieldset>
      <div class="admin-actions">
        <button class="button primary form-submit" type="submit">Save show entry</button>
        <button class="button secondary form-submit" type="button" data-cancel-show-entry-edit>Cancel</button>
      </div>
      <p class="form-status" data-show-entry-edit-status></p>
    </form>
  `;
}

function renderShowPaymentSection(eventId, group) {
  const paidCount = group.registrations.filter(isShowRegistrationPaid).length;
  const totalPaid = group.registrations.reduce((total, registration) => total + (isShowRegistrationPaid(registration) ? getShowRegistrationTotal(registration, group.event) : 0), 0);

  return `
    ${renderCollapsibleAdminPanel("Show payments", `
      <section class="show-class-panel">
        ${renderEventPaymentSection(eventId, group)}
      </section>
    `, { key: `${eventId}:payments`, meta: `${paidCount}/${group.registrations.length} paid · ${formatCurrency(totalPaid)} collected` })}
  `;
}

function renderShowDetail(eventId, group, results = [], expenses = []) {
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
  const pricing = getShowPricing(group.event);
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
          ((payload["camping-with-power"] === true ? pricing.poweredCamping : 0) +
          (payload["camping-without-power"] === true ? pricing.unpoweredCamping : 0)) *
          getPayloadNumber(payload, "camping-night-count") +
          getPayloadNumber(payload, "yard-count") * pricing.yard,
        hasPower: payload["camping-with-power"] === true,
        hasNoPower: payload["camping-without-power"] === true,
        hasCamping: campingTypes.length > 0,
      };
    })
    .filter((entry) => entry.hasCamping || entry.yardCount > 0);
  const classSections = classNames.length
    ? classNames
    .map((className) => {
      const entries = classGroups[className];
      const isComplete = processedClasses.has(className);
      return renderCollapsibleAdminPanel(`${className} class`, `
        <section class="show-class-panel">
          <div class="form-heading">
            <p class="eyebrow">Show class</p>
            <h2>${escapeHTML(className)}${isComplete ? ' <span class="class-complete-icon" title="Results processed" aria-label="Results processed">Complete</span>' : ""}</h2>
          </div>
          <div class="admin-data-table show-class-table" role="table" aria-label="${escapeHTML(className)} entries">
            <div role="row" class="admin-table-header">
              <span role="columnheader">Order</span>
              <span role="columnheader">Participant</span>
              <span role="columnheader">Horse</span>
              <span role="columnheader">Riding Level</span>
              <span role="columnheader">Drag</span>
            </div>
            ${entries
              .map((entry, index) => `
                <div role="row" class="admin-table-row show-draggable-row" draggable="true" data-drag-entry="${escapeHTML(entry.id)}" data-class-name="${escapeHTML(className)}">
                  <span role="cell">${index + 1}</span>
                  <span role="cell">${entry.isManual ? escapeHTML(entry.participant) : `<button class="text-link table-text-link" type="button" data-edit-show-entry data-entry-id="${escapeHTML(entry.id)}">${escapeHTML(entry.participant)}</button>`}</span>
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
      `, { key: `${eventId}:class:${className}`, meta: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}${isComplete ? " · Complete" : ""}` });
    })
    .join("")
    : '<p class="empty-state">No show class entries yet.</p>';

  const showSummarySection = renderCollapsibleAdminPanel("Judge access", `<section class="show-class-panel"><div class="form-heading"><p class="eyebrow">Judge access</p><h2>Assign a judge to this show</h2><p data-judge-assignment-summary>Checking current judge assignment...</p></div><form class="form-grid judge-access-form" data-judge-credentials-form data-event-id="${escapeHTML(eventId)}"><label>Judge login name<input name="username" type="text" pattern="[a-zA-Z0-9._-]+" autocomplete="username" required><span class="field-note">This exact name is used on the judge sign-in page.</span></label><label>New password<input name="password" type="text" minlength="5" required><span class="field-note">At least 5 characters. The password is visible while you set it.</span></label><button class="button secondary form-submit" type="submit">Assign judge &amp; save access</button><p class="form-status" data-judge-credentials-status></p></form></section>`, { key: `${eventId}:judge-access` });

  const dinnerSection = `
    ${renderCollapsibleAdminPanel("Dinner list", `
      <section class="show-class-panel">
        <div class="form-heading">
          <p class="eyebrow">Show extras</p>
          <h2>Dinner list</h2>
        </div>
        ${dinnerRegistrations.length
          ? `
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
    `, { key: `${eventId}:dinner`, meta: `${dinnerTicketTotal} ticket${dinnerTicketTotal === 1 ? "" : "s"}` })}
  `;

  const campingSection = `
    ${renderCollapsibleAdminPanel("Camping and yards", `
      <section class="show-class-panel">
        <div class="form-heading">
          <p class="eyebrow">Show extras</p>
          <h2>Camping and yards</h2>
        </div>
        ${campingRegistrations.length
          ? `
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
    `, { key: `${eventId}:camping`, meta: `${campingRegistrations.length} registration${campingRegistrations.length === 1 ? "" : "s"}` })}
  `;

  const nonMemberSection = `
    ${renderCollapsibleAdminPanel("Non-members", `
      <section class="show-class-panel">
        <div class="form-heading">
          <p class="eyebrow">Membership</p>
          <h2>Non-members</h2>
        </div>
        ${nonMemberRegistrations.length
          ? `
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
    `, { key: `${eventId}:non-members`, meta: `${nonMemberRegistrations.length}` })}
  `;

  return `${showSummarySection}${renderShowPaymentSection(eventId, group)}${classSections}${nonMemberSection}${dinnerSection}${campingSection}`;
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
  summaryText.textContent = isMemberPage
    ? `${summary.attendees} annual club member${summary.attendees === 1 ? "" : "s"} on record.`
    : group.event.type === "show"
      ? `${dateLabel} | ${summary.attendees} registered | ${summary.dayMembershipForms} day membership forms`
      : `${dateLabel} | ${summary.attendees} registered | ${summary.dayMembershipForms} day membership forms | ${formatCurrency(summary.revenue)} total`;

  let detailContent = "";

  if (eventId === "club-members") {
    detailContent = renderClubMembersDetail(group.registrations);
  } else if (group.event.type === "show") {
    detailContent = renderShowDetail(eventId, group, showResults, eventExpenses);
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
        </dl>` : isMemberPage || group.event.type.startsWith("external-") ? "" : `<dl class="event-detail-stats">
          <div>
            <dt>Attendees</dt>
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
      ${group.event.type === "show" ? renderShowFinancePanel(eventId, group.event, group.registrations, eventExpenses) : ""}
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
    const sortedClassNames = sortShowClassNames(Object.keys(classes));
    const drawTimekeeperSection = () => {
      pdf.addPage(); y = 16; addHeader("Timekeeper sheets");
      sortedClassNames.forEach((className) => { const entries = classes[className]; for (let start = 0; start < entries.length; start += 18) { const run = entries.slice(start, start + 18); const tableHeight = 17 + run.length * 8; if (y + tableHeight > 278) { pdf.addPage(); y = 16; addHeader("Timekeeper sheets"); } pdf.setFillColor(...templateGold); pdf.rect(margin, y, 182, 8, "F"); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(`${className}${entries.length > 18 ? ` - ${start + 1}-${Math.min(start + 18, entries.length)}` : ""}`, margin + 4, y + 5.3); y += 8; pdf.setFillColor(245, 239, 226); pdf.rect(margin, y, 182, 9, "F"); pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9 + run.length * 8); [margin + 22, margin + 86, margin + 146].forEach((x) => pdf.line(x, y, x, y + 9 + run.length * 8)); pdf.setFontSize(9); pdf.text("ORDER", margin + 4, y + 5.8); pdf.text("RIDER NAME", margin + 27, y + 5.8); pdf.text("HORSE NAME", margin + 91, y + 5.8); pdf.text("TIME", margin + 151, y + 5.8); y += 9; pdf.setFont("helvetica", "normal"); run.forEach((entry, index) => { pdf.line(margin, y + 8, 196, y + 8); pdf.text(String(start + index + 1), margin + 8, y + 5.4); pdf.text(String(entry.participant).slice(0, 25), margin + 27, y + 5.4); pdf.text(String(entry.horseName).slice(0, 23), margin + 91, y + 5.4); y += 8; }); y += 8; } });
    };
    const drawGatekeeperSection = () => {
      const rows = sortedClassNames.flatMap((className) => classes[className].map((entry, index) => ({ className, entry, order: index + 1 })));
      const rowsPerColumn = 31; const rowsPerPage = rowsPerColumn * 2; const pages = Math.min(2, Math.ceil(rows.length / rowsPerPage) || 1);
      for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        pdf.addPage(); y = 16; addHeader(`Gatekeeper checklist${pages > 1 ? ` ${pageIndex + 1}` : ""}`);
        const pageRows = rows.slice(pageIndex * rowsPerPage, pageIndex * rowsPerPage + rowsPerPage);
        [0, 1].forEach((columnIndex) => {
          const columnRows = pageRows.slice(columnIndex * rowsPerColumn, columnIndex * rowsPerColumn + rowsPerColumn);
          if (!columnRows.length) return;
          const left = margin + columnIndex * 93; const width = 88; let rowY = y;
          pdf.setFillColor(...templateGold); pdf.rect(left, rowY, width, 8, "F"); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.2); pdf.text("TICK", left + 3, rowY + 5.2); pdf.text("ORDER", left + 15, rowY + 5.2); pdf.text("RIDER / HORSE", left + 31, rowY + 5.2); rowY += 8;
          pdf.setDrawColor(...templateLine); pdf.rect(left, rowY, width, columnRows.length * 7); [left + 12, left + 28].forEach((x) => pdf.line(x, rowY, x, rowY + columnRows.length * 7));
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8);
          columnRows.forEach(({ className, entry, order }) => { pdf.line(left, rowY + 7, left + width, rowY + 7); pdf.rect(left + 3, rowY + 2, 4, 4); pdf.text(String(order), left + 16, rowY + 4.8); pdf.text(`${String(entry.participant).slice(0, 17)} / ${String(entry.horseName).slice(0, 17)}`, left + 31, rowY + 3.5); pdf.setFontSize(5.8); pdf.text(String(className).slice(0, 22), left + 31, rowY + 6.1); pdf.setFontSize(6.8); rowY += 7; });
        });
        if (pageIndex === 1 && rows.length > rowsPerPage * 2) { pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(`Additional entries not shown: ${rows.length - rowsPerPage * 2}`, margin, 284); }
      }
    };
    sortShowClassNames(Object.keys(classes)).forEach((className) => { const entries = classes[className]; for (let start = 0; start < entries.length; start += 20) { const run = entries.slice(start, start + 20); const tableHeight = 17 + run.length * 8; if (y + tableHeight > 278) { pdf.addPage(); y = 16; addHeader("Run sheets"); } pdf.setFillColor(...templateGold); pdf.rect(margin, y, 182, 8, "F"); pdf.setTextColor(43, 37, 32); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text(`${className}${entries.length > 20 ? ` - ${start + 1}-${Math.min(start + 20, entries.length)}` : ""}`, margin + 4, y + 5.3); y += 8; pdf.setFillColor(245, 239, 226); pdf.rect(margin, y, 182, 9, "F"); pdf.setDrawColor(...templateLine); pdf.rect(margin, y, 182, 9 + run.length * 8); [margin + 24, margin + 105].forEach((x) => pdf.line(x, y, x, y + 9 + run.length * 8)); pdf.setFontSize(9); pdf.text("ORDER", margin + 4, y + 5.8); pdf.text("RIDER NAME", margin + 29, y + 5.8); pdf.text("HORSE NAME", margin + 110, y + 5.8); y += 9; pdf.setFont("helvetica", "normal"); run.forEach((entry, index) => { pdf.line(margin, y + 8, 196, y + 8); pdf.text(String(start + index + 1), margin + 8, y + 5.4); pdf.text(String(entry.participant).slice(0, 34), margin + 29, y + 5.4); pdf.text(String(entry.horseName).slice(0, 34), margin + 110, y + 5.4); y += 8; }); y += 8; } });
    drawTimekeeperSection();
    drawGatekeeperSection();
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
    y += 46; pdf.setFillColor(...gold); pdf.rect(left, y, width, 8, "F"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("#", left + 4, y + 5.2); pdf.text("OBSTACLE", left + 18, y + 5.2); pdf.text("COMMENTS", left + 82, y + 5.2); pdf.text("SCORE / 10", left + 164, y + 5.2); pdf.setFont("helvetica", "normal"); pdf.setDrawColor(...line);
    obstacleNames.forEach((name, index) => { const rowY = y + 8 + index * 10; pdf.rect(left, rowY, width, 10); pdf.line(left + 14, rowY, left + 14, rowY + 10); pdf.line(left + 76, rowY, left + 76, rowY + 10); pdf.line(left + 160, rowY, left + 160, rowY + 10); pdf.setFontSize(9); pdf.text(String(index + 1), left + 5, rowY + 6.5); pdf.text(String(name).slice(0, 24), left + 18, rowY + 6.5); });
    const scoreY = y + 8 + obstacleNames.length * 10 + 6; pdf.setFont("helvetica", "bold"); pdf.setFillColor(245, 239, 226); pdf.rect(left, scoreY, 86, 16, "FD"); pdf.rect(left + 96, scoreY, 86, 16, "FD"); pdf.text("TIME SCORE", left + 4, scoreY + 5.5); pdf.text("TOTAL", left + 100, scoreY + 5.5);
    const commentsY = scoreY + 20; pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("OVERALL COMMENTS FOR THE JUDGE", left + 4, commentsY); pdf.setDrawColor(...line); pdf.rect(left, commentsY + 3, width, 20);
    const guide = [["10", "Exceptional"], ["9", "Excellent"], ["8", "Great"], ["7", "Very good"], ["6", "Good"], ["5", "Satisfactory"], ["3-4", "Marginal"], ["1-2", "Poor"]];
    const guideY = commentsY + 28; const acronymX = left + 124; pdf.setFillColor(245, 239, 226); pdf.rect(left, guideY - 3, width, 23, "FD"); pdf.line(acronymX - 6, guideY - 3, acronymX - 6, guideY + 20); pdf.setFont("helvetica", "bold"); pdf.setFontSize(5.8); pdf.text("SCORING GUIDE", left + 4, guideY + 1.5); pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.1);
    guide.forEach(([score, label], index) => { const columnX = left + 4 + (index >= 4 ? 39 : 0); const rowY = guideY + 5 + (index % 4) * 3.1; pdf.text(`${score} - ${label}`, columnX, rowY); });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(4.9); pdf.text("0 - Missed obstacle or did not attempt + 20 sec", left + 4, guideY + 18.4);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(5.8); pdf.text("ACRONYM LIST", acronymX, guideY + 1.5); pdf.setFont("helvetica", "normal"); pdf.setFontSize(5.1);
    [["BG", "Broken Gate"], ["WL", "Wrong Lead"], ["GM", "Gaping Mouth"], ["H", "Hesitation"]].forEach(([code, label], index) => {
      pdf.text(`${code} - ${label}`, acronymX, guideY + 5.5 + index * 3.5);
    });
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
    try { await updateEventSettings(eventId, { obstacle_names: names }, { judge_name: String(page.querySelector("[name='judge_name']")?.value || "").trim() || null }); await loadSharedEvents(); status.textContent = "Judge name and obstacle names saved."; }
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

  dashboard.innerHTML = renderAdminTable({
    columns: ["Event", "Date", "Type", "Participants", "Day forms", "Revenue"],
    className: "event-overview-table",
    ariaLabel: "Registration events",
    emptyMessage: "No events have been added yet.",
    rows: groupEntries.map(([eventId, group]) => {
      const summary = getEventSummary(group);
      const eventType = typeLabels[group.event.type] || humanizeFieldName(group.event.type);
      const dateLabel = group.event.date ? formatDateParts(group.event.date).label : "Not dated";

      return [
        `<a class="admin-table-title-link" href="admin-event.html?event=${encodeURIComponent(eventId)}"><strong>${escapeHTML(group.event.title)}${registrationsAreClosed(group.event) ? ' <span class="registration-closed-pill dashboard-status-pill">Full</span>' : ""}</strong><small>${escapeHTML(group.event.location)}</small></a>`,
        escapeHTML(dateLabel),
        escapeHTML(eventType),
        String(summary.attendees),
        String(summary.dayMembershipForms),
        formatCurrency(summary.revenue),
      ];
    }),
  });
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
          <select data-add-result-riding-level>${renderRidingLevelOptions()}</select>
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
  const adminArea = Boolean(document.body.matches("[data-admin-role-required]") || document.querySelector("[data-admin-panel], [data-media-upload], [data-event-admin-form], [data-shop-item-form]"));
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

async function patchSupabaseRow(table, id, body, { returning = "minimal" } = {}) {
  return requestSupabase(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: `return=${returning}` },
    body: JSON.stringify(body),
  });
}

async function patchRegistrationPayload(registrationId, payload, options = {}) {
  return patchSupabaseRow("registrations", registrationId, { payload }, options);
}

async function patchEvent(eventId, body, options = {}) {
  return patchSupabaseRow("events", eventId, body, options);
}

async function updateEventSettings(eventId, settingsPatch, extraEventFields = {}) {
  const currentEvent = getEventDetails(eventId);

  return patchEvent(eventId, {
    ...extraEventFields,
    event_settings: {
      ...(currentEvent.event_settings || {}),
      ...settingsPatch,
    },
  });
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

async function fetchEventExpenses(eventId) {
  const query = new URLSearchParams({
    event_id: `eq.${eventId}`,
    select: "*",
    order: "date_incurred.desc",
  });

  return requestSupabase(`/rest/v1/event_expenses?${query.toString()}`);
}

async function fetchAnnualPointsData(year) {
  const leaderboardQuery = new URLSearchParams({
    calendar_year: `eq.${year}`,
    select: "*",
    order: "points_category.asc,rank.asc,participant_name.asc,horse_name.asc",
  });
  const entriesQuery = new URLSearchParams({
    calendar_year: `eq.${year}`,
    select: "result_id",
  });

  const [leaderboard, entries] = await Promise.all([
    requestSupabase(`/rest/v1/annual_points_leaderboard?${leaderboardQuery.toString()}`),
    requestSupabase(`/rest/v1/annual_points_entries?${entriesQuery.toString()}`),
  ]);

  return {
    leaderboard,
    resultCount: entries.length,
    combinations: leaderboard,
  };
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

async function cleanupPastExternalEvents() {
  const expiredExternalEvents = remoteEvents.filter((event) => isPastExternalEvent(event));
  if (!expiredExternalEvents.length) return;

  const expiredIds = expiredExternalEvents.map((event) => event.id).filter(Boolean);

  remoteEvents = remoteEvents.filter((event) => !expiredIds.includes(event.id));

  try {
    await Promise.all(expiredIds.map(async (eventId) => {
      await deleteEventData(eventId);
      await requestSupabase(`/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    }));
  } catch (error) {
    console.warn("Past external events could not be cleaned up automatically.", error);
  }
}

async function deleteShowRegistration(eventId, registrationId) {
  await requestSupabase(`/rest/v1/show_results?event_id=eq.${encodeURIComponent(eventId)}&entry_id=like.${encodeURIComponent(`${registrationId}:*`)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch((error) => {
    console.warn("Linked show result cleanup failed; deleting registration anyway:", error);
  });
  await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registrationId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  adminRegistrations = adminRegistrations.filter((registration) => registration.id !== registrationId);
  showResults = showResults.filter((result) => !(result.event_id === eventId && String(result.entry_id || "").startsWith(`${registrationId}:`)));
}

async function deleteShowHorse(eventId, registration, horseNumber) {
  const payload = { ...(registration.payload || {}) };
  const currentHorseNumbers = getShowHorseNumbers(payload);

  if (currentHorseNumbers.length <= 1) throw new Error("Entries need at least one horse.");

  Object.keys(payload).forEach((key) => {
    if (key.startsWith(`horse-${horseNumber}-`)) delete payload[key];
  });

  payload["calculated-total"] = calculateShowRegistrationTotal(payload, getEventDetails(eventId));

  await requestSupabase(`/rest/v1/show_results?event_id=eq.${encodeURIComponent(eventId)}&entry_id=like.${encodeURIComponent(`${registration.id}:${horseNumber}:*`)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch((error) => {
    console.warn("Linked show result cleanup failed; deleting horse anyway:", error);
  });

  await patchRegistrationPayload(registration.id, payload, { returning: "representation" });
  registration.payload = payload;
  showResults = showResults.filter((result) => !(result.event_id === eventId && String(result.entry_id || "").startsWith(`${registration.id}:${horseNumber}:`)));
}

async function deleteRegistration(registrationId) {
  await requestSupabase(`/rest/v1/registrations?id=eq.${encodeURIComponent(registrationId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  adminRegistrations = adminRegistrations.filter((registration) => registration.id !== registrationId);
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
        [showResults, eventExpenses] = await Promise.all([
          fetchShowResultsForEvent(eventId),
          fetchEventExpenses(eventId),
        ]);
      } catch (error) {
        showResults = [];
        eventExpenses = [];
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
    uploadedMediaList.innerHTML = renderAdminTable({
      columns: ["Title", "Homepage", "Action"],
      emptyMessage: "No uploaded media yet.",
      rows: assets.map((asset) => {
        const path = asset.storage_path || asset.object_path;
        const options = [["", "Not used"], ["hero", "Hero"], ["gallery-1", "Gallery 1"], ["gallery-2", "Gallery 2"], ["gallery-3", "Gallery 3"], ["gallery-4", "Gallery 4"]]
          .map(([value, label]) => `<option value="${value}"${asset.homepage_slot === value ? " selected" : ""}>${label}</option>`)
          .join("");

        return [
          escapeHTML(mediaTitle(path)),
          `<select data-homepage-slot-select>${options}</select>`,
          `<button class="button secondary compact-button" type="button" data-save-media-id="${escapeHTML(asset.id)}">Save</button> <button class="button secondary compact-button" type="button" data-delete-media-id="${escapeHTML(asset.id)}" data-delete-media-path="${escapeHTML(path || "")}">Delete</button>`,
        ];
      }),
    });
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

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-shop-item-form]");
  if (!form) return;

  event.preventDefault();
  const status = form.querySelector("[data-shop-item-status]");
  const formData = new FormData(form);
  const itemId = String(formData.get("id") || "");
  const existingItem = (window.shopItems || []).find((shopItem) => shopItem.id === itemId);
  const imageFile = form.querySelector("[name='image_file']")?.files?.[0];
  const body = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    price: Number(formData.get("price") || 0),
    image_url: String(formData.get("image_url") || "").trim() || null,
    order_url: existingItem?.order_url || null,
    stock_status: String(formData.get("stock_status") || "available"),
    published: existingItem ? existingItem.published !== false : true,
    sort_order: Number(formData.get("sort_order") || 0),
    updated_at: new Date().toISOString(),
  };

  if (status) status.textContent = itemId ? "Saving shop item..." : "Adding shop item...";

  try {
    if (imageFile) {
      if (status) status.textContent = "Uploading product image...";
      body.image_url = await uploadShopItemImage(imageFile);
    }

    if (itemId) {
      await requestSupabase(`/rest/v1/shop_items?id=eq.${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
    } else {
      await requestSupabase("/rest/v1/shop_items", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
    }

    resetShopItemForm();
    await loadShopAdmin();
  } catch (error) {
    if (status) status.textContent = `Could not save shop item: ${error.message}`;
  }
});

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-shop-item]");
  if (!addButton) return;
  openShopItemModal();
});

document.addEventListener("click", (event) => {
  const orderButton = event.target.closest("[data-order-shop-item]");
  if (!orderButton) return;
  const item = (window.shopItems || []).find((shopItem) => shopItem.id === orderButton.dataset.orderShopItem);
  if (item) openModal(renderShopOrderModal(item));
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-shop-item]");
  if (!editButton) return;
  const item = (window.shopItems || []).find((shopItem) => shopItem.id === editButton.dataset.editShopItem);
  if (item) openShopItemModal(item);
});

document.addEventListener("change", (event) => {
  const imageInput = event.target.closest("[data-shop-item-form] [name='image_file']");
  if (!imageInput) return;
  const preview = imageInput.closest("form")?.querySelector("[data-shop-image-preview]");
  const image = preview?.querySelector("img");
  const file = imageInput.files?.[0];
  if (!preview || !image || !file) return;
  image.src = URL.createObjectURL(file);
  preview.hidden = false;
});

document.addEventListener("change", (event) => {
  const mediaInput = event.target.closest("[data-email-attendees-form] [name='media_file']");
  if (!mediaInput) return;
  const preview = mediaInput.closest("form")?.querySelector("[data-email-media-preview]");
  const image = preview?.querySelector("img");
  const file = mediaInput.files?.[0];
  if (!preview || !image) return;
  if (!file || !file.type.startsWith("image/")) {
    preview.hidden = true;
    image.removeAttribute("src");
    return;
  }
  image.src = URL.createObjectURL(file);
  preview.hidden = false;
});

document.addEventListener("input", (event) => {
  const quantityInput = event.target.closest("[data-shop-order-quantity]");
  if (!quantityInput) return;
  const modal = quantityInput.closest("[data-shop-order-modal]");
  const item = (window.shopItems || []).find((shopItem) => shopItem.id === modal?.dataset.itemId);
  if (!item) return;
  const quantity = Math.max(1, Number(quantityInput.value || 1));
  const total = Number(item.price || 0) * quantity;
  modal.querySelector("[data-shop-order-total]").textContent = formatCurrency(total);
  const totalInput = modal.querySelector("[data-shop-order-total-input]");
  if (totalInput) totalInput.value = formatCurrency(total);
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-shop-order-modal]");
  if (!form) return;

  event.preventDefault();
  const config = getSupabaseConfig();
  const item = (window.shopItems || []).find((shopItem) => shopItem.id === form.dataset.itemId);
  const status = form.querySelector("[data-shop-order-status]");
  const submitButton = form.querySelector("[type='submit']");

  if (!config || !item) {
    if (status) status.textContent = "Could not send this order. Please try again later.";
    return;
  }

  const formData = new FormData(form);
  const quantity = Math.max(1, Number(formData.get("quantity") || 1));
  const total = Number(item.price || 0) * quantity;

  if (status) status.textContent = "Sending order...";
  if (submitButton) submitButton.disabled = true;

  try {
    const response = await fetch(`${config.url}/functions/v1/shop-order`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        itemName: item.name,
        itemPrice: Number(item.price || 0),
        quantity,
        total,
        customerName: String(formData.get("customer_name") || "").trim(),
        customerEmail: String(formData.get("customer_email") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        comments: String(formData.get("comments") || "").trim(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Order email failed");
    const reference = result.reference || "the shop reference";
    const referenceDisplay = form.querySelector("[data-shop-order-reference]");
    if (referenceDisplay) referenceDisplay.textContent = reference;
    if (status) status.textContent = `Order sent. Please pay by bank transfer using reference ${reference}.`;
    form.reset();
    form.querySelector("[name='quantity']").value = "1";
    form.querySelector("[data-shop-order-total]").textContent = formatCurrency(Number(item.price || 0));
    const totalInput = form.querySelector("[data-shop-order-total-input]");
    if (totalInput) totalInput.value = formatCurrency(Number(item.price || 0));
  } catch (error) {
    if (status) status.textContent = `Could not send order: ${error.message}`;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-toggle-shop-published]");
  if (!checkbox) return;
  try {
    await requestSupabase(`/rest/v1/shop_items?id=eq.${encodeURIComponent(checkbox.dataset.toggleShopPublished)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ published: checkbox.checked, updated_at: new Date().toISOString() }),
    });
    await loadShopAdmin();
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    alert(`Could not update shop visibility: ${error.message}`);
  }
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-shop-item]");
  if (!deleteButton || !window.confirm("Delete this shop item?")) return;

  try {
    await requestSupabase(`/rest/v1/shop_items?id=eq.${encodeURIComponent(deleteButton.dataset.deleteShopItem)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    resetShopItemForm();
    await loadShopAdmin();
  } catch (error) {
    alert(`Could not delete shop item: ${error.message}`);
  }
});

document.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-toggle-shop-order-sent]");
  if (!checkbox) return;

  const sentOut = checkbox.checked;
  try {
    const config = getSupabaseConfig();
    const token = await getFreshAdminAccessToken();
    if (!config || !token) throw new Error("Admin sign-in is required.");
    const response = await fetch(`${config.url}/functions/v1/shop-orders-admin`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: checkbox.dataset.toggleShopOrderSent, sentOut }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not update order status.");
    const label = checkbox.closest("label")?.querySelector("span");
    if (label) label.textContent = sentOut ? "Sent" : "Waiting";
    const filter = document.querySelector("[data-shop-order-filter]")?.value || document.querySelector("[data-shop-order-list]")?.dataset.shopOrderList || "all";
    if ((filter === "waiting" && sentOut) || (filter === "fulfilled" && !sentOut)) await loadShopOrders(filter);
  } catch (error) {
    checkbox.checked = !sentOut;
    alert(`Could not update order status: ${error.message}`);
  }
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-shop-order-filter]");
  if (!select) return;
  loadShopOrders(select.value);
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
      event_settings: String(formData.get("type")).startsWith("external-") ? { provider_url: String(formData.get("provider_url") || "").trim(), external_cost: String(formData.get("external_cost") || "").trim() } : String(formData.get("type")) === "club" ? { club_day_fee: clubDayFee, club_day_junior_fee: juniorClubDayFee } : String(formData.get("type")) === "clinic" ? { clinic_fee: defaultClinicFee } : {},
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

document.addEventListener("toggle", (event) => {
  const panel = event.target.closest?.("[data-panel-key]");
  if (!panel) return;
  writeAdminPanelOpenState(panel.dataset.panelKey, panel.open);
}, true);

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

document.addEventListener("click", (event) => {
  const emailButton = event.target.closest("[data-email-attendees]");
  if (!emailButton) return;
  openModal(renderEmailAttendeesModal(emailButton.dataset.eventId || "", emailButton.dataset.eventTitle || ""));
});

document.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest("[data-toggle-event-registrations]");
  if (!toggleButton) return;

  const eventId = toggleButton.dataset.eventId;
  const currentEvent = getEventDetails(eventId);
  const nextClosedState = toggleButton.dataset.registrationsClosed !== "true";
  const actionLabel = nextClosedState ? "close registrations for" : "re-open registrations for";

  if (!window.confirm(`Are you sure you want to ${actionLabel} ${currentEvent.title}?`)) return;

  toggleButton.disabled = true;

  try {
    await updateEventSettings(eventId, { registrations_closed: nextClosedState });
    await loadSharedEvents();
    renderEventPage(adminRegistrations);
  } catch (error) {
    alert(`Could not update registrations: ${error.message}`);
  } finally {
    toggleButton.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-member]");
  if (!editButton) return;
  editingMemberId = editButton.dataset.registrationId;
  renderEventPage(adminRegistrations);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-close-modal]")) return;
  closeModal();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-cancel-member-edit]")) return;
  editingMemberId = null;
  renderEventPage(adminRegistrations);
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-event-registration]");
  if (!editButton) return;
  const registration = adminRegistrations.find((item) => item.id === editButton.dataset.editEventRegistration);
  if (!registration) return;
  openModal(renderEventRegistrationEditPanel(registration));
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-show-entry]");
  if (!editButton) return;
  editingShowEntryId = editButton.dataset.entryId;
  const eventId = new URLSearchParams(window.location.search).get("event") || "";
  const group = groupRegistrationsByEvent(adminRegistrations)[eventId];

  if (!group) return;

  openModal(renderShowEntryEditPanel(eventId, group));
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-show-horse]");
  if (!deleteButton) return;

  const eventId = deleteButton.dataset.eventId || "";
  const registration = adminRegistrations.find((item) => item.id === deleteButton.dataset.registrationId);
  const horseNumber = deleteButton.dataset.deleteShowHorse;
  const payload = registration?.payload || {};
  const horseName = payload[`horse-${horseNumber}-name`] || `Horse ${horseNumber}`;
  const status = deleteButton.closest("form")?.querySelector("[data-show-entry-edit-status]");

  if (!registration || !horseNumber) return;
  if (!window.confirm(`Delete ${horseName} from this entry? This removes the horse, selected classes, and linked scoring results.`)) return;

  deleteButton.disabled = true;

  try {
    await deleteShowHorse(eventId, registration, horseNumber);
    await loadRegistrations();

    const updatedRegistration = adminRegistrations.find((item) => item.id === registration.id);
    const remainingHorseNumbers = getShowHorseNumbers(updatedRegistration?.payload || {});
    const group = groupRegistrationsByEvent(adminRegistrations)[eventId];

    if (updatedRegistration && group) {
      editingShowEntryId = `${updatedRegistration.id}:${remainingHorseNumbers.length > 1 ? "all" : remainingHorseNumbers[0] || "all"}:payment`;
      openModal(renderShowEntryEditPanel(eventId, group));
    } else {
      editingShowEntryId = null;
      closeModal();
    }
  } catch (error) {
    deleteButton.disabled = false;
    if (status) status.textContent = `Could not delete horse: ${error.message}`;
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-cancel-show-entry-edit]")) return;
  editingShowEntryId = null;
  closeModal();
});

document.addEventListener("click", (event) => {
  const transferButton = event.target.closest("[data-open-transfer-modal]");
  if (!transferButton) return;
  const registration = adminRegistrations.find((item) => item.id === transferButton.dataset.openTransferModal);
  if (!registration) return;
  openModal(renderTransferAttendeeModal(registration, transferButton.dataset.fromEvent));
});

document.addEventListener("submit", async (event) => {
  const emailForm = event.target.closest("[data-email-attendees-form]");
  if (!emailForm) return;

  event.preventDefault();
  const status = emailForm.querySelector("[data-email-attendees-status]");
  const submitButton = emailForm.querySelector("[type='submit']");
  const formData = new FormData(emailForm);
  const config = getSupabaseConfig();
  const token = await getFreshAdminAccessToken();
  const mediaFile = emailForm.querySelector("[name='media_file']")?.files?.[0];

  if (!config || !token) return;
  if (status) status.textContent = "Sending attendee email...";
  if (submitButton) submitButton.disabled = true;

  try {
    let mediaUrl = "";
    if (mediaFile) {
      if (status) status.textContent = "Uploading media...";
      mediaUrl = await uploadAdminMediaFile(mediaFile, "attendee-email");
      if (status) status.textContent = "Sending attendee email...";
    }

    const response = await fetch(`${config.url}/functions/v1/email-attendees`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: emailForm.dataset.eventId,
        subject: String(formData.get("subject") || ""),
        message: String(formData.get("message") || ""),
        mediaUrl,
        mediaName: mediaFile?.name || "",
        mediaType: mediaFile?.type || "",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Attendee email failed");
    if (status) status.textContent = `${result.sentCount || 0} of ${result.recipientCount || 0} attendee email${result.recipientCount === 1 ? "" : "s"} sent.`;
    if (result.failedCount) alert(`${result.sentCount || 0} sent, ${result.failedCount} failed. Please check the Resend logs.`);
  } catch (error) {
    if (status) status.textContent = `Could not send email: ${error.message}`;
    if (submitButton) submitButton.disabled = false;
  }
});

document.addEventListener("submit", async (event) => {
  const transferForm = event.target.closest("[data-transfer-attendee-form]");
  if (!transferForm) return;
  event.preventDefault();
  const destinationId = String(new FormData(transferForm).get("destination_event_id") || "");
  const destination = getEvents().find((item) => item.id === destinationId && item.type === "club");
  const registration = adminRegistrations.find((item) => item.id === transferForm.dataset.registrationId);
  const status = transferForm.querySelector("[data-transfer-attendee-status]");
  if (!destination || !registration) {
    if (status) status.textContent = "Choose the destination club day first.";
    return;
  }
  if (!window.confirm(`Transfer ${getParticipantName(registration)} to ${destination.title}?`)) return;
  const payload = { ...registration.payload, "club-date": destination.id };
  try {
    await patchRegistrationPayload(registration.id, payload, { returning: "representation" });
    await requestSupabase("/rest/v1/attendee_transfers", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ registration_id: registration.id, from_event_id: transferForm.dataset.fromEvent, to_event_id: destination.id }) });
    closeModal();
    await loadRegistrations();
  } catch (error) {
    if (status) status.textContent = `Could not transfer attendee: ${error.message}`;
  }
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
    await patchRegistrationPayload(registration.id, payload);
    registration.payload = payload;
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    alert(`Could not save attendance: ${error.message}`);
  } finally { checkbox.disabled = false; }
});

document.addEventListener("change", async (event) => {
  const checkbox = event.target.closest("[data-payment-registration]");
  if (!checkbox) return;
  const registration = adminRegistrations.find((item) => item.id === checkbox.dataset.paymentRegistration);
  if (!registration) return;

  checkbox.disabled = true;
  try {
    const payload = { ...(registration.payload || {}) };
    if (registration.form_type === "show_registration") {
      payload["show-paid"] = checkbox.checked;
      payload["show-paid-at"] = checkbox.checked ? new Date().toISOString() : null;
    } else if (registration.form_type === "club_day_registration") {
      payload["club-day-paid"] = checkbox.checked;
    } else if (registration.form_type === "clinic_registration") {
      payload["clinic-paid"] = checkbox.checked;
    }
    await patchRegistrationPayload(registration.id, payload);
    registration.payload = payload;
    renderEventPage(adminRegistrations);
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    alert(`Could not update payment status: ${error.message}`);
  } finally {
    checkbox.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-show-registration]");
  if (!deleteButton) return;

  const participantName = deleteButton.dataset.participantName || "this show entry";
  if (!window.confirm(`Delete ${participantName}? This removes their show registration and linked show results.`)) return;

  deleteButton.disabled = true;
  try {
    await deleteShowRegistration(deleteButton.dataset.eventId, deleteButton.dataset.deleteShowRegistration);
    renderEventPage(adminRegistrations);
  } catch (error) {
    alert(`Could not delete show entry: ${error.message}`);
  } finally {
    deleteButton.disabled = false;
  }
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-event-registration]");
  if (!deleteButton) return;

  const participantName = deleteButton.dataset.participantName || "this attendee";
  if (!window.confirm(`Delete ${participantName} from this event?`)) return;

  deleteButton.disabled = true;
  try {
    await deleteRegistration(deleteButton.dataset.deleteEventRegistration);
    renderEventPage(adminRegistrations);
    renderEventDashboard(adminRegistrations);
  } catch (error) {
    alert(`Could not delete attendee: ${error.message}`);
  } finally {
    deleteButton.disabled = false;
  }
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
  const showCostForm = event.target.closest("[data-show-cost-form]");
  if (showCostForm) {
    event.preventDefault();
    const status = showCostForm.querySelector("[data-show-cost-status]");
    const data = Object.fromEntries(new FormData(showCostForm));

    try {
      await requestSupabase("/rest/v1/event_expenses", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          event_id: showCostForm.dataset.eventId,
          description: data.description,
          amount: Number(data.amount),
          date_incurred: data.date_incurred,
        }),
      });
      showCostForm.querySelector("[name='description']").value = "";
      showCostForm.querySelector("[name='amount']").value = "";
      if (status) status.textContent = "Show cost saved.";
      await loadRegistrations();
    } catch (error) {
      if (status) status.textContent = `Could not save show cost: ${error.message}`;
    }
    return;
  }

  const pricingForm = event.target.closest("[data-event-pricing-form]");
  if (pricingForm) {
    event.preventDefault();
    const formData = new FormData(pricingForm);
    const eventId = pricingForm.dataset.eventId;
    const currentEvent = getEventDetails(eventId);
    const classPrices = Object.fromEntries(showClassSlugs.map((slug) => [slug, Number(formData.get(`class_${slug}`) || 0)]));
    const settings = currentEvent.type === "club" ? { club_day_fee: Number(formData.get("club_day_fee") || 0), club_day_junior_fee: Number(formData.get("club_day_junior_fee") || 0) } : currentEvent.type === "clinic" ? { ...(currentEvent.event_settings || {}), clinic_fee: Number(formData.get("clinic_fee") || 0) } : { dinner_price: Number(formData.get("dinner_price") || 0), powered_camping_price: Number(formData.get("powered_camping_price") || 0), unpowered_camping_price: Number(formData.get("unpowered_camping_price") || 0), yard_price: Number(formData.get("yard_price") || 0), dinner_vendor_url: String(formData.get("dinner_vendor_url") || "").trim(), custom_information: String(formData.get("custom_information") || "").trim(), class_prices: classPrices };
    const status = pricingForm.querySelector("[data-event-pricing-status]");
    try {
      await updateEventSettings(eventId, settings);
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
      await patchRegistrationPayload(registration.id, payload, { returning: "representation" });
      editingMemberId = null;
      await loadRegistrations();
    } catch (error) {
      if (status) status.textContent = `Could not save member: ${error.message}`;
    }
    return;
  }
  const eventRegistrationForm = event.target.closest("[data-event-registration-edit-form]");
  if (eventRegistrationForm) {
    event.preventDefault();
    const registration = adminRegistrations.find((item) => item.id === eventRegistrationForm.dataset.registrationId);
    if (!registration) return;

    const formData = new FormData(eventRegistrationForm);
    const payload = { ...registration.payload };
    const isClinic = eventRegistrationForm.dataset.formType === "clinic_registration";
    const prefix = isClinic ? "clinic" : "club-day";
    const horseField = isClinic ? "clinic-horse-name" : "club-day-horse-name";
    const paidField = isClinic ? "clinic-paid" : "club-day-paid";
    const dayMembershipField = isClinic ? "clinic-day-membership" : "club-day-day-membership";
    const eventDetails = getEventDetails(eventRegistrationForm.dataset.eventId);

    [`${prefix}-first-name`, `${prefix}-last-name`, `${prefix}-email`, `${prefix}-phone`, horseField].forEach((field) => {
      payload[field] = String(formData.get(field) || "").trim();
    });
    payload[paidField] = formData.has(paidField);
    payload[dayMembershipField] = formData.has(dayMembershipField);
    if (!isClinic) {
      payload["club-day-rider-type"] = String(formData.get("club-day-rider-type") || "adult");
      delete payload["club-day-young-rider"];
    }

    if (isClinic) {
      payload["calculated-total"] = Number(eventDetails.event_settings?.clinic_fee ?? defaultClinicFee);
    } else {
      payload["calculated-total"] = getClubDayBaseFeeForPayload(payload, eventDetails) + (payload[dayMembershipField] === true ? getDayMembershipFeeForPayload(payload, eventDetails) : 0);
    }

    const status = eventRegistrationForm.querySelector("[data-event-registration-edit-status]");

    try {
      await patchRegistrationPayload(registration.id, payload);
      closeModal();
      await loadRegistrations();
    } catch (error) {
      if (status) status.textContent = `Could not save registration: ${error.message}`;
    }
    return;
  }
  const showEntryForm = event.target.closest("[data-show-entry-edit-form]");
  if (showEntryForm) {
    event.preventDefault();
    const registration = adminRegistrations.find((item) => item.id === showEntryForm.dataset.registrationId);
    const eventDetails = getEventDetails(showEntryForm.dataset.eventId);
    const horseNumber = showEntryForm.dataset.horseNumber;

    if (!registration || !horseNumber) return;

    const formData = new FormData(showEntryForm);
    const payload = { ...registration.payload };
    const horseNumbers = horseNumber === "all" ? (getShowHorseNumbers(payload).length ? getShowHorseNumbers(payload) : ["1"]) : [horseNumber];

    ["participant-first-name", "participant-last-name", "participant-email", "participant-phone", "participant-date-of-birth", "riding-level", "membership-number", "membership-email"].forEach((field) => {
      payload[field] = String(formData.get(field) || "").trim();
    });

    horseNumbers.forEach((currentHorseNumber) => {
      payload[`horse-${currentHorseNumber}-name`] = String(formData.get(`horse-${currentHorseNumber}-name`) || "").trim();
      showClassSlugs.forEach((slug) => {
        payload[`horse-${currentHorseNumber}-class-${slug}`] = formData.has(`horse-${currentHorseNumber}-class-${slug}`);
      });
    });

    const membership = String(formData.get("aeora-membership") || "none");
    payload["aeora-membership"] = membership;
    payload["aeora-day-membership"] = membership === "day";
    payload["aeora-annual-membership"] = membership === "annual";
    payload["dinner-count"] = String(getFormNumber(formData, "dinner-count"));
    payload["camping-night-count"] = String(getFormNumber(formData, "camping-night-count"));
    payload["yard-count"] = String(getFormNumber(formData, "yard-count"));
    payload["camping-with-power"] = formData.has("camping-with-power");
    payload["camping-without-power"] = formData.has("camping-without-power");
    payload["show-date"] = showEntryForm.dataset.eventId;
    payload["calculated-total"] = calculateShowRegistrationTotal(payload, eventDetails);

    const status = showEntryForm.querySelector("[data-show-entry-edit-status]");

    try {
      await patchRegistrationPayload(registration.id, payload, { returning: "representation" });

      const updatedResultDetails = {
        participant_name: [payload["participant-first-name"], payload["participant-last-name"]].filter(Boolean).join(" ") || "Name not supplied",
        riding_class: payload["riding-level"] || null,
        updated_at: new Date().toISOString(),
      };
      await Promise.all(horseNumbers.flatMap((currentHorseNumber) => showClassSlugs.map((slug) => {
        const entryId = `${registration.id}:${currentHorseNumber}:${humanizeFieldName(slug)}`;
        return requestSupabase(`/rest/v1/show_results?event_id=eq.${encodeURIComponent(showEntryForm.dataset.eventId)}&entry_id=eq.${encodeURIComponent(entryId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            ...updatedResultDetails,
            horse_name: payload[`horse-${currentHorseNumber}-name`] || "Horse not supplied",
          }),
        }).catch(() => null);
      })));

      editingShowEntryId = null;
      closeModal();
      await loadRegistrations();
      showResults = await fetchShowResultsForEvent(showEntryForm.dataset.eventId);
      renderEventPage(adminRegistrations);
    } catch (error) {
      if (status) status.textContent = `Could not save show entry: ${error.message}`;
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
    await patchEvent(eventId, { type: updatedEvent.type, date: updatedEvent.date, title: updatedEvent.title, location: updatedEvent.location, description: updatedEvent.description, judge_name: updatedEvent.judge_name, event_settings: updatedEvent.event_settings });
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

function updateShowDayMembershipFee(form) {
  const dayMembershipInput = form?.querySelector("[name='aeora-membership'][value='day']");
  if (!dayMembershipInput) return;
  const hasYoungRiderClass = Boolean(form.querySelector("[name$='-class-young-rider']:checked"));
  const fee = hasYoungRiderClass ? youngRiderDayMembershipFee : dayMembershipFee;
  dayMembershipInput.dataset.price = String(fee);
  dayMembershipInput.closest("label")?.querySelector("strong")?.replaceChildren(formatCurrency(fee));
}

function updateShowTotals(form) {
  if (!form) return;

  updateShowDayMembershipFee(form);
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

const staticForms = document.querySelectorAll("form:not([data-admin-login]):not([data-event-admin-form]):not([data-club-settings-form]):not([data-obstacle-setup-form]):not([data-member-detail-form]):not([data-shop-item-form])");

function getFormType() {
  const pageName = window.location.pathname.split("/").pop() || "index.html";
  return registrationFormTypes[pageName] || registrationFormTypes[`${pageName}.html`] || "website_form";
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
    const event = getEvents().find((item) => item.id === payload["club-date"]);
    const isJuniorDayMember = isJuniorDayMembershipPayload(payload, event);
    const selectedClubDayFee = getClubDayBaseFeeForPayload(payload, event);
    const selectedDayMembershipFee = isJuniorDayMember
      ? Number(form.dataset.youngRiderDayMembershipFee || youngRiderDayMembershipFee)
      : Number(form.dataset.dayMembershipFee || dayMembershipFee);
    payload["calculated-total"] = selectedClubDayFee + (payload["club-day-day-membership"] === true ? selectedDayMembershipFee : 0);
  }
  if (form.matches("[data-annual-membership-form]")) {
    payload["horse-level"] = payload["horse-level"] === true ? "Green" : "";
    payload["calculated-total"] = getSelectedMembershipFee(form);
  }
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

function createClientUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
    (Number(character) ^ (window.crypto?.getRandomValues?.(new Uint8Array(1))[0] || Math.floor(Math.random() * 256)) & 15 >> Number(character) / 4).toString(16)
  );
}

async function sendRegistrationConfirmationEmail(registrationId, confirmationToken) {
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig || !registrationId || !confirmationToken) return null;

  const response = await fetch(`${supabaseConfig.url}/functions/v1/registration-confirmation`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ registrationId, confirmationToken }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function submitRegistrationForm(form) {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    throw new Error("Supabase is not configured for this page.");
  }

  const wantsRegistrationConfirmation = form.matches(".registration-form");
  const wantsMembershipConfirmation = form.matches("[data-annual-membership-form]");
  const registrationId = wantsRegistrationConfirmation ? createClientUuid() : null;
  const confirmationToken = wantsRegistrationConfirmation ? createClientUuid() : null;
  const submission = {
    ...(registrationId ? { id: registrationId } : {}),
    ...(confirmationToken ? { confirmation_token: confirmationToken } : {}),
    form_type: getFormType(),
    page_path: window.location.pathname,
    payload: getFormPayload(form),
  };

  if (wantsRegistrationConfirmation && submission.form_type !== "club_membership") {
    assertRegistrationEventIsOpen(submission.payload);
  }

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

  if (!wantsRegistrationConfirmation) return null;

  let confirmation = null;

  if (wantsMembershipConfirmation) {
    const email = submission.payload["club-email"];

    if (registrationId && email) {
      const confirmationRows = await requestSupabase("/rest/v1/rpc/lookup_membership_confirmation", {
        method: "POST",
        body: JSON.stringify({ registration_id: registrationId, member_email: email }),
      });

      confirmation = Array.isArray(confirmationRows) ? confirmationRows[0] : null;
    }
  }

  try {
    await sendRegistrationConfirmationEmail(registrationId, confirmationToken);
  } catch (error) {
    console.warn("Registration confirmation email could not be sent.", error);
  }

  return confirmation;
}

function loadMembershipConfirmationPage() {
  const numberElement = document.querySelector("[data-membership-confirmation-number]");
  const nameElement = document.querySelector("[data-membership-confirmation-name]");
  if (!numberElement) return;

  let confirmation = null;

  try {
    confirmation = JSON.parse(sessionStorage.getItem(membershipConfirmationStorageKey) || "null");
  } catch {
    confirmation = null;
  }

  if (confirmation?.membership_number) {
    numberElement.textContent = confirmation.membership_number;
    if (nameElement) {
      const name = [confirmation.first_name, confirmation.last_name].filter(Boolean).join(" ");
      nameElement.textContent = name
        ? `Thank you for joining SEORC, ${name}. Please save your membership number for future event registrations.`
        : "Thank you for joining SEORC. Please save your membership number for future event registrations.";
    }
    return;
  }

  numberElement.textContent = "Check your email or contact SEORC";
  if (nameElement) {
    nameElement.textContent = "Your membership form has been submitted, but the membership number could not be loaded on this page.";
  }
}

loadMembershipConfirmationPage();
loadShopFront();
loadShopAdmin();
loadShopOrders();

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
      const confirmation = await submitRegistrationForm(form);

      if (form.matches("[data-show-registration-form]")) {
        window.location.href = "show-registration-confirmation.html";
        return;
      }

      if (form.matches("[data-annual-membership-form]")) {
        if (confirmation?.membership_number) {
          sessionStorage.setItem(membershipConfirmationStorageKey, JSON.stringify(confirmation));
        } else {
          sessionStorage.removeItem(membershipConfirmationStorageKey);
        }
        window.location.href = "club-membership-confirmation.html";
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

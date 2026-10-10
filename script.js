const BUSINESS_NAME ="Ember & Pepper";
// International format, no plus sign or spaces.
const WHATSAPP_NUMBER = "2348086987293";
// Opening hours in Lagos time (24h): [open hour, close hour]
const HOURS = {
  0: [12, 21], // Sunday
  1: [11, 22], 2: [11, 22], 3: [11, 22], 4: [11, 22], 5: [11, 22],
  6: [11, 23] // Saturday
};

// -------- Helpers ----------- //
const naira = (n) => "₦" + n.toLocaleString("en-NG");
const $ = (sel) => document.querySelector(sel);

// The menu lives in index.html. Each <li class="menu-item"> carries its own //
// data-id, data-cat, data-name and data-price, so edit the menu there.
const ITEMS = Array.from(document.querySelectorAll(".menu-item")).map((li) => ({
  id: li.dataset.id,
  cat: li.dataset.cat,
  name: li.dataset.name,
  price: Number(li.dataset.price),
  el: li
}));
const byId = (id) => ITEMS.find((i) => i.id === id);

const cart = {} // id -> quantity
let activeCat = "All";

const dialog = $("#order-dialog");

// --------- Open / closed status (Lagos time) --------- //
function lagosNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "numeric", hour12: false
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { day: days.indexOf(get("weekday")), hour: Number(get("hour")) % 24 };
}

function hourLabel(h) {
  return ((h + 11) % 12 + 1) + (h >= 12 ? "pm" : "am");
}

function renderStatus() {
  const { day, hour } = lagosNow();
  const [open, close] = HOURS[day];
  const el = $("#status");
  el.classList.remove("is-open", "is-closed");
  if (hour >= open && hour < close) {
    el.textContent = "The grill is lit. Open until " + hourLabel(close) + ".";
    el.classList.add("is-open");
  } else if (hour < open) {
      el.textContent = "closed for now. We open at " + hourLabel(open) + " today.";
      el.classList.add("is-closed");
  } else {
    const [nextOpen] = HOURS[(day + 1) % 7];
    el.textContent = "Closed for tonight. We open at " + hourLabel(nextOpen) + " tomorrow.";
    el.classList.add("is-closed");
  }
}

// -------- Optional photos --------- //
// A figure marked data-optional disappears if its image fille is missing,
// so the page never shows a broken-image icon.
function setupOptionalPhotos() {
  document.querySelectorAll("figure[data-optional]").forEach((fig) => {
    const img = fig.querySelector("img");
    const drop = () => {
      const section = fig.closest(".gallery");
      fig.remove();
      if (section && !section.querySelector("figure")) section.remove();
    };
    if (img.complete && img.naturalWidth === 0) drop();
    else img.addEventListener("error", drop);
  });

  // Menu thumbnails: the row only makes room for a photo once it has loaded.
  ITEMS.forEach((item) => {
    const img = item.el.querySelector(".m-thumb");
    if (!img) return;
    const ok = () => item.el.classList.add("has-thumb");
    if (img.complete) {
      if (img.naturalWidth > 0) ok(); else img.remove();
    } else {
      img.addEventListener("load", ok);
      img.addEventListener("error", () => img.remove());
    }
  });
}

// --------- Menu tabs -------- //
function renderTabs() {
  const tabs = $("#tabs");
  const cats = ["All"].concat(Array.from(new Set(ITEMS.map((i) => i.cat))));
  tabs.innerHTML = "";
  cats.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.textContent = c;
    b.setAttribute("aria-pressed", String(c === activeCat));
    b.addEventListener("click", () => {
      activeCat = c;
      tabs.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
      ITEMS.forEach((i) => { i.el.hidden = !(activeCat === "All" || i.cat === activeCat); });
    });

    tabs.appendChild(b);
  });
}

// --------- Menu rows: Add button turns into a - 1 + counter -----------
function makeStepButton(label, text, onClick, extraClass) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "step" + (extraClass? " " + extraClass : "");
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.addEventListener("click", onClick);
  return b;
}

// Focus: "add" | "plus" | "minus" keeps keyboard focus where the person was tapping.
function renderAction(item, focus) {
  const box = item.el.querySelector(".m-action");
  const qty = cart[item.id] || 0;
  const stepper = box.querySelector(".stepper");

  // Same state as before: just update the number so screen readers announce it.
  if (qty > 0 && stepper) {
    stepper.querySelector(".qty").textContent = qty;
    return;
  }
  box.innerHTML = "";
  if (qty === 0) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-add";
    add.textContent = "Add";
    add.setAttribute("aria-label", "Add" + item.name + " to your order");
    add.addEventListener("click", () => changeQty(item.id, 1, "plus"));
    box.appendChild(add);
    if (focus) add.focus();
  } else {
    const wrap = document.createElement("span");
    wrap.className = "stepper";
    const minus = makeStepButton("Remove one " + item.name, "-", () => changeQty(item.id, -1, "minus"));
    const q = document.createElement("span");
    q.className = "qty";
    q.setAttribute("aria-live", "polite");
    q.textContent = qty;
    const plus = makeStepButton("Add one more " + item.name, "+", () => changeQty(item.id, 1, "plus"));
    wrap.append(minus, q, plus);
    box.appendChild(wrap);
    if (focus === "plus") plus.focus();
    if (focus === "minus") minus.focus();
  }
}

// -------- Cart -------- //
function changeQty(id, delta, menuFocus, cartFocus) {
  const next = (cart[id] || 0) + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = Math.min(next, 20);
  renderAction(byId(id), menuFocus);
  renderCart(cartFocus);
  renderBar();
  updateLink();
}

function cartTotal() {
  return Object.keys(cart).reduce((sum, id) => sum + byId(id).price * cart[id], 0);
}

function cartCount() {
  return Object.keys(cart).reduce((sum, id) => sum + cart[id], 0);
}

function renderCart(focusSel) {
  const box = $("#cart");
  const ids = Object.keys(cart);
  const form = $("#order-form");
  box.innerHTML = "";
  form.hidden = ids.length === 0;

  if (!ids.length) {
    const wrap = document.createElement("div");
    wrap.className = "empty";
    wrap.innerHTML = "<p>Your order is empty. Add a dish from the menu to start.<p>";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-small";
    b.textContent = "Browse the menu";
    b.addEventListener("click", () => {
      dialog.close();
      $("#menu").scrollIntoView({ behavior: "smooth" });
    });
    wrap.appendChild(b);
    box.appendChild(wrap);
  } else {
    const ul = document.createElement("ul");
    ul.className = "cart-list";
    ids.forEach((id) => {
      const m = byId(id);
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="c-name"></span>' +
        '<span class="stepper">' +
        '<button type="button" class="step" data-id="' + id + '" data-d="-1">-</button>' +
        '<span class="qty"></span>' +
        '<button type="button" class="step" data-id="' + id + '" data-d="1">+</button>' +
        '</span>' +
        '<span class="c-line"></span>';
      li.querySelector(".c-name").textContent = m.name;
      li.querySelector(".qty").textContent = cart[id];
      li.querySelector(".c-line").textContent = naira(m.price * cart[id]);
      const [minus, plus] = li.querySelectorAll(".step");
      minus.setAttribute("aria-label", "Remove one " + m.name);
      plus.setAttribute("aria-label", "Add one more " + m.name);
      minus.addEventListener("click", () => changeQty(id, -1, null, '[data-id="' + id + '"][data-d="-1"]'));
      plus.addEventListener("click", () => changeQty(id, 1, null, '[data-id="' + id + '"][data-d="1"]'));
      ul.appendChild(li);
    });
    box.appendChild(ul);

    const total = document.createElement("p");
    total.className = "total";
    total.innerHTML = "<span>Total</span><strong></strong>";
    total.querySelector("strong").textContent = naira(cartTotal());
    box.appendChild(total);
  }

  // Keep keyboard focus on the button that was just used (or the first one left).
  if (focusSel && dialog.open) {
    const target = box.querySelector(focusSel) || box.querySelector(".step") || $("#close-order");
    if (target) target.focus();
  }
}

function renderBar() {
  const count = cartCount();
  const bar = $("#order-bar");
  $("#open-order").textContent = count ? "order (" + count + ")" : "order";
  if (count) {
    $("#order-bar-text").textContent = count + (count === 1 ? " item, " : " items, ") + naira(cartTotal());
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

// --------- Order panel --------- //
function setupDialog() {
  const open = () => {
    $("#sent").hidden =true;
    renderCart();
    dialog.showModal();
  };
  $("#open-order").addEventListener("click", open);
  $("#order-bar").addEventListener("click", open);
  $("#close-order").addEventListener("click", () => dialog.close());
  // Tapping the dark area otside the panel closes it.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}

// --------- WhatsApp link --------- //
function formValues() {
  return {
    name: $("#name").value.trim(),
    mode:document.querySelector('input[name="mode"]:checked').value,
    address: $("#address").value.trim(),
    note: $("#note").value.trim()
  };
}

function buildMessage() {
  const v = formValues();
  const lines = Object.keys(cart).map((id) => {
    const m = byId(id);
    return "- " + cart[id] + " x " + m.name + " (" + naira(m.price * cart[id]) + ")";
  });
  return [
    "Hello " + BUSINESS_NAME + ", I'd like to order:",
    ...lines,
    "Total: " + naira(cartTotal()),
    "Name: " + (v.name || "(not given)"),
    v.mode === "delivery" ? "Delivery to: " + (v.address || "(not given)") : "Pickup",
    v.note ? "Note: " + v.note : ""
  ].filter(Boolean).join("\n");
}

// The send button is a real link, so it works in every browser without popups.
function updateLink() {
  $("#send-btn").href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(buildMessage());
}

function setupForm() {
  const form = $("#order-form");
  const addressField = $("#address-field");

  form.addEventListener("input", updateLink);
  form.addEventListener("submit", (e) => e.preventDefault());

  form.querySelectorAll('input[name="mode"]').forEach((r) => 
    r.addEventListener("change", () => {
      addressField.hidden = formValues().mode !== "delivery";
      $("#address-error").hidden = true;
      updateLink();
    })
  );
  $("#send-btn").addEventListener("click", (e) => {
    const v = formValues();
    const missingName = !v.name;
    const missingAddress = v.mode === "delivery" && !v.address;
    $("#name-error").hidden = !missingName;
    $("#address-error").hidden = !missingAddress;

    if (missingName || missingAddress || !cartCount()) {
      e.preventDefault();
      (missingName ? $("#name") : $("#address")).focus();
      return;
    }
    updateLink()
    $("#sent").hidden = false;
  });
}

// ------ Start -------- //
setupOptionalPhotos();
renderStatus();
renderTabs();
ITEMS.forEach((item) => renderAction(item)); // wires up each Add button
renderCart();
renderBar();
setupDialog();
setupForm();
updateLink();
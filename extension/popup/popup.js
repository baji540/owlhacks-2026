// extension/popup/popup.js (owner: Masnun)
// Shows the result for the email that is open in Gmail right now.
// content.js saves it as chrome.storage.local.lastScan
//   { score, subject, threatLabel, simpleExplanation, actionRecommendation }
// and sets it to null when you go back to the inbox.

const TITLES = {
  green: "This email looks safe",
  yellow: "Be careful with this email",
  red: "Warning: likely a scam",
};

function showScan(scan) {
  const status = document.getElementById("status");
  const title = document.getElementById("status-title");
  const text = document.getElementById("status-text");
  const actionBox = document.getElementById("action-box");
  const actionText = document.getElementById("action-text");

  if (!scan || !TITLES[scan.score]) {
    // No email open: back to the waiting state
    status.className = "status status-idle";
    title.textContent = "Open an email in Gmail";
    text.textContent = "Canary checks each email you open and tells you if it's safe.";
    actionBox.hidden = true;
    return;
  }

  status.className = `status status-${scan.score}`;
  title.textContent = TITLES[scan.score];
  text.textContent = scan.subject
    ? `"${scan.subject}": ${scan.simpleExplanation || ""}`
    : scan.simpleExplanation || "";

  if (scan.actionRecommendation && scan.score !== "green") {
    actionText.textContent = " " + scan.actionRecommendation;
    actionBox.hidden = false;
  } else {
    actionBox.hidden = true;
  }
}

function applyBigText(on) {
  document.body.classList.toggle("big", on);
}

document.addEventListener("DOMContentLoaded", async () => {
  const enabled = document.getElementById("enabled");
  const bigtext = document.getElementById("bigtext");

  const saved = await chrome.storage.local.get(["lastScan", "enabled", "bigText"]);
  enabled.checked = saved.enabled !== false;
  bigtext.checked = !!saved.bigText;
  applyBigText(bigtext.checked);
  showScan(saved.lastScan);

  enabled.addEventListener("change", () => chrome.storage.local.set({ enabled: enabled.checked }));
  bigtext.addEventListener("change", () => {
    chrome.storage.local.set({ bigText: bigtext.checked });
    applyBigText(bigtext.checked);
  });

  // Update live if a new email gets scanned while the popup is open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastScan) showScan(changes.lastScan.newValue);
  });
});

/* ------------------------------------------------------------------
 * Tabs
 * ------------------------------------------------------------------ */

function showTab(name) {
  const isContacts = name === "contacts";
  document.getElementById("tab-status").hidden = isContacts;
  document.getElementById("tab-contacts").hidden = !isContacts;
  document.getElementById("tab-btn-status").setAttribute("aria-selected", String(!isContacts));
  document.getElementById("tab-btn-contacts").setAttribute("aria-selected", String(isContacts));
}

/* ------------------------------------------------------------------
 * Trusted contacts
 * Stored in chrome.storage.sync (no server, no database): it survives
 * restarts and follows the user's Google account to their other computers.
 * Shape: [{ id, name, relation, email, enabled, red, yellow }]
 *   enabled = the on/off switch; red / yellow = which warnings offer them.
 * ui/banner.js reads the same list for the "Inform my guardian" picker.
 * ------------------------------------------------------------------ */

const CONTACTS_KEY = "trustedContacts";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const openDetails = new Set(); // which rows are expanded

async function getContacts() {
  const saved = await chrome.storage.sync.get(CONTACTS_KEY);
  return Array.isArray(saved[CONTACTS_KEY]) ? saved[CONTACTS_KEY] : [];
}

async function saveContacts(list) {
  await chrome.storage.sync.set({ [CONTACTS_KEY]: list });
  renderContacts(list);
}

async function updateContact(id, changes) {
  const all = await getContacts();
  await saveContacts(all.map((c) => (c.id === id ? { ...c, ...changes } : c)));
}

function initialOf(contact) {
  return (contact.name || contact.email || "?").trim().charAt(0).toUpperCase();
}

function testEmailUrl(contact) {
  const body = [
    `Hi ${contact.name || "there"},`,
    "",
    "I added you as a trusted contact in Canary, the email safety helper I use.",
    "If Canary warns me about a suspicious email, I may send it to you and ask you to take a look.",
    "",
    "This is just a test, nothing to do right now. Thank you!",
    "",
    "Sent with Canary (canary.fishing)",
  ].join("\n");
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: contact.email,
    su: "Canary: you're my trusted contact",
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function renderContacts(list) {
  const ul = document.getElementById("contact-list");
  const template = document.getElementById("contact-template");
  ul.replaceChildren();
  document.getElementById("contact-empty").hidden = list.length > 0;

  list.forEach((contact) => {
    const li = template.content.firstElementChild.cloneNode(true);
    const enabled = contact.enabled !== false;

    li.querySelector(".tc-avatar").textContent = initialOf(contact);
    li.querySelector(".tc-name").textContent = contact.name || contact.email;
    li.querySelector(".tc-rel").textContent = contact.relation || contact.email;
    li.querySelector(".tc-email").textContent = contact.email;

    // Tap the person to show their settings
    const main = li.querySelector(".tc-main");
    const details = li.querySelector(".tc-details");
    const isOpen = openDetails.has(contact.id);
    details.hidden = !isOpen;
    main.setAttribute("aria-expanded", String(isOpen));
    main.setAttribute("aria-label", `${contact.name || contact.email}: show settings`);
    main.addEventListener("click", () => {
      if (openDetails.has(contact.id)) openDetails.delete(contact.id);
      else openDetails.add(contact.id);
      details.hidden = !openDetails.has(contact.id);
      main.setAttribute("aria-expanded", String(!details.hidden));
    });

    // On/off switch
    const toggle = li.querySelector(".tc-switch");
    toggle.setAttribute("aria-checked", String(enabled));
    toggle.setAttribute("aria-label", `Offer ${contact.name || contact.email} as a guardian`);
    toggle.addEventListener("click", () => updateContact(contact.id, { enabled: !enabled }));

    const red = li.querySelector(".contact-red");
    const yellow = li.querySelector(".contact-yellow");
    red.checked = contact.red !== false;
    yellow.checked = contact.yellow !== false;
    red.addEventListener("change", () => updateContact(contact.id, { red: red.checked }));
    yellow.addEventListener("change", () => updateContact(contact.id, { yellow: yellow.checked }));

    li.querySelector(".contact-test").addEventListener("click", () => {
      chrome.tabs.create({ url: testEmailUrl(contact) });
    });
    li.querySelector(".contact-remove").addEventListener("click", async () => {
      openDetails.delete(contact.id);
      const all = await getContacts();
      await saveContacts(all.filter((c) => c.id !== contact.id));
    });

    ul.append(li);
  });
}

function setupContactForm() {
  const openBtn = document.getElementById("add-open");
  const cancelBtn = document.getElementById("add-cancel");
  const form = document.getElementById("contact-form");
  const nameInput = document.getElementById("contact-name");
  const relationInput = document.getElementById("contact-relation");
  const emailInput = document.getElementById("contact-email");
  const error = document.getElementById("contact-error");

  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
  };
  const showForm = (show) => {
    form.hidden = !show;
    openBtn.hidden = show;
    showError("");
    if (show) nameInput.focus();
    else form.reset();
  };

  openBtn.addEventListener("click", () => showForm(true));
  cancelBtn.addEventListener("click", () => showForm(false));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const relation = relationInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();

    if (!name) {
      showError("Please enter their name.");
      nameInput.focus();
      return;
    }
    if (!EMAIL_RE.test(email)) {
      showError("Please enter a full email address, like sarah@example.com.");
      emailInput.focus();
      return;
    }
    const all = await getContacts();
    if (all.some((c) => c.email === email)) {
      showError("That person is already on your list.");
      return;
    }

    const id = `c${Date.now().toString(36)}`;
    await saveContacts([...all, { id, name, relation, email, enabled: true, red: true, yellow: true }]);
    showForm(false);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Opened as a full tab (e.g. from "Add a trusted contact" in Gmail)
  if (window.innerWidth > 480) document.body.classList.add("in-tab");

  document.getElementById("tab-btn-status").addEventListener("click", () => showTab("status"));
  document.getElementById("tab-btn-contacts").addEventListener("click", () => showTab("contacts"));
  showTab(location.hash === "#contacts" ? "contacts" : "status");

  setupContactForm();
  const contacts = await getContacts();
  renderContacts(contacts);
  if (location.hash === "#contacts" && !contacts.length) document.getElementById("add-open").click();
});

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

const TABS = ["status", "contacts", "downloads"];

function showTab(name) {
  const active = TABS.includes(name) ? name : "status";
  TABS.forEach((tab) => {
    document.getElementById(`tab-${tab}`).hidden = tab !== active;
    document.getElementById(`tab-btn-${tab}`).setAttribute("aria-selected", String(tab === active));
  });
  if (active === "downloads") loadDownloads();
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

/* ------------------------------------------------------------------
 * Downloads
 * ui/links.js saves the open email's download links as
 * chrome.storage.local.openEmailLinks; background/link-scanner.js checks each
 * one (SCAN_LINK) with VirusTotal, Google Safe Browsing and quick checks.
 * ------------------------------------------------------------------ */

const PILL = { green: "Safe", yellow: "Caution", red: "Dangerous", unknown: "Not checked" };
const RANK = { unknown: 0, green: 1, yellow: 2, red: 3 };
const dlResults = new Map(); // url -> result
const dlOpen = new Set(); // expanded rows
let dlLinks = [];
let dlLoadedKey = null;

function dlDisplayName(link) {
  if (link.fileName) return link.fileName;
  if (link.text && !/^https?:/i.test(link.text)) return link.text;
  try {
    const u = new URL(link.url);
    const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    return last || u.hostname;
  } catch {
    return link.url;
  }
}

function dlHostLine(link) {
  const kind = { file: "File", share: "File-sharing link", download: "Download link" }[link.kind] || "Link";
  return `${kind} from ${link.host}`;
}

function updateDownloadCount() {
  const badge = document.getElementById("dl-count");
  if (!dlLinks.length) {
    badge.hidden = true;
    return;
  }
  const worst = dlLinks.reduce((w, l) => {
    const r = dlResults.get(l.url)?.rating || "unknown";
    return RANK[r] > RANK[w] ? r : w;
  }, "unknown");
  badge.hidden = false;
  badge.textContent = String(dlLinks.length);
  badge.className = `tab-count${worst === "red" ? " is-red" : worst === "yellow" ? " is-yellow" : ""}`;
  badge.setAttribute("aria-label", `${dlLinks.length} download link${dlLinks.length === 1 ? "" : "s"}`);
}

function renderDownloadRow(li, link) {
  const result = dlResults.get(link.url);
  const checking = !result;
  const rating = result ? result.rating : "unknown";
  li.className = `dl-row is-${checking ? "checking" : rating}`;
  li.querySelector(".dl-pill").textContent = checking ? "Checking…" : PILL[rating];

  const details = li.querySelector(".dl-details");
  const main = li.querySelector(".dl-main");
  const open = dlOpen.has(link.url);
  details.hidden = !open;
  main.setAttribute("aria-expanded", String(open));
  main.setAttribute("aria-label", `${dlDisplayName(link)}: ${checking ? "checking" : PILL[rating]}. Show details`);

  li.querySelector(".dl-headline").textContent = checking ? "Checking this link…" : result.headline;
  li.querySelector(".dl-advice").textContent = checking
    ? "Canary is asking the security scanners about this link."
    : result.error || result.advice;
  li.querySelector(".dl-url").textContent = link.url;

  const list = li.querySelector(".dl-sources");
  list.replaceChildren();
  (result?.sources || []).forEach((s) => {
    const item = document.createElement("li");
    const dot = document.createElement("span");
    const flagClass = s.status === "flag" ? `is-flag-${s.rating === "red" ? "red" : "yellow"}` : s.status === "clear" ? "is-clear" : "";
    dot.className = `dl-dot ${flagClass}`;
    const text = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = `${s.name}: `;
    text.append(name, document.createTextNode(s.detail));
    item.append(dot, text);
    list.append(item);
  });
}

function renderDownloads(state) {
  const list = document.getElementById("dl-list");
  const empty = document.getElementById("dl-empty");
  const sub = document.getElementById("dl-sub");
  const foot = document.getElementById("dl-foot");
  const template = document.getElementById("download-template");

  list.replaceChildren();
  if (!state) {
    sub.textContent = "Open an email in Gmail to check its download links.";
    empty.textContent = "No email open yet.";
    empty.hidden = false;
    foot.hidden = true;
    return;
  }
  sub.textContent = state.subject ? `From "${state.subject}"` : "From the open email";
  empty.textContent = "This email has no download links.";
  empty.hidden = dlLinks.length > 0;
  foot.hidden = dlLinks.length === 0;

  dlLinks.forEach((link) => {
    const li = template.content.firstElementChild.cloneNode(true);
    li.dataset.url = link.url;
    li.querySelector(".dl-name").textContent = dlDisplayName(link);
    li.querySelector(".dl-host").textContent = dlHostLine(link);
    li.querySelector(".dl-main").addEventListener("click", () => {
      if (dlOpen.has(link.url)) dlOpen.delete(link.url);
      else dlOpen.add(link.url);
      renderDownloadRow(li, link);
    });
    renderDownloadRow(li, link);
    list.append(li);
  });
  updateDownloadCount();
}

async function scanDownloadLink(link, force = false) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SCAN_LINK",
      payload: { url: link.url, fileName: link.fileName, force },
    });
    if (response && response.ok) {
      dlResults.set(link.url, response.payload);
    } else {
      dlResults.set(link.url, {
        rating: "unknown",
        headline: "Could not check this link",
        advice: response?.error?.message || "Canary could not reach its scanner. Try again.",
        sources: [],
      });
    }
  } catch {
    dlResults.set(link.url, {
      rating: "unknown",
      headline: "Could not check this link",
      advice: "Canary could not reach its scanner. Try again.",
      sources: [],
    });
  }
  const li = document.querySelector(`.dl-row[data-url="${CSS.escape(link.url)}"]`);
  if (li) renderDownloadRow(li, link);
  updateDownloadCount();
}

async function loadDownloads(force = false) {
  let state = null;
  try {
    state = (await chrome.storage.local.get("openEmailLinks")).openEmailLinks || null;
  } catch {
    state = null;
  }
  const key = state ? `${state.subject}|${(state.links || []).map((l) => l.url).join(",")}` : "";
  if (key === dlLoadedKey && !force) {
    updateDownloadCount();
    return;
  }
  dlLoadedKey = key;
  dlLinks = state ? state.links || [] : [];
  if (force) dlLinks.forEach((l) => dlResults.delete(l.url));
  renderDownloads(state);
  dlLinks.filter((l) => !dlResults.has(l.url)).forEach((l) => scanDownloadLink(l, force));
}

async function setupDownloads() {
  document.getElementById("dl-rescan").addEventListener("click", () => loadDownloads(true));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.openEmailLinks) loadDownloads();
  });

  // Say which online scanners are switched on
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_SCANNER_STATUS", payload: {} });
    const on = res && res.ok ? res.payload : null;
    if (on) {
      const names = [
        on.virusTotal && "VirusTotal",
        on.safeBrowsing && "Google Safe Browsing",
      ].filter(Boolean);
      document.getElementById("dl-note").textContent = names.length
        ? `Each link is checked with ${names.join(", ").replace(/, ([^,]*)$/, " and $1")}, plus Canary's own quick checks. Canary looks at the link; it never downloads the file.`
        : "Online scanners are not set up yet, so only Canary's quick checks run. Add API keys in extension/config/keys.js.";
    }
  } catch {
    /* keep the default note */
  }
  loadDownloads();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Opened as a full tab (e.g. from "Add a trusted contact" in Gmail)
  if (window.innerWidth > 480) document.body.classList.add("in-tab");

  document.getElementById("tab-btn-status").addEventListener("click", () => showTab("status"));
  document.getElementById("tab-btn-contacts").addEventListener("click", () => showTab("contacts"));
  document.getElementById("tab-btn-downloads").addEventListener("click", () => showTab("downloads"));
  setupDownloads();
  // Opened from canary.fishing's "Add trusted contact" button?
  let intent = null;
  try {
    intent = (await chrome.storage.local.get("popupIntent")).popupIntent || null;
    if (intent) await chrome.storage.local.remove("popupIntent");
  } catch {
    /* ignore */
  }
  const wantsAdd = intent === "add-contact" || location.hash === "#add-contact";
  const hashTab = location.hash.replace("#", "");
  showTab(wantsAdd || hashTab === "contacts" ? "contacts" : hashTab === "downloads" ? "downloads" : "status");

  setupContactForm();
  const contacts = await getContacts();
  renderContacts(contacts);
  if (wantsAdd || (location.hash === "#contacts" && !contacts.length)) {
    document.getElementById("add-open").click();
  }
});

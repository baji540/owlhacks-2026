// extension/ui/banner.js (owner: Masnun)
// Renders the Canary explanation card inside Gmail.
//
// Called by Ari's content.js when a badge is clicked:
//   window.renderWarningBanner(badgeElement, verdict)
// verdict follows shared/messages.md (EMAIL_ANALYSIS_RESULT payload):
//   { score: "green"|"yellow"|"red", threatLabel, simpleExplanation, actionRecommendation, ... }
//
// Placement:
//   - badge inside an opened email's subject (h2.hP) -> full-width card under the subject line
//   - badge inside an inbox row (tr.zA)               -> small card floating next to the badge
//   - any other element (e.g. preview.html)           -> card prepended inside that element
// The card is never placed inside the badge itself, otherwise clicks on "Hide" would
// bubble up to the badge and immediately reopen it.
//
// All text goes in through textContent (never innerHTML): the explanation can contain
// words copied from the email, and a scam email must not be able to inject markup.

(function () {
  const LEVELS = {
    green: { title: "This email looks safe", label: "Safe" },
    yellow: { title: "Be careful with this email", label: "Caution" },
    red: { title: "Warning: this email looks like a scam", label: "Scam alert" },
  };

  let openCard = null; // { card, anchor, cleanup }

  // Plain, human punctuation: turn "fast — it uses" into "fast, it uses".
  function tidy(text) {
    return String(text || "")
      .replace(/\s*—\s*/g, ", ")
      .replace(/\s+–\s+/g, ", ")
      .replace(/,\s*,/g, ",");
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = tidy(text);
    return node;
  }

  function closeCard() {
    if (!openCard) return;
    const { card, anchor, cleanup } = openCard;
    openCard = null;
    cleanup.forEach((fn) => fn());
    card.remove();
    if (anchor && anchor.isConnected) {
      anchor.setAttribute("aria-expanded", "false");
    }
  }

  // Keep Gmail from treating clicks on the card as clicks on the email row underneath.
  function shield(node) {
    ["click", "mousedown", "mouseup", "pointerdown"].forEach((type) =>
      node.addEventListener(type, (event) => event.stopPropagation())
    );
  }

  function buildCard(data, floating) {
    const score = LEVELS[data.score] ? data.score : "yellow";
    const level = LEVELS[score];

    const card = el("div", `canary-banner canary-banner-${score}${floating ? " canary-banner-floating" : ""}`);
    card.setAttribute("role", score === "red" ? "alert" : "status");

    const icon = el("div", "canary-banner-icon");
    icon.setAttribute("aria-hidden", "true");

    const body = el("div", "canary-banner-body");
    body.append(el("div", "canary-banner-tag", `Canary · ${level.label}`));
    body.append(el("div", "canary-banner-title", level.title));
    if (data.threatLabel && score !== "green") {
      body.append(el("div", "canary-banner-reason", data.threatLabel));
    }
    if (data.simpleExplanation) {
      body.append(el("p", "canary-banner-explain", data.simpleExplanation));
    }
    if (data.actionRecommendation && score !== "green") {
      const action = el("p", "canary-banner-action");
      action.append(el("strong", null, "What to do: "));
      action.append(document.createTextNode(tidy(data.actionRecommendation)));
      body.append(action);
    }
    if (score !== "green") {
      body.append(buildGuardianButton(score, data));
    }

    const close = el("button", "canary-banner-close", "Hide");
    close.type = "button";
    close.setAttribute("aria-label", "Hide this Canary message");
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const anchor = openCard && openCard.anchor;
      closeCard();
      if (anchor && anchor.isConnected && anchor.focus) anchor.focus();
    });

    card.append(icon, body, close);
    shield(card);
    return card;
  }

  /* ------------------------------------------------------------------
   * "Send to my guardian"
   * Opens a Gmail message to the user's trusted contacts, already written.
   * The user checks it and presses Gmail's own Send button, so nothing is
   * ever sent without them. Contacts live in chrome.storage.sync, managed in
   * the popup's "Trusted contacts" tab.
   * ------------------------------------------------------------------ */

  const CONTACTS_KEY = "trustedContacts";

  async function loadContacts() {
    try {
      const saved = await chrome.storage.sync.get(CONTACTS_KEY);
      return Array.isArray(saved[CONTACTS_KEY]) ? saved[CONTACTS_KEY] : [];
    } catch {
      return [];
    }
  }

  const wantsLevel = (contact, score) => (score === "red" ? contact.red !== false : contact.yellow !== false);

  // Who the flagged email says it is from, and its subject, read from what is on screen.
  function emailContext() {
    const anchor = openCard && openCard.anchor;
    const row = anchor && anchor.closest ? anchor.closest("tr.zA") : null;
    const scope = row || document.querySelector('div[role="main"]') || document;
    const subjectEl = row ? row.querySelector(".bog") : scope.querySelector("h2.hP");
    let subject = "";
    if (subjectEl) {
      const copy = subjectEl.cloneNode(true);
      copy.querySelectorAll(".canary-badge").forEach((b) => b.remove());
      subject = copy.textContent.replace(/\s+/g, " ").trim();
    }
    const senders = scope.querySelectorAll(row ? "span[email]" : "span.gD[email]");
    const senderEl = senders[senders.length - 1];
    let sender = "";
    if (senderEl) {
      const name = (senderEl.getAttribute("name") || senderEl.textContent || "").trim();
      const email = (senderEl.getAttribute("email") || "").trim();
      sender = name && email && name !== email ? `${name} <${email}>` : email || name;
    }
    return { subject, sender };
  }

  function composeUrl(to, subject, body) {
    // Keep the user in the same Gmail account they are reading (…/mail/u/1/ etc.)
    const account = (location.pathname.match(/\/mail\/u\/(\d+)/) || [])[1];
    const base = `https://mail.google.com/mail/${account ? `u/${account}/` : ""}`;
    const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
    return `${base}?${params.toString()}`;
  }

  function guardianMessage(score, data, contacts) {
    const { subject, sender } = emailContext();
    const names = contacts.map((c) => c.name).filter(Boolean);
    const greeting = !names.length
      ? "Hi,"
      : names.length === 1
        ? `Hi ${names[0]},`
        : `Hi ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]},`;
    const what = score === "red" ? "a likely scam" : "suspicious";
    const lines = [
      greeting,
      "",
      `Canary flagged an email I received as ${what}.`,
      "",
      sender ? `From: ${sender}` : null,
      subject ? `Subject: ${subject}` : null,
      data.threatLabel ? `Warning: ${tidy(data.threatLabel)}` : null,
      data.simpleExplanation ? `Why: ${tidy(data.simpleExplanation)}` : null,
      "",
      "Can you check this with me before I do anything?",
      "",
      "Sent with Canary (canary.fishing)",
    ].filter((line) => line !== null);
    const subjectLine =
      score === "red" ? "Canary alert: I got a likely scam email" : "Canary alert: I got a suspicious email";
    return { subjectLine, body: lines.join("\n") };
  }

  function openContactsPage() {
    window.open(chrome.runtime.getURL("popup/popup.html#contacts"), "_blank", "noopener");
  }

  const eligible = (all, score) =>
    all.filter((c) => c.email && c.enabled !== false && wantsLevel(c, score));

  function guardianRow(contact, checked) {
    const row = el("label", "canary-guardian-row");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "canary-guardian-check";
    box.value = contact.email;
    box.checked = checked;
    const avatar = el("span", "canary-guardian-avatar", (contact.name || contact.email).trim().charAt(0).toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    const who = el("span", "canary-guardian-who");
    who.append(el("span", "canary-guardian-name", contact.name || contact.email));
    who.append(el("span", "canary-guardian-rel", contact.relation || contact.email));
    row.append(box, avatar, who);
    return row;
  }

  function buildGuardianButton(score, data) {
    const wrap = el("div", "canary-banner-guardian");
    const button = el("button", "canary-banner-guardian-btn", "Inform my guardian");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    const hint = el("div", "canary-banner-guardian-hint", "Pick who to ask. Gmail opens an email you can check, then press Send.");
    const picker = el("div", "canary-guardian-picker");
    picker.hidden = true;
    wrap.append(button, hint, picker);

    let contacts = [];
    loadContacts().then((all) => {
      contacts = eligible(all, score);
      if (!contacts.length) {
        button.textContent = "Add a trusted contact";
        hint.textContent = "Choose someone Canary can help you ask for a second opinion.";
      }
    });

    function closePicker() {
      picker.hidden = true;
      picker.replaceChildren();
      button.hidden = false;
      hint.hidden = false;
      button.setAttribute("aria-expanded", "false");
      button.focus();
    }

    function openPicker() {
      picker.replaceChildren();
      picker.append(el("div", "canary-guardian-title", "Who should I ask?"));
      const list = el("div", "canary-guardian-list");
      contacts.forEach((contact, i) => list.append(guardianRow(contact, i === 0)));
      picker.append(list);

      const error = el("div", "canary-guardian-error");
      error.hidden = true;
      const actions = el("div", "canary-guardian-actions");
      const send = el("button", "canary-guardian-send", "Write email");
      send.type = "button";
      const cancel = el("button", "canary-guardian-cancel", "Cancel");
      cancel.type = "button";
      actions.append(send, cancel);
      picker.append(error, actions);

      send.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const chosenEmails = Array.from(picker.querySelectorAll(".canary-guardian-check:checked")).map((b) => b.value);
        const chosen = contacts.filter((c) => chosenEmails.includes(c.email));
        if (!chosen.length) {
          error.textContent = "Tick at least one person.";
          error.hidden = false;
          return;
        }
        const { subjectLine, body } = guardianMessage(score, data, chosen);
        const url = composeUrl(chosen.map((c) => c.email).join(","), subjectLine, body);
        window.open(url, "canary-guardian", "popup,width=720,height=680");
        closePicker();
      });
      cancel.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePicker();
      });

      button.hidden = true;
      hint.hidden = true;
      picker.hidden = false;
      button.setAttribute("aria-expanded", "true");
      const first = picker.querySelector(".canary-guardian-check");
      if (first) first.focus();
    }

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      contacts = eligible(await loadContacts(), score);
      if (!contacts.length) {
        openContactsPage();
        return;
      }
      openPicker();
    });
    return wrap;
  }

  function positionFloating(card, anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(460, window.innerWidth - 24);
    let left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    card.style.width = `${width}px`;
    card.style.left = `${left}px`;

    // Below the badge if there is room, otherwise above it.
    const below = rect.bottom + 8;
    card.style.maxHeight = `${window.innerHeight - 24}px`;
    const cardHeight = card.offsetHeight || 220;
    if (below + cardHeight > window.innerHeight - 12 && rect.top - cardHeight - 8 > 12) {
      card.style.top = `${rect.top - cardHeight - 8}px`;
    } else {
      card.style.top = `${below}px`;
      card.style.maxHeight = `${Math.max(160, window.innerHeight - below - 12)}px`;
    }
  }

  function renderWarningBanner(target, data) {
    if (!target || !data) return null;

    // Clicking the same badge again toggles the card closed.
    if (openCard && openCard.anchor === target) {
      closeCard();
      return null;
    }
    closeCard();

    const isBadge = target.classList && target.classList.contains("canary-badge");
    const subject = isBadge ? target.closest("h2.hP") : null;
    const row = isBadge && !subject ? target.closest("tr.zA") : null;
    const cleanup = [];
    let card;

    if (subject) {
      // Opened email: full-width card directly under the subject line.
      card = buildCard(data, false);
      const header = subject.closest(".ha") || subject.parentElement;
      header.insertAdjacentElement("afterend", card);
    } else if (row || isBadge) {
      // Inbox list: floating card next to the badge, attached to <body> so it is not
      // clipped by Gmail's table and does not open the email when clicked.
      card = buildCard(data, true);
      document.body.appendChild(card);
      positionFloating(card, target);

      const onOutside = (event) => {
        if (!card.contains(event.target) && !target.contains(event.target)) closeCard();
      };
      const onKey = (event) => {
        if (event.key === "Escape") closeCard();
      };
      const onScroll = () => closeCard();
      // Defer so the click that opened the card doesn't immediately close it.
      setTimeout(() => document.addEventListener("mousedown", onOutside, true), 0);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      cleanup.push(
        () => document.removeEventListener("mousedown", onOutside, true),
        () => document.removeEventListener("keydown", onKey, true),
        () => window.removeEventListener("scroll", onScroll, true),
        () => window.removeEventListener("resize", onScroll)
      );
    } else {
      // Plain container (preview page, or any future caller).
      card = buildCard(data, false);
      target.prepend(card);
    }

    // Opened email view is replaced by Gmail when you navigate; drop our reference then.
    if (subject) {
      const watcher = new MutationObserver(() => {
        if (!target.isConnected) closeCard();
      });
      watcher.observe(document.body, { childList: true, subtree: true });
      cleanup.push(() => watcher.disconnect());
    }

    if (isBadge) target.setAttribute("aria-expanded", "true");
    openCard = { card, anchor: target, cleanup };
    return card;
  }


  /* ------------------------------------------------------------------
   * 1. Yellow and red open by themselves when you open that email.
   *    We "click" Ari's badge for the reader, so his code hands us the full verdict.
   *    Each email pops up once per page load; after Hide it stays hidden.
   * 2. Green birds are clickable too. Ari's green badge has no click handler,
   *    so we build a short "looks safe" card from what is on screen.
   * 3. Badge tooltips get the same punctuation clean-up as the card.
   * ------------------------------------------------------------------ */

  const autoOpened = new Set();

  function emailKey(badge) {
    const subject = badge.closest("h2.hP");
    return subject ? tidy(subject.textContent) + "|" + (badge.dataset.canaryBadge || "") : null;
  }

  function senderDomain(badge) {
    const scope = badge.closest("tr.zA") || document.querySelector('div[role="main"]') || document;
    const holder = scope.querySelector("span.gD[email], span[email]");
    const email = holder ? holder.getAttribute("email") || "" : "";
    return email.includes("@") ? email.split("@").pop().toLowerCase() : "";
  }

  function openGreen(badge) {
    const domain = senderDomain(badge);
    renderWarningBanner(badge, {
      score: "green",
      simpleExplanation:
        "Canary checked who sent this" + (domain ? " (" + domain + ")" : "") +
        ", the wording, and every link, and found nothing dangerous.",
    });
  }

  const isGreenBadge = (node) =>
    node && node.closest && node.closest(".canary-badge.canary-green");

  // Capture phase on window runs before Gmail's own handlers, so clicking a green
  // bird in the inbox list shows the card instead of opening the email.
  ["mousedown", "pointerdown", "mouseup"].forEach((type) =>
    window.addEventListener(type, (event) => {
      if (isGreenBadge(event.target)) event.stopPropagation();
    }, true)
  );
  window.addEventListener("click", (event) => {
    const badge = isGreenBadge(event.target);
    if (!badge) return;
    event.preventDefault();
    event.stopPropagation();
    openGreen(badge);
  }, true);
  window.addEventListener("keydown", (event) => {
    const badge = isGreenBadge(event.target);
    if (!badge || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.stopPropagation();
    openGreen(badge);
  }, true);

  function tidyBadges() {
    document.querySelectorAll(".canary-badge").forEach((badge) => {
      if (badge.title && /[–—]/.test(badge.title)) badge.title = tidy(badge.title);
      if (badge.classList.contains("canary-green") && badge.tabIndex !== 0) {
        badge.tabIndex = 0;
        badge.setAttribute("role", "button");
        badge.setAttribute("aria-label", "Safe. Show why Canary thinks this email is safe.");
      }
    });

    const flagged = document.querySelector(
      "h2.hP .canary-badge.canary-red, h2.hP .canary-badge.canary-yellow"
    );
    if (!flagged) return;
    const key = emailKey(flagged);
    if (!key || autoOpened.has(key)) return;
    autoOpened.add(key);
    if (!(openCard && openCard.anchor === flagged)) flagged.click();
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      tidyBadges();
    }, 150);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.renderWarningBanner = renderWarningBanner;
})();

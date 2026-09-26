// extension/ui/banner.js — owner: Masnun
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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
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
      action.append(document.createTextNode(data.actionRecommendation));
      body.append(action);
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

  window.renderWarningBanner = renderWarningBanner;
})();

// extension/ui/banner.js  — owner: Masnun
// Renders the Canary warning banner inside Gmail.
// Called by Ari's content.js:  window.renderWarningBanner(targetElement, data)
//
// data = {
//   score: "green" | "yellow" | "red",
//   simpleExplanation: "This message is pretending to be your bank...",
//   actionRecommendation: "Do not click any links. Delete this email."
// }
//
// NOTE: text is inserted with textContent (never innerHTML) because the
// explanation may contain words copied from the email — a scam email could
// otherwise inject its own HTML into our banner.

(function () {
  const LEVELS = {
    green: { icon: "✓", title: "This email looks safe", label: "Safe" },
    yellow: { icon: "!", title: "Be careful with this email", label: "Suspicious" },
    red: { icon: "✕", title: "Warning: this email looks like a scam", label: "Dangerous" },
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderWarningBanner(targetElement, data) {
    if (!targetElement || !data) return null;

    const score = LEVELS[data.score] ? data.score : "yellow";
    const level = LEVELS[score];

    // Only one banner per email view
    const existing = targetElement.querySelector(":scope > .canary-banner");
    if (existing) existing.remove();

    const banner = el("div", `canary-banner canary-${score}`);
    banner.setAttribute("role", score === "red" ? "alert" : "status");
    banner.setAttribute("aria-live", score === "red" ? "assertive" : "polite");

    const icon = el("div", "canary-icon", level.icon);
    icon.setAttribute("aria-hidden", "true");

    const body = el("div", "canary-body");
    body.append(el("div", "canary-tag", `Canary · ${level.label}`));
    body.append(el("h2", "canary-title", level.title));
    if (data.simpleExplanation) body.append(el("p", "canary-explain", data.simpleExplanation));
    if (data.actionRecommendation && score !== "green") {
      const action = el("p", "canary-action");
      action.append(el("strong", null, "What to do: "));
      action.append(document.createTextNode(data.actionRecommendation));
      body.append(action);
    }

    const close = el("button", "canary-close", "Hide");
    close.type = "button";
    close.setAttribute("aria-label", "Hide this Canary message");
    close.addEventListener("click", () => banner.remove());

    banner.append(icon, body, close);
    targetElement.prepend(banner);
    return banner;
  }

  window.renderWarningBanner = renderWarningBanner;
})();

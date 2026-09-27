// extension/site/site-bridge.js (owner: Masnun)
// Runs only on canary.fishing (and the local dev site). Lets the website's
// "Add trusted contact" button open the Canary popup on its add-contact form,
// so contacts are always added through the extension and saved in Chrome.
//
// Website -> extension:  window.postMessage({ source: "canary-site", type: "OPEN_ADD_CONTACT" }, location.origin)
// Extension -> website:  window.postMessage({ source: "canary-extension", type: "OPEN_ADD_CONTACT_RESULT", ok }, location.origin)
// The site can check document.documentElement.dataset.canaryExtension === "installed".

(() => {
  // Mark the page as soon as it exists (this script can run before <html> is built).
  function markInstalled() {
    if (!document.documentElement) return false;
    document.documentElement.dataset.canaryExtension = "installed";
    window.dispatchEvent(new CustomEvent("canary-extension-ready"));
    return true;
  }
  if (!markInstalled()) {
    const waiter = new MutationObserver(() => {
      if (markInstalled()) waiter.disconnect();
    });
    waiter.observe(document, { childList: true });
    document.addEventListener("DOMContentLoaded", markInstalled, { once: true });
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== "canary-site" || data.type !== "OPEN_ADD_CONTACT") return;

    let ok = false;
    try {
      const response = await chrome.runtime.sendMessage({ type: "OPEN_ADD_CONTACT", payload: {} });
      ok = Boolean(response && response.ok);
    } catch {
      ok = false;
    }
    window.postMessage({ source: "canary-extension", type: "OPEN_ADD_CONTACT_RESULT", ok }, location.origin);
  });
})();

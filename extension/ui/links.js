// extension/ui/links.js (owner: Masnun)
// Finds download links in the email that is open in Gmail and saves them for
// the popup's Downloads tab (chrome.storage.local.openEmailLinks):
//   { subject, links: [{ url, text, fileName, host, kind }], at }
// Set to null when no email is open. The popup asks background/link-scanner.js
// to check each link.

(() => {
  if (window.__canaryLinksActive) return;
  window.__canaryLinksActive = true;

  // File types people get tricked into opening
  const FILE_EXT =
    /\.(exe|msi|msix|bat|cmd|com|scr|pif|cpl|js|jse|vbs|vbe|wsf|hta|ps1|lnk|jar|apk|dmg|pkg|app|iso|img|vhd|zip|rar|7z|gz|tgz|tar|cab|ace|pdf|doc|docx|docm|dot|xls|xlsx|xlsm|xlsb|ppt|pptx|pptm|rtf|odt|one|html?|svg)$/i;

  // File-sharing sites where the link itself is the download
  const SHARE_HOSTS = [
    "drive.google.com",
    "docs.google.com",
    "drive.usercontent.google.com",
    "dropbox.com",
    "dl.dropboxusercontent.com",
    "onedrive.live.com",
    "1drv.ms",
    "sharepoint.com",
    "mega.nz",
    "wetransfer.com",
    "we.tl",
    "mediafire.com",
    "box.com",
    "sendspace.com",
    "files.fm",
    "gofile.io",
    "transfer.sh",
    "anonfiles.com",
  ];

  const MAX_LINKS = 25;

  // Gmail wraps outbound links: https://www.google.com/url?q=<real url>&...
  function realUrl(href) {
    try {
      const u = new URL(href, location.href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") {
        const target = u.searchParams.get("q") || u.searchParams.get("url");
        if (target) return new URL(target).href;
      }
      return u.href;
    } catch {
      return null;
    }
  }

  const onShareHost = (host) => SHARE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

  function classify(url, text) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(u.protocol)) return null;
    // Gmail's own UI links are never the email's content
    if (/(^|\.)mail\.google\.com$/.test(u.hostname)) return null;

    const lastSegment = decodeURIComponent(u.pathname.split("/").pop() || "");
    const fileName = FILE_EXT.test(lastSegment) ? lastSegment : "";
    const saysDownload = /\bdownload\b/i.test(text) || /download|attachment|dl=1/i.test(u.pathname + u.search);

    let kind = null;
    if (fileName) kind = "file";
    else if (onShareHost(u.hostname)) kind = "share";
    else if (saysDownload) kind = "download";
    if (!kind) return null;

    return { url: u.href, text: text.slice(0, 120), fileName, host: u.hostname, kind };
  }

  function collect() {
    const main = document.querySelector('div[role="main"]');
    const subjectEl = main && main.querySelector("h2.hP");
    if (!subjectEl) return null;

    const copy = subjectEl.cloneNode(true);
    copy.querySelectorAll(".canary-badge").forEach((b) => b.remove());
    const subject = copy.textContent.replace(/\s+/g, " ").trim();

    const seen = new Set();
    const links = [];
    main.querySelectorAll("div.a3s a[href]").forEach((a) => {
      if (links.length >= MAX_LINKS) return;
      const url = realUrl(a.getAttribute("href"));
      if (!url || seen.has(url)) return;
      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      const link = classify(url, text);
      if (!link) return;
      seen.add(url);
      links.push(link);
    });
    return { subject, links };
  }

  let lastKey = null;
  function publish() {
    const found = collect();
    const key = found ? `${found.subject}|${found.links.map((l) => l.url).join(",")}` : "";
    if (key === lastKey) return;
    lastKey = key;
    try {
      chrome.storage.local.set({ openEmailLinks: found ? { ...found, at: Date.now() } : null });
    } catch {
      /* extension was reloaded; this old copy of the script can stop */
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      publish();
    }, 400);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", publish);
  publish();

  // Exposed for testing
  window.__canaryClassifyLink = classify;
})();

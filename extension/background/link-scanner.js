/* extension/background/link-scanner.js (owner: Masnun)
 *
 * Checks download links from the open email and returns one safety result.
 * Loaded by background.js with importScripts, so it runs in the service worker.
 *
 * Sources (each one is optional; missing keys are skipped):
 *   - Quick checks built in (no key): risky file types, disguised names, raw IP hosts
 *   - Google Safe Browsing v4: known malware / phishing sites   needs keys.safeBrowsing
 *   - VirusTotal v3: 70+ security vendors' verdicts on the URL  needs keys.virusTotal
 *
 * Keys come from extension/config/keys.js (git-ignored, see keys.example.js).
 *
 * Message contract (see shared/messages.md):
 *   { type: "SCAN_LINK", payload: { url, fileName? } }
 *   -> { ok, type: "LINK_SCAN_RESULT", payload: { url, rating, headline, advice, sources[], checkedAt, cached } }
 *   rating: "green" | "yellow" | "red" | "unknown"
 */

const LINK_KEYS = (self.CANARY_KEYS && typeof self.CANARY_KEYS === "object" ? self.CANARY_KEYS : {});
const LINK_CACHE_KEY = "linkScanCache";
const LINK_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LINK_CACHE_LIMIT = 200;
const RANK = { unknown: 0, green: 1, yellow: 2, red: 3 };

/* ------------------------------------------------------------------ *
 * Quick checks (always run, no network)
 * ------------------------------------------------------------------ */

const PROGRAM_EXT = /\.(exe|msi|msix|scr|bat|cmd|com|pif|cpl|js|jse|vbs|vbe|wsf|hta|ps1|lnk|jar|apk|app|dmg|pkg)$/i;
const DISK_EXT = /\.(iso|img|vhd)$/i;
const MACRO_EXT = /\.(docm|xlsm|xlsb|pptm|dotm)$/i;
const WEBPAGE_EXT = /\.(html?|svg|shtml)$/i;
const DOC_LOOKALIKE = /\.(pdf|docx?|xlsx?|pptx?|txt|jpe?g|png|gif|mp3|mp4|mov)\.[a-z0-9]{2,5}$/i;
const IP_HOST = /^\d{1,3}(\.\d{1,3}){3}$|^\[[0-9a-f:]+\]$/i;

function linkQuickChecks(url, fileNameHint) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { name: "Quick checks", status: "flag", rating: "yellow", detail: "This link is not a normal web address." };
  }
  const name = fileNameHint || decodeURIComponent(u.pathname.split("/").pop() || "");
  const notes = [];
  let rating = "green";
  const raise = (level, note) => {
    if (RANK[level] > RANK[rating]) rating = level;
    notes.push(note);
  };

  if (DOC_LOOKALIKE.test(name) && PROGRAM_EXT.test(name)) {
    raise("red", `"${name}" is dressed up as a document or picture, but it is really a program.`);
  } else if (PROGRAM_EXT.test(name)) {
    raise("yellow", `"${name}" is a program. Only open programs you were expecting from someone you know.`);
  }
  if (DISK_EXT.test(name)) raise("yellow", `"${name}" is a disk image, a common way to sneak programs past email filters.`);
  if (MACRO_EXT.test(name)) raise("yellow", `"${name}" is an Office file that can run macros. Never click "Enable content".`);
  if (WEBPAGE_EXT.test(name)) raise("yellow", `"${name}" is a web page saved as a file. These are often fake sign-in pages.`);
  if (IP_HOST.test(u.hostname)) raise("red", "The link goes to a bare number address instead of a company website.");
  if (u.protocol === "http:") raise("yellow", "The download is not encrypted (http, not https).");
  if (u.username || u.password) raise("red", "The address hides its real destination behind an \"@\" trick.");

  return {
    name: "Quick checks",
    status: rating === "green" ? "clear" : "flag",
    rating,
    detail: notes.length ? notes.join(" ") : "Nothing unusual about the file type or address.",
  };
}

/* ------------------------------------------------------------------ *
 * Google Safe Browsing (Lookup API v4)
 * ------------------------------------------------------------------ */

const SAFE_BROWSING_LABELS = {
  MALWARE: "a known malware site",
  SOCIAL_ENGINEERING: "a known phishing or scam site",
  UNWANTED_SOFTWARE: "a site that pushes unwanted software",
  POTENTIALLY_HARMFUL_APPLICATION: "a site with harmful apps",
};

async function checkSafeBrowsing(url) {
  const name = "Google Safe Browsing";
  if (!LINK_KEYS.safeBrowsing) return { name, status: "skipped", detail: "No Google Safe Browsing key added." };
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(LINK_KEYS.safeBrowsing)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "canary-extension", clientVersion: "0.1.0" },
          threatInfo: {
            threatTypes: Object.keys(SAFE_BROWSING_LABELS),
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    if (!res.ok) return { name, status: "error", detail: `Google Safe Browsing could not check this link (${res.status}).` };
    const data = await res.json();
    const match = (data.matches || [])[0];
    if (match) {
      return { name, status: "flag", rating: "red", detail: `Google lists this as ${SAFE_BROWSING_LABELS[match.threatType] || "a dangerous site"}.` };
    }
    return { name, status: "clear", rating: "green", detail: "Google has no warnings for this link." };
  } catch {
    return { name, status: "error", detail: "Could not reach Google Safe Browsing." };
  }
}

/* ------------------------------------------------------------------ *
 * VirusTotal (API v3). Free key: 4 requests a minute, 500 a day.
 * ------------------------------------------------------------------ */

const vtCalls = [];
async function vtSlot() {
  // Wait until fewer than 4 calls were made in the last minute
  for (;;) {
    const now = Date.now();
    while (vtCalls.length && now - vtCalls[0] > 60_000) vtCalls.shift();
    if (vtCalls.length < 4) {
      vtCalls.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 60_000 - (now - vtCalls[0]) + 250));
  }
}

function vtUrlId(url) {
  const bytes = new TextEncoder().encode(url);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vtFetch(path, init = {}) {
  await vtSlot();
  return fetch(`https://www.virustotal.com/api/v3${path}`, {
    ...init,
    headers: { "x-apikey": LINK_KEYS.virusTotal, ...(init.headers || {}) },
  });
}

function vtVerdict(stats) {
  const bad = stats.malicious || 0;
  const iffy = stats.suspicious || 0;
  const total = bad + iffy + (stats.harmless || 0) + (stats.undetected || 0);
  if (bad >= 3) return { status: "flag", rating: "red", detail: `${bad} of ${total} security companies say this link is dangerous.` };
  if (bad >= 1 || iffy >= 2) {
    return { status: "flag", rating: "yellow", detail: `${bad + iffy} of ${total} security companies have concerns about this link.` };
  }
  return { status: "clear", rating: "green", detail: `None of ${total} security companies flagged this link.` };
}

async function checkVirusTotal(url) {
  const name = "VirusTotal";
  if (!LINK_KEYS.virusTotal) return { name, status: "skipped", detail: "No VirusTotal key added." };
  try {
    let res = await vtFetch(`/urls/${vtUrlId(url)}`);
    if (res.status === 401 || res.status === 403) return { name, status: "error", detail: "The VirusTotal key was not accepted." };
    if (res.status === 429) return { name, status: "error", detail: "VirusTotal's free limit was reached. Try again later." };

    if (res.ok) {
      const stats = (await res.json())?.data?.attributes?.last_analysis_stats;
      if (stats) return { name, ...vtVerdict(stats) };
    }

    if (res.status === 404) {
      // Never seen before: ask VirusTotal to scan it, then look once more
      const submit = await vtFetch("/urls", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url }).toString(),
      });
      if (!submit.ok) return { name, status: "error", detail: "VirusTotal could not start a scan of this link." };
      const analysisId = (await submit.json())?.data?.id;
      await new Promise((r) => setTimeout(r, 15_000));
      res = await vtFetch(`/analyses/${encodeURIComponent(analysisId)}`);
      const attrs = res.ok ? (await res.json())?.data?.attributes : null;
      if (attrs && attrs.status === "completed" && attrs.stats) return { name, ...vtVerdict(attrs.stats) };
      return { name, status: "pending", detail: "VirusTotal is still scanning this new link. Check again in a minute." };
    }

    return { name, status: "error", detail: `VirusTotal could not check this link (${res.status}).` };
  } catch {
    return { name, status: "error", detail: "Could not reach VirusTotal." };
  }
}

/* ------------------------------------------------------------------ *
 * Combine
 * ------------------------------------------------------------------ */

function combineLinkResults(url, sources) {
  const online = sources.filter((s) => s.name !== "Quick checks" && (s.status === "clear" || s.status === "flag"));
  const worst = sources.reduce((w, s) => (s.rating && RANK[s.rating] > RANK[w] ? s.rating : w), "unknown");
  const quick = sources.find((s) => s.name === "Quick checks");

  let rating = worst;
  // Without any online scanner we only trust the quick checks when they found a problem
  if (!online.length && rating === "green") rating = "unknown";

  const flagged = sources.filter((s) => s.rating === rating && s.status === "flag");
  // Lead with the single most important reason; the full list is in `sources`
  const reason = flagged[0] ? flagged[0].detail.split(/(?<=\.)\s+/)[0] : "";

  const text = {
    red: { headline: "Dangerous download", advice: `Do not download or open this. ${reason}` },
    yellow: { headline: "Be careful with this download", advice: `Only open it if you were expecting it. ${reason}` },
    green: {
      headline: "No threats found",
      advice: `${online.length === 1 ? "The online scanner" : `${online.length} online scanners`} found nothing wrong with this link.`,
    },
    unknown: {
      headline: "Not fully checked",
      advice: "Canary could not check this link with the online scanners. Only open it if you were expecting it.",
    },
  }[rating];

  return {
    url,
    rating,
    headline: text.headline,
    advice: text.advice.trim(),
    quickCheck: quick ? quick.detail : "",
    sources,
    checkedAt: Date.now(),
  };
}

async function readLinkCache() {
  try {
    return (await chrome.storage.local.get(LINK_CACHE_KEY))[LINK_CACHE_KEY] || {};
  } catch {
    return {};
  }
}

async function writeLinkCache(url, result) {
  const cache = await readLinkCache();
  cache[url] = result;
  const urls = Object.keys(cache).sort((a, b) => cache[a].checkedAt - cache[b].checkedAt);
  while (urls.length > LINK_CACHE_LIMIT) delete cache[urls.shift()];
  try {
    await chrome.storage.local.set({ [LINK_CACHE_KEY]: cache });
  } catch {
    /* ignore */
  }
}

async function scanLink(payload) {
  const url = String(payload?.url || "");
  if (!/^https?:\/\//i.test(url)) {
    throw Object.assign(new Error("SCAN_LINK needs an http(s) url."), { code: "BAD_PAYLOAD" });
  }

  if (!payload.force) {
    const hit = (await readLinkCache())[url];
    if (hit && Date.now() - hit.checkedAt < LINK_CACHE_TTL_MS) return { ...hit, cached: true };
  }

  const sources = [linkQuickChecks(url, payload.fileName)];
  sources.push(...(await Promise.all([checkSafeBrowsing(url), checkVirusTotal(url)])));
  const result = combineLinkResults(url, sources);

  // Don't cache half-finished VirusTotal scans, so the next look can finish them
  if (!sources.some((s) => s.status === "pending")) await writeLinkCache(url, result);
  return { ...result, cached: false };
}

function scannerStatus() {
  return {
    virusTotal: Boolean(LINK_KEYS.virusTotal),
    safeBrowsing: Boolean(LINK_KEYS.safeBrowsing),
  };
}

const LINK_HANDLERS = {
  SCAN_LINK: { responseType: "LINK_SCAN_RESULT", run: (payload) => scanLink(payload) },
  GET_SCANNER_STATUS: { responseType: "SCANNER_STATUS", run: async () => scannerStatus() },
};

// Answers only its own message types; everything else is left to background.js.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = LINK_HANDLERS[message && message.type];
  if (!handler) return false;
  handler
    .run(message.payload || {})
    .then((payload) => sendResponse({ ok: true, type: handler.responseType, requestId: message.requestId, payload }))
    .catch((error) =>
      sendResponse({
        ok: false,
        type: handler.responseType,
        requestId: message.requestId,
        error: { code: error?.code || "INTERNAL_ERROR", message: error?.message || "Canary could not check this link." },
      })
    );
  return true;
});

// For tests (node) only
if (typeof module !== "undefined") {
  module.exports = { linkQuickChecks, combineLinkResults, vtUrlId, vtVerdict, scanLink };
}

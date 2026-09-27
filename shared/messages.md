# Canary messaging contract

Every message that crosses a context boundary (content script ↔ service worker ↔ popup)
travels through `chrome.runtime.sendMessage` and is handled by the single
`chrome.runtime.onMessage` listener in `extension/background/background.js`.

This document is the source of truth. If a field is not listed here, do not send it.

## Envelope

All messages share the same outer shape:

```jsonc
{
  "type": "ANALYZE_EMAIL",  // required, one of the action types below
  "requestId": "c-172...-4f2", // optional, echoed back on the response for correlation
  "payload": {}                // required, shape depends on `type`
}
```

All responses share the same outer shape:

```jsonc
{
  "ok": true,          // false when the worker could not fulfil the request
  "type": "EMAIL_ANALYSIS_RESULT",
  "requestId": "c-172...-4f2",
  "payload": {},       // present when ok === true
  "error": {           // present when ok === false
    "code": "BAD_PAYLOAD",
    "message": "Human readable reason."
  }
}
```

Error codes: `BAD_PAYLOAD`, `UNKNOWN_TYPE`, `INTERNAL_ERROR`, `DOWNLOAD_NOT_FOUND`.

Because every handler is asynchronous, the listener returns `true` and replies later.
Senders must therefore always use the promise form
(`const res = await chrome.runtime.sendMessage(msg)`) and tolerate `undefined`
if the service worker was torn down mid-flight.

## Shared enums

### `score` — the traffic light

Email verdicts carry the traffic light in a field named `score`; download verdicts
name the same three values `rating`.

| Value    | Meaning                | Badge shown in Gmail |
| -------- | ---------------------- | -------------------- |
| `green`  | Safe                   | `🟢 Safe`            |
| `yellow` | Suspicious / caution   | `🟡 Caution`         |
| `red`    | Confirmed malicious    | `🔴 Scam Alert`      |

### `threatCategory`

`none`, `urgency_pressure`, `brand_impersonation`, `credential_phishing`,
`malicious_link`, `malware_attachment`, `wire_fraud`, `lookalike_domain`,
`unverified_sender`, `package_delivery_notice`, `bulk_marketing`.

### `severity` (per-signal weight, not the overall light)

`info`, `low`, `medium`, `high`, `critical`.

### `layer` — the five sponsor protections

`nordvpn`, `nordpass`, `coveron`, `incogni`, `saily`.

### `layerState`

| Value       | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `active`    | Layer ran and found nothing wrong.                         |
| `standby`   | Layer is armed but was not needed for this item.           |
| `triggered` | Layer fired a protective action (blocked, flagged, queued). |
| `offline`   | Layer could not be reached / shields are paused.           |

---

## 1. `ANALYZE_EMAIL`

**Direction:** `content.js` → `background.js`

Sent once per newly observed Gmail row or opened message. The content script is
responsible for de-duplicating; the worker also caches by `fingerprint`.

### Request payload

```jsonc
{
  "type": "ANALYZE_EMAIL",
  "requestId": "c-1727368421-91",
  "payload": {
    "fingerprint": "a3f9c1e0",   // stable hash of sender+subject+snippet
    "sender": "\"Chase Security\" <alerts@chase-update.top>", // full From line; a bare address is fine
    "subject": "URGENT: your account suspended",
    "bodySnippet": "Immediate action required. Sign in to confirm your card.",
    "links": [                   // optional; absolute URLs the content script already resolved
      "http://192.168.4.11/chase/login",
      "https://bit.ly/3xQz"
    ],
    "source": "list"             // optional: "list" | "thread"
  }
}
```

The engine parses the display name, address, and domain out of `sender` itself, so
send the From line as Gmail renders it. Links found inside `subject` /
`bodySnippet` are detected automatically; `links` only adds destinations that are
hidden behind anchor text.

At least one of `sender` or `subject` must be present, otherwise the request is
rejected with `BAD_PAYLOAD`.

### Response payload — `EMAIL_ANALYSIS_RESULT`

```jsonc
{
  "ok": true,
  "type": "EMAIL_ANALYSIS_RESULT",
  "requestId": "c-1727368421-91",
  "payload": {
    "fingerprint": "a3f9c1e0",
    "score": "red",               // the traffic light
    "riskPoints": 100,            // 0-100, debugging only — never show this to a user
    "confidence": "high",         // "low" | "medium" | "high"
    "paused": false,              // present and true when the user switched shields off
    "senderTrusted": false,       // sending domain is on the reputable-domain whitelist
    "trustSuppressed": false,     // true when the whitelist downgraded a warning to green
    "threatCategory": "brand_impersonation",       // the single worst finding
    "threatLabel": "Pretends to be Chase",         // short human label for that finding
    "threatCategories": ["urgency_pressure", "brand_impersonation", "malicious_link"],
    "simpleExplanation": "This is almost certainly a scam. This email looks like it is from Chase, but it was actually sent from “chase-update.top”. A real Chase message always ends in “chase.com”. …",
    "actionRecommendation": "Do not click anything in this email and do not type your password anywhere it sends you. …",
    "badge": {
      "emoji": "🔴",
      "label": "Scam Alert",
      "text": "🔴 Scam Alert",
      "className": "canary-red",
      "ariaLabel": "Scam alert. This email looks dangerous. Activate for a plain-English explanation."
    },
    "reasons": [
      {
        "id": "brand_domain_mismatch",
        "category": "brand_impersonation",
        "severity": "critical",
        "label": "Pretends to be Chase",
        "explanation": "This email looks like it is from Chase, but it was actually sent from “chase-update.top”. A real Chase message always ends in “chase.com”.",
        "evidence": "chase-update.top"
      }
    ],
    "sponsorShields": {
      "nordvpn": true,   // link sandbox checking engaged
      "nordpass": true,  // phishing credential defence triggered
      "coveron": true,   // identity / dark-web exposure flag
      "incogni": true,   // broker removal or unsubscribe eligible
      "saily": true      // safe cellular standby
    },
    "shieldNotes": {
      "nordvpn": "2 links opened in a protected sandbox before they can reach you.",
      "nordpass": "Your saved passwords are blocked from filling in on the page this email points to.",
      "coveron": "The sending website matches patterns seen in dark-web scam kits …",
      "incogni": "This address can be pulled from the data-broker lists that leaked it. …",
      "saily": "The same checks run when you read this inbox on mobile data."
    },
    "analyzedAt": 1727368421903,
    "engineVersion": "1.0.0"
  }
}
```

`content.js` only needs `score`, `badge`, `simpleExplanation`,
`actionRecommendation`, `reasons`, `sponsorShields` and `shieldNotes`.
Everything else is optional for renderers.

The engine caches by `fingerprint`, so repeat requests for the same email are free
and always return the identical verdict.

#### Reputable senders

Mail whose *sending domain* is on the engine's `REPUTABLE_DOMAINS` whitelist (or a
subdomain of one, such as `mailer.netflix.com`) is treated as genuine: ordinary
sales pressure is ignored and the verdict is forced to `green`, with
`senderTrusted: true` and `trustSuppressed: true` when a warning was downgraded.

Four findings survive the whitelist, because no genuine sender produces them —
a bare-IP sender or link, a link whose scheme runs code instead of opening a page
(`javascript:`, `data:text/html`, …), and a link disguised with an `@` trick.
Those keep their `red` rating no matter who the mail claims to be from.

When `trustSuppressed` is true, `reasons` still lists what was noticed but
`threatCategory` is `none` — render the badge from `score`, never from `reasons`.

### Unsolicited variant

`background.js` may also *push* an `EMAIL_ANALYSIS_RESULT` to an open popup so the
counter updates live. Popups must ignore messages whose `type` they do not handle.

---

## 2. `GET_SHIELDS_STATUS`

**Direction:** `popup.js` → `background.js`

### Request payload

```jsonc
{ "type": "GET_SHIELDS_STATUS", "payload": {} }
```

### Response payload

```jsonc
{
  "ok": true,
  "type": "SHIELDS_STATUS",
  "payload": {
    "shieldsEnabled": true,
    "engineVersion": "1.0.0",
    "session": {
      "startedAt": 1727360000000,
      "emailsScanned": 42,
      "threatsBlocked": 3,        // red verdicts + cancelled downloads
      "cautions": 7,              // yellow verdicts
      "downloadsScanned": 2,
      "downloadsBlocked": 1
    },
    "layers": [
      { "layer": "nordvpn",  "name": "NordVPN",  "state": "active",  "title": "Link sandbox",           "detail": "Risky links are opened in a safe sandbox first." },
      { "layer": "nordpass", "name": "NordPass", "state": "active",  "title": "Password protection",    "detail": "Passwords never auto-fill on fake sign-in pages." },
      { "layer": "coveron",  "name": "Coveron",  "state": "active",  "title": "Dark web check",         "detail": "Sender domains are checked against dark-web lists." },
      { "layer": "incogni",  "name": "Incogni",  "state": "standby", "title": "Data broker removal",    "detail": "1 removal request queued." },
      { "layer": "saily",    "name": "Saily",    "state": "standby", "title": "Safe mobile data",       "detail": "Protection follows you onto cellular data." }
    ],
    "recent": [
      { "fingerprint": "a3f9c1e0", "rating": "red", "sender": "\"Chase Security\" <alerts@chase-update.top>", "subject": "URGENT: your account suspended", "headline": "Pretends to be Chase", "at": 1727368421903 }
    ]
  }
}
```

`recent` is capped at the 10 newest verdicts, newest first, `yellow` and `red` only.

### `SET_SHIELDS_ENABLED`

The popup toggle uses the same channel:

```jsonc
{ "type": "SET_SHIELDS_ENABLED", "payload": { "enabled": false } }
```

Response payload is identical to `SHIELDS_STATUS` so the popup can re-render from one reply.

---

## 3. `SCAN_DOWNLOAD`

**Direction:** `popup.js` → `background.js`, to re-check a held file or to apply the
user's decision about it.

`chrome.downloads.onCreated` does **not** go through this message. The worker
inspects new downloads directly, pauses anything risky, and announces it with the
`DOWNLOAD_ALERT` broadcast documented below. `SCAN_DOWNLOAD` is how the UI then
releases or destroys the paused file.

### Request payload

```jsonc
{
  "type": "SCAN_DOWNLOAD",
  "payload": {
    "downloadId": 17,                 // required
    "url": "http://192.0.2.9/invoice.pdf.exe",
    "filename": "invoice.pdf.exe",
    "mimeType": "application/octet-stream", // optional
    "decision": "auto"                // "auto" | "allow" | "block"
  }
}
```

`decision: "auto"` runs the heuristics. `"allow"` resumes a paused download
because the user insisted. `"block"` cancels it.

### Response payload — `DOWNLOAD_SCAN_RESULT`

```jsonc
{
  "ok": true,
  "type": "DOWNLOAD_SCAN_RESULT",
  "payload": {
    "downloadId": 17,
    "filename": "invoice.pdf.exe",
    "rating": "red",
    "action": "cancelled",            // "allowed" | "paused" | "resumed" | "cancelled"
    "threatCategory": "malware_attachment",
    "simpleExplanation": "We removed this file before it could do any harm. “invoice.pdf.exe” is dressed up as a document, but the real ending makes it a program. …",
    "actionRecommendation": "Nothing else to do. If you truly need the file, ask the sender for a plain document instead.",
    "scannedAt": 1727368500120
  }
}
```

### Broadcast — `DOWNLOAD_ALERT`

Pushed by the worker the moment it pauses a risky download. Any open popup should
show it; if no popup is open the broadcast is simply dropped.

```jsonc
{
  "ok": true,
  "type": "DOWNLOAD_ALERT",
  "payload": {
    "downloadId": 17,
    "filename": "invoice.pdf.exe",
    "url": "http://192.0.2.9/invoice.pdf.exe",
    "host": "192.0.2.9",
    "rating": "red",
    "threatCategory": "malware_attachment",
    "action": "paused",               // "paused" when we caught it, "allowed" if it finished first
    "badge": { "emoji": "🔴", "label": "Scam Alert", "text": "🔴 Scam Alert", "className": "canary-red", "ariaLabel": "…" },
    "simpleExplanation": "We stopped a download so you can look at it first. “invoice.pdf.exe” is dressed up as a document, but the real ending makes it a program. …",
    "actionRecommendation": "If you were not expecting this file, throw it away. …",
    "sponsorShields": { "nordvpn": true, "nordpass": false, "coveron": true, "incogni": false, "saily": true },
    "scannedAt": 1727368500120
  }
}
```

Reply to it with `SCAN_DOWNLOAD` and `decision: "allow"` or `decision: "block"`.

---

## `OPEN_ADD_CONTACT`

**Direction:** `site/site-bridge.js` (content script on canary.fishing) → `background.js`

Sent when a visitor presses **Add trusted contact** on canary.fishing. The worker saves
`popupIntent: "add-contact"` in `chrome.storage.local` and calls `chrome.action.openPopup()`;
the popup reads and clears the intent, switches to the Trusted contacts tab and opens the
add form. If Chrome will not open the popup, the worker opens `popup/popup.html#add-contact`
in a tab instead.

```jsonc
{ "type": "OPEN_ADD_CONTACT", "payload": {} }
```

Response payload — `OPEN_ADD_CONTACT_RESULT`:

```jsonc
{ "ok": true, "type": "OPEN_ADD_CONTACT_RESULT", "payload": { "opened": "popup" } } // or "tab"
```

The page and the bridge talk with `window.postMessage`:
`{ source: "canary-site", type: "OPEN_ADD_CONTACT" }` in, and
`{ source: "canary-extension", type: "OPEN_ADD_CONTACT_RESULT", ok }` back. The bridge also sets
`document.documentElement.dataset.canaryExtension = "installed"` so the site can tell whether
Canary is installed.

---

## `SCAN_LINK`

**Direction:** `popup.js` (Downloads tab) → `background/link-scanner.js`

`ui/links.js` saves the download links it finds in the open email as
`chrome.storage.local.openEmailLinks = { subject, links: [{ url, text, fileName, host, kind }], at }`
(`kind`: `"file"` | `"share"` | `"download"`; `null` when no email is open). The Downloads tab
asks the scanner about each link. The scanner registers its own `onMessage` listener and only
answers `SCAN_LINK` and `GET_SCANNER_STATUS`.

```jsonc
{ "type": "SCAN_LINK", "payload": { "url": "https://…/invoice.pdf.exe", "fileName": "invoice.pdf.exe", "force": false } }
```

Response payload — `LINK_SCAN_RESULT`:

```jsonc
{
  "url": "https://…/invoice.pdf.exe",
  "rating": "red",                 // "green" | "yellow" | "red" | "unknown" (no online scanner could answer)
  "headline": "Dangerous download",
  "advice": "Do not download or open this. …",
  "sources": [                     // one entry per check
    { "name": "Quick checks", "status": "flag", "rating": "red", "detail": "…" },
    { "name": "Google Safe Browsing", "status": "skipped", "detail": "No Google Safe Browsing key added." },
    { "name": "VirusTotal", "status": "pending", "detail": "VirusTotal is still scanning this new link. …" }
  ],                               // status: "clear" | "flag" | "skipped" | "error" | "pending"
  "checkedAt": 1727368421903,
  "cached": false
}
```

Results are cached for 6 hours in `chrome.storage.local.linkScanCache` (`force: true` skips the cache).
VirusTotal calls are limited to 4 a minute to stay inside the free key.

`GET_SCANNER_STATUS` (payload `{}`) → `SCANNER_STATUS`: `{ virusTotal, safeBrowsing }` booleans for
which API keys are present in `extension/config/keys.js` (git-ignored; template in `keys.example.js`).

---

## Adding a new action type

1. Add the action type and both schemas to this file.
2. Add a handler to the `HANDLERS` map in `background/background.js`.
3. Keep the envelope. Never reply with a bare value — always `{ ok, type, payload }`.

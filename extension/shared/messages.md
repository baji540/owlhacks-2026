# Canary Internal Message Passing & Data Contract

This document serves as the team contract between `content.js` (DOM parser), `background.js` (threat engine), and `popup.js` / `banner.js` (UI layer).

---

## 1. Message: `ANALYZE_EMAIL`

### Workflow

1. `content.js` observes the Gmail inbox or open email view.
2. `content.js` extracts sender, subject, and snippet/body text.
3. `content.js` sends `ANALYZE_EMAIL` to `background.js`.
4. `background.js` executes heuristic scoring and returns the structured evaluation object.
git 
### Request Structure

Sent via `chrome.runtime.sendMessage`:

```javascript
{
  type: "ANALYZE_EMAIL",
  payload: {
    sender: "string (e.g. 'Chase Security Alert <no-reply@chase-support-verify.xyz>')",
    subject: "string (e.g. 'URGENT: Unauthorized wire transfer detected - account suspended')",
    bodySnippet: "string (e.g. 'We detected an unauthorized wire transfer. Account suspended immediately.')"
  }
}

```

### Response Structure

Returned via `sendResponse(result)`:

```javascript
{
  score: "green" | "yellow" | "red",
  threatCategory: "Phishing" | "Financial Scam" | "Suspicious Domain" | "Safe",
  simpleExplanation: "Jargon-free sentence explaining the issue clearly for seniors.",
  actionRecommendation: "Clear instruction (e.g., 'Do not click links. Delete this message.')",
  sponsorShields: {
    nordvpn: true,   // Flagged suspicious external link
    nordpass: true,  // Credential phishing lure detected
    coveron: true,   // High-risk identity theft indicator
    incogni: false   // Marketing/spam broker removal candidate
  }
}

```

---

## 2. Message: `DOWNLOAD_BLOCKED`

### Workflow

1. `background.js` intercepts an incoming file download with dangerous file extensions (`.exe`, `.scr`, `.bat`).
2. `background.js` pauses the download and broadcasts a message to active tabs / UI.

### Broadcast Structure

```javascript
{
  type: "DOWNLOAD_BLOCKED",
  payload: {
    filename: "invoice_update.exe",
    fileUrl: "http://malicious-source.com/invoice_update.exe",
    reason: "Blocked potentially harmful executable file from downloading automatically."
  }
}

```

---

## 3. UI Function Contract (`extension/ui/banner.js`)

`banner.js` must expose a globally accessible function on `window` so `content.js` can trigger it upon receiving an analysis result:

```javascript
/**
 * Injects or updates an explanatory alert banner inside an opened email.
 * @param {HTMLElement} targetContainer - The container element inside the email thread to prepend the banner to.
 * @param {Object} data - The evaluation result returned from background.js.
 */
window.renderWarningBanner = function(targetContainer, data) {
  // data matches the Response Structure:
  // {
  //   score: "red",
  //   threatCategory: "Phishing",
  //   simpleExplanation: "...",
  //   actionRecommendation: "...",
  //   sponsorShields: { ... }
  // }
};

```

---

## 4. UI CSS Classes (`extension/ui/injected-styles.css`)

Classes agreed upon for inbox row badges and alert modals:

* `.canary-badge`: Base pill styling next to subject line or sender.
* `.canary-green`: Background `#10b981`, Text `#ffffff` (Safe state).
* `.canary-yellow`: Background `#f59e0b`, Text `#111827` (Caution state).
* `.canary-red`: Background `#ef4444`, Text `#ffffff` (High alert state).
* `.canary-banner`: Styling for the expanded warning card prepended to email content.
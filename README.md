# Canary 🛡️🐥
> Real-time, senior-focused Gmail phishing protection and automated guardian alert safety net.

---

## 🎯 The Problem
Billions of dollars are lost every year to phishing scams, with older adults targeted disproportionately. Traditional security tools fail them in two ways:
1. **Cryptic Warnings:** Alerts rely on complex technical jargon, obscure domain strings, and confusing modal popups that users ignore.
2. **False Alarms:** Legitimate marketing promotions, receipts, and order updates frequently get flagged, causing alert fatigue.

**Canary** transforms email safety into a visual, accessible experience inside Gmail while creating an automated safety net for caregivers and family.

---

## ✨ Features
* **Traffic-Light Inbox Badges:** Instantly marks rows in Gmail with high-contrast status dots (🟢 Safe, 🟡 Caution, 🔴 Scam Detected) directly in the inbox view.
* **Plain-English Threat Banners:** Injects an accessible, senior-friendly warning directly above high-risk emails explaining threats clearly without technical jargon.
* **Guardian Alert Safety Net:** When an email with a critical threat score is opened, Canary automatically triggers an alert email to designated family caregivers so they can intervene before money or credentials are lost.
* **Commercial Domain Whitelist:** Verifies root domains and authentic subdomains across 30+ major services (Apple, Google, Amazon, major banks, shipping carriers) to prevent marketing promotions from triggering false alarms.
* **Zero-Flicker In-Memory Caching:** Prevents badge disappearance and performance lag caused by Gmail's dynamic row re-rendering when transitioning from unread to read status.

---

## 🏗️ Architecture & Tech Stack

Canary is engineered as a **Chrome Extension (Manifest V3)**:

* **Frontend (`content.js`, `ui/banner.js`):**
  * Observes Gmail's dynamic Single Page Application (SPA) table rows (`tr.zA`) using a debounced `MutationObserver`.
  * Handles navigation lifecycle transitions (`hashchange`, `popstate`) and re-injects cached badges on row state toggles.
  * Injects accessible warning cards directly into the email body container.

* **Backend Service Worker (`background.js`):**
  * Houses heuristic threat analysis and scoring logic.
  * Parses sender addresses against the authentic domain whitelist.
  * Maintains an in-memory threat evaluation cache and deduplicates guardian notification requests.

* **Popup UI (`popup/`):**
  * Accessible settings card allowing seniors or family members to register guardian alert email credentials and inspect protection status.

---

## 🚀 Getting Started

### Load the Extension in Chrome
1. Clone this repository:
   ```bash
   git clone [https://github.com/baji540/owlhacks-2026.git](https://github.com/baji540/owlhacks-2026.git)

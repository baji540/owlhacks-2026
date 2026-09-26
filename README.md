# Canary — Email Threat Shield

Canary is a senior-friendly Chrome extension (Manifest V3) that provides a simple "traffic light" security layer (🟢 Safe, 🟡 Caution, 🔴 Scam Alert) directly inside Gmail, helping protect users from phishing attempts, identity scams, and malicious downloads.

---

## Features

* **Traffic Light Indicators:** Automatically scans incoming emails and flags them with visual indicators (🟢 / 🟡 / 🔴) in the Gmail interface.
* **Plain-English Explanations:** Explains security risks without confusing technical jargon so non-technical users can make safe decisions.
* **Download Interceptor:** Monitors incoming downloads for dangerous executable extensions (`.exe`, `.bat`, `.scr`, `.vbs`) and pauses them with a warning.
* **Modular Architecture:** Clean separation between Gmail DOM observation, background threat heuristics, and UI components.

---

## Project Structure

```text
owlhacks-2026/
├── extension/
│   ├── manifest.json            # Extension configuration (Manifest V3)
│   ├── background/
│   │   └── background.js        # Background service worker & threat engine
│   ├── content/
│   │   └── content.js           # Gmail DOM observer & badge injector
│   ├── popup/
│   │   ├── popup.html           # Extension toolbar popup interface
│   │   └── popup.js             # Popup controls and shield status
│   └── ui/
│       ├── banner.js            # Injected alert banners and modal components
│       └── injected-styles.css  # Styles for badges and banners
├── shared/
│   └── messages.md              # Internal message schemas & API contracts
└── website/                     # Project landing and informational site

```

---

## Getting Started (Local Development)

### Prerequisites

* Google Chrome (Version 100+ recommended for Manifest V3 support)
* Git

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/<your-org>/owlhacks-2026.git
cd owlhacks-2026

```


2. **Load the Extension into Chrome:**
* Open Chrome and navigate to `chrome://extensions`.
* Enable **Developer mode** using the toggle switch in the top-right corner.
* Click **Load unpacked** in the top-left corner.
* Select the **`extension/`** folder (the folder containing `manifest.json`, **not** the root repository directory).


3. **Verify:**
* Open [Gmail](https://mail.google.com?utm_source=gemini).
* Check the DevTools console (**F12**) to verify `content.js` and the background service worker are active.



---

## Team & Contribution Guidelines

* **Trunk-Based Workflow:** Work cleanly on `main` by respecting directory ownership:
* `extension/background/` & `extension/content/`: Background threat engine & DOM scanning.
* `extension/popup/` & `extension/ui/`: Popup UI, banners, and CSS styles.
* `website/`: Project website and documentation.


* **Syncing:** Always pull changes before pushing:
```bash
git pull --rebase origin main
git push origin main

```


* Refer to `shared/messages.md` for message passing schemas between scripts.

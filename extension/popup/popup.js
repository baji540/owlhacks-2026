// extension/popup/popup.js — owner: Masnun
// Shows the result for the most recently scanned email.
// Ari: after scoring an email, save it with
//   chrome.storage.local.set({ lastScan: { score, simpleExplanation, actionRecommendation, subject } })
// and this popup will display it.

const TITLES = {
  green: "This email looks safe",
  yellow: "Be careful with this email",
  red: "Warning: likely a scam",
};

function showScan(scan) {
  const status = document.getElementById("status");
  const title = document.getElementById("status-title");
  const text = document.getElementById("status-text");
  const actionBox = document.getElementById("action-box");
  const actionText = document.getElementById("action-text");

  if (!scan || !TITLES[scan.score]) return;

  status.className = `status status-${scan.score}`;
  title.textContent = TITLES[scan.score];
  text.textContent = scan.subject
    ? `"${scan.subject}" — ${scan.simpleExplanation || ""}`
    : scan.simpleExplanation || "";

  if (scan.actionRecommendation && scan.score !== "green") {
    actionText.textContent = " " + scan.actionRecommendation;
    actionBox.hidden = false;
  } else {
    actionBox.hidden = true;
  }
}

function applyBigText(on) {
  document.body.classList.toggle("big", on);
}

document.addEventListener("DOMContentLoaded", async () => {
  const enabled = document.getElementById("enabled");
  const bigtext = document.getElementById("bigtext");

  const saved = await chrome.storage.local.get(["lastScan", "enabled", "bigText"]);
  enabled.checked = saved.enabled !== false;
  bigtext.checked = !!saved.bigText;
  applyBigText(bigtext.checked);
  showScan(saved.lastScan);

  enabled.addEventListener("change", () => chrome.storage.local.set({ enabled: enabled.checked }));
  bigtext.addEventListener("change", () => {
    chrome.storage.local.set({ bigText: bigtext.checked });
    applyBigText(bigtext.checked);
  });

  // Update live if a new email gets scanned while the popup is open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastScan) showScan(changes.lastScan.newValue);
  });
});

const DEVPULSE_STATUS_URL = "http://localhost:19876/status";

async function init() {
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const tabDomain = document.getElementById("tabDomain");
  const tabUrl = document.getElementById("tabUrl");
  const trackedCount = document.getElementById("trackedCount");

  // Check DevPulse connection
  let connected = false;
  try {
    const res = await fetch(DEVPULSE_STATUS_URL, { signal: AbortSignal.timeout(2000) });
    connected = res.ok;
  } catch {
    connected = false;
  }

  statusDot.className = `status-dot ${connected ? "connected" : "disconnected"}`;
  statusText.textContent = connected ? "Bagli" : "Baglanti yok";

  // Get current active tab info
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      let domain = "";
      try {
        domain = new URL(tab.url).hostname;
      } catch {
        domain = tab.url;
      }
      tabDomain.textContent = domain || "-";
      // Truncate long URLs for display
      const displayUrl = tab.url.length > 60 ? tab.url.substring(0, 60) + "..." : tab.url;
      tabUrl.textContent = displayUrl;
    }
  } catch {
    tabDomain.textContent = "-";
    tabUrl.textContent = "-";
  }

  // Show tracked count from storage
  try {
    const stored = await chrome.storage.local.get(["trackedCount"]);
    trackedCount.textContent = stored.trackedCount || 0;
  } catch {
    trackedCount.textContent = "0";
  }
}

document.addEventListener("DOMContentLoaded", init);

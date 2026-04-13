const DEVPULSE_URL = "http://localhost:19876/tab-update";
const ALARM_NAME = "devpulse-tab-check";
const ALARM_PERIOD_MINUTES = 0.5; // 30 seconds (minimum allowed in MV3)

let lastSentData = null;

// --- Core: send tab data to DevPulse ---
async function sendTabUpdate() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url) return;

    // Skip internal chrome pages
    if (activeTab.url.startsWith("chrome://") || activeTab.url.startsWith("chrome-extension://")) {
      return;
    }

    let domain = "";
    try {
      domain = new URL(activeTab.url).hostname;
    } catch {
      domain = "";
    }

    const allTabs = await chrome.tabs.query({});
    const tabCount = allTabs.length;

    const data = {
      url: activeTab.url,
      title: activeTab.title || "",
      domain: domain,
      tab_count: tabCount,
      timestamp: Date.now(),
    };

    // Avoid duplicate sends (same url+title)
    const fingerprint = `${data.url}|${data.title}`;
    if (lastSentData === fingerprint) return;

    await fetch(DEVPULSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    lastSentData = fingerprint;

    // Persist stats
    if (chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(["trackedCount"]);
      await chrome.storage.local.set({
        trackedCount: (stored.trackedCount || 0) + 1,
        lastDomain: domain,
        lastUrl: activeTab.url,
        connected: true,
      });
    }
  } catch (err) {
    // DevPulse not running — silently fail, mark disconnected
    try { if (chrome.storage && chrome.storage.local) await chrome.storage.local.set({ connected: false }); } catch(_) {}
  }
}

// --- Periodic check via alarms (every 30s, reliable in MV3) ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Reset fingerprint so periodic updates always send (captures time-on-tab)
    lastSentData = null;
    sendTabUpdate();
  }
});

// --- Immediate detection on tab switch ---
chrome.tabs.onActivated.addListener(() => {
  sendTabUpdate();
});

// --- Also detect URL changes within the same tab ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    sendTabUpdate();
  }
});

// --- Window focus change ---
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    sendTabUpdate();
  }
});

// --- Setup on install ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ trackedCount: 0, connected: false });
  sendTabUpdate();
});

// --- Ensure alarm exists on service worker startup ---
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  sendTabUpdate();
});

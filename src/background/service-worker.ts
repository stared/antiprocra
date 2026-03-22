import {
  TRACKED_DOMAINS,
  TICK_INTERVAL_SECONDS,
  IDLE_THRESHOLD_SECONDS,
  ALARM_NAME,
  SESSION_LENGTH_SECONDS,
} from "../shared/config";
import { getTrackingData, saveTrackingData } from "../shared/storage";
import type { ExtensionMessage } from "../shared/types";

let currentTrackedDomain: string | null = null;
let userIsIdle = false;

// --- Domain matching ---

function matchTrackedDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return (
      TRACKED_DOMAINS.find(
        (d) => hostname === d || hostname.endsWith("." + d),
      ) ?? null
    );
  } catch {
    return null;
  }
}

function updateCurrentDomain(url: string | undefined): void {
  currentTrackedDomain = matchTrackedDomain(url);
}

// --- Tab tracking ---

chrome.tabs.onActivated.addListener((activeInfo) => {
  void chrome.tabs.get(activeInfo.tabId).then((tab) => {
    updateCurrentDomain(tab.url);
  });
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    updateCurrentDomain(changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    currentTrackedDomain = null;
    return;
  }
  void chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab) updateCurrentDomain(tab.url);
  });
});

// --- Idle detection ---

chrome.idle.onStateChanged.addListener((newState) => {
  userIsIdle = newState !== "active";
});

// --- Alarm: periodic time accumulation ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  void tick();
});

async function tick(): Promise<void> {
  const data = await getTrackingData(); // handles daily reset

  if (!currentTrackedDomain || userIsIdle) return;

  const site = data.sites[currentTrackedDomain];
  if (!site) return;

  // Only accumulate if there's an active session
  if (site.currentSessionStart > 0) {
    site.totalSeconds += TICK_INTERVAL_SECONDS;
  }

  await saveTrackingData(data);
}

// --- Message handling from content scripts ---

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true; // async response
  },
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  const data = await getTrackingData();
  const site = data.sites[message.domain];

  if (!site) return null;

  switch (message.type) {
    case "SESSION_START": {
      site.visits += 1;
      site.currentSessionStart = Date.now();
      site.currentSessionSeconds = SESSION_LENGTH_SECONDS;
      await saveTrackingData(data);
      return { ok: true };
    }
    case "GET_DATA": {
      return site;
    }
  }
}

// --- Initialization ---

async function init(): Promise<void> {
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: TICK_INTERVAL_SECONDS / 60,
  });
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

  // Ensure storage is initialized (handles daily reset)
  await getTrackingData();

  // Reconstruct active domain from current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) updateCurrentDomain(tab.url);

  const state = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  userIsIdle = state !== "active";
}

chrome.runtime.onInstalled.addListener(() => void init());
chrome.runtime.onStartup.addListener(() => void init());

// Also init on service worker wake (covers restart after termination)
void init();

import {
  TRACKED_DOMAINS,
  TICK_INTERVAL_SECONDS,
  IDLE_THRESHOLD_SECONDS,
  ALARM_NAME,
  SESSION_LENGTH_SECONDS,
  PAUSE_GRACE_SECONDS,
  PAUSE_ALARM_PREFIX,
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
    // Window lost focus: start grace timer before pausing
    if (currentTrackedDomain) {
      const alarmName = PAUSE_ALARM_PREFIX + currentTrackedDomain;
      void chrome.alarms.create(alarmName, {
        delayInMinutes: PAUSE_GRACE_SECONDS / 60,
      });
    }
    currentTrackedDomain = null;
    return;
  }
  void chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab) {
      const domain = matchTrackedDomain(tab.url);
      currentTrackedDomain = domain;
      if (domain) {
        void cancelGraceAndResume(domain);
      }
    }
  });
});

// --- Pause / Resume ---

async function pauseSession(domain: string): Promise<void> {
  const data = await getTrackingData();
  const site = data.sites[domain];
  if (!site || site.currentSessionStart <= 0) return;
  if (site.pausedAt > 0) return; // already paused

  site.pausedAt = Date.now();
  await saveTrackingData(data);
}

async function cancelGraceAndResume(domain: string): Promise<void> {
  // Cancel any pending grace alarm
  await chrome.alarms.clear(PAUSE_ALARM_PREFIX + domain);

  // Resume if currently paused
  const data = await getTrackingData();
  const site = data.sites[domain];
  if (!site || site.pausedAt <= 0) return;

  site.pausedDuration += Date.now() - site.pausedAt;
  site.pausedAt = 0;
  await saveTrackingData(data);
}

// --- Idle detection ---

chrome.idle.onStateChanged.addListener((newState) => {
  userIsIdle = newState !== "active";
});

// --- Alarm: periodic time accumulation + pause grace ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void tick();
    return;
  }
  if (alarm.name.startsWith(PAUSE_ALARM_PREFIX)) {
    const domain = alarm.name.slice(PAUSE_ALARM_PREFIX.length);
    void pauseSession(domain);
    return;
  }
});

async function tick(): Promise<void> {
  const data = await getTrackingData(); // handles daily reset

  if (!currentTrackedDomain || userIsIdle) return;

  const site = data.sites[currentTrackedDomain];
  if (!site) return;

  // Only accumulate if there's an active, non-paused session
  if (site.currentSessionStart > 0 && site.pausedAt <= 0) {
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
      site.pausedAt = 0;
      site.pausedDuration = 0;
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
  if (tab) {
    updateCurrentDomain(tab.url);
    // If focused on a tracked domain, resume any stale pause (SW restart case)
    if (currentTrackedDomain) {
      await cancelGraceAndResume(currentTrackedDomain);
    }
  }

  const state = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  userIsIdle = state !== "active";
}

chrome.runtime.onInstalled.addListener(() => void init());
chrome.runtime.onStartup.addListener(() => void init());

// Also init on service worker wake (covers restart after termination)
void init();

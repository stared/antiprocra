import { TRACKED_DOMAINS } from "../shared/config";
import type {
  SiteData,
  SessionStartMessage,
  GetDataMessage,
} from "../shared/types";
import { createOverlay } from "./overlay";
import { createBar, updateSiteData, ensureBarExists } from "./bar";

const currentDomain = (() => {
  const hostname = location.hostname;
  return (
    TRACKED_DOMAINS.find(
      (d) => hostname === d || hostname.endsWith("." + d),
    ) ?? null
  );
})();

if (currentDomain) {
  // IMMEDIATELY hide the page — runs at document_start before body exists
  const hideStyle = document.createElement("style");
  hideStyle.id = "antiprocra-hide";
  hideStyle.textContent = "body { visibility: hidden !important; }";
  document.documentElement.appendChild(hideStyle);

  if (document.body) {
    void main(currentDomain, hideStyle);
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        void main(currentDomain, hideStyle);
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}

function isContextValid(): boolean {
  return chrome.runtime?.id !== undefined;
}

async function main(domain: string, hideStyle: HTMLElement): Promise<void> {
  // 1. Show overlay IMMEDIATELY — no waiting for background data
  const overlay = createOverlay(domain);
  document.body.appendChild(overlay.element);
  hideStyle.remove(); // overlay covers the page now, no need for visibility:hidden

  // 2. Fetch stats in the background, update overlay when ready
  if (isContextValid()) {
    const siteData = await getSiteData(domain);
    overlay.updateStats(siteData);
  }

  // 3. Wait for user to click "Open" + countdown
  await overlay.waitForOpen();

  // 4. Session starts after countdown
  if (!isContextValid()) return;

  const startMsg: SessionStartMessage = { type: "SESSION_START", domain };
  await chrome.runtime.sendMessage(startMsg);

  const updatedData = await getSiteData(domain);
  createBar(domain, updatedData);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (!isContextValid()) return;
    if (area !== "local" || !changes.trackingData) return;
    const newData = changes.trackingData.newValue as
      | { sites: Record<string, SiteData> }
      | undefined;
    if (newData?.sites[domain]) {
      updateSiteData(newData.sites[domain]);
    }
  });

  const barCheckInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(barCheckInterval);
      return;
    }
    void getSiteData(domain).then((data) => {
      ensureBarExists(domain, data);
    });
  }, 5000);
}

async function getSiteData(domain: string): Promise<SiteData> {
  if (!isContextValid()) {
    return { totalSeconds: 0, visits: 0, currentSessionStart: 0, currentSessionSeconds: 0 };
  }
  const msg: GetDataMessage = { type: "GET_DATA", domain };
  const response = (await chrome.runtime.sendMessage(msg)) as SiteData | null;
  return (
    response ?? { totalSeconds: 0, visits: 0, currentSessionStart: 0, currentSessionSeconds: 0 }
  );
}

import { TRACKED_DOMAINS } from "../shared/config";
import type {
  SiteData,
  SessionStartMessage,
  GetDataMessage,
} from "../shared/types";
import { showOverlay } from "./overlay";
import { createBar, updateSiteData, ensureBarExists } from "./bar";

// Detect which tracked domain we're on
const currentDomain = (() => {
  const hostname = location.hostname;
  return (
    TRACKED_DOMAINS.find(
      (d) => hostname === d || hostname.endsWith("." + d),
    ) ?? null
  );
})();

if (currentDomain) {
  void main(currentDomain);
}

async function main(domain: string): Promise<void> {
  // Get current data for this site
  const siteData = await getSiteData(domain);

  // Show blur overlay with countdown
  await showOverlay(domain, siteData);

  // Countdown done — start session
  const startMsg: SessionStartMessage = { type: "SESSION_START", domain };
  await chrome.runtime.sendMessage(startMsg);

  // Fetch updated data (with new session start)
  const updatedData = await getSiteData(domain);

  // Create the timer bar
  createBar(domain, updatedData);

  // Listen for storage updates from background
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.trackingData) return;
    const newData = changes.trackingData.newValue as
      | { sites: Record<string, SiteData> }
      | undefined;
    if (newData?.sites[domain]) {
      updateSiteData(newData.sites[domain]);
    }
  });

  // Periodic safety check: re-inject bar if removed by site JS
  setInterval(() => {
    void getSiteData(domain).then((data) => {
      ensureBarExists(domain, data);
    });
  }, 5000);
}

async function getSiteData(domain: string): Promise<SiteData> {
  const msg: GetDataMessage = { type: "GET_DATA", domain };
  const response = (await chrome.runtime.sendMessage(msg)) as SiteData | null;
  return (
    response ?? {
      totalSeconds: 0,
      visits: 0,
      currentSessionStart: 0,
      currentSessionSeconds: 0,
    }
  );
}

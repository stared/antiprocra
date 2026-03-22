import { TRACKED_DOMAINS, DAY_START_HOUR } from "./config";
import type { TrackingData, SiteData } from "./types";

function freshSiteData(): SiteData {
  return {
    totalSeconds: 0,
    visits: 0,
    currentSessionStart: 0,
    currentSessionSeconds: 0,
  };
}

export function getTrackingDate(): string {
  const now = new Date();
  if (now.getHours() < DAY_START_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

function freshTrackingData(): TrackingData {
  const sites: Record<string, SiteData> = {};
  for (const domain of TRACKED_DOMAINS) {
    sites[domain] = freshSiteData();
  }
  return { date: getTrackingDate(), sites };
}

export async function getTrackingData(): Promise<TrackingData> {
  const result = await chrome.storage.local.get("trackingData");
  const data = result.trackingData as TrackingData | undefined;
  const today = getTrackingDate();

  if (!data || data.date !== today) {
    const fresh = freshTrackingData();
    await chrome.storage.local.set({ trackingData: fresh });
    return fresh;
  }

  // Ensure any new domains are present
  for (const domain of TRACKED_DOMAINS) {
    if (!data.sites[domain]) {
      data.sites[domain] = freshSiteData();
    }
  }

  return data;
}

export async function saveTrackingData(data: TrackingData): Promise<void> {
  await chrome.storage.local.set({ trackingData: data });
}

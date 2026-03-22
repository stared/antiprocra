import { COUNTDOWN_SECONDS } from "../shared/config";
import type { SiteData } from "../shared/types";

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getSiteName(domain: string): string {
  if (domain.includes("facebook")) return "Facebook";
  if (domain.includes("youtube")) return "YouTube";
  return domain;
}

export function showOverlay(
  domain: string,
  siteData: SiteData,
): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "antiprocra-overlay";

    const siteName = getSiteName(domain);
    const timeStr = formatTime(siteData.totalSeconds);
    const visits = siteData.visits;

    // Stats line — only show if there's prior data
    const statsLine =
      visits > 0
        ? `You've visited ${siteName} <strong>${visits} time${visits !== 1 ? "s" : ""}</strong> today, spending <strong>${timeStr}</strong> total.`
        : `First visit to ${siteName} today.`;

    overlay.innerHTML = `
      <div id="antiprocra-overlay-content">
        <div id="antiprocra-overlay-stats">${statsLine}</div>
        <div id="antiprocra-overlay-countdown">Opening in <span id="antiprocra-countdown-number">${COUNTDOWN_SECONDS}</span>...</div>
      </div>
    `;

    document.body.appendChild(overlay);

    let remaining = COUNTDOWN_SECONDS;
    const countdownEl = document.getElementById("antiprocra-countdown-number");

    const interval = setInterval(() => {
      remaining -= 1;
      if (countdownEl) countdownEl.textContent = String(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        overlay.classList.add("antiprocra-fade-out");
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 400);
      }
    }, 1000);
  });
}

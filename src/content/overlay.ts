import { COUNTDOWN_SECONDS } from "../shared/config";
import type { SiteData } from "../shared/types";

const LOCK_MESSAGES = [
  "What would you build if you weren't scrolling?",
  "The real world has higher resolution.",
  "Your future self just thanked you.",
  "Go make something.",
  "That mass-energy equivalence won't derive itself.",
  "The best posts are the ones you never read.",
  "Close the laptop. Look out the window.",
  "You were about to do something important. Remember?",
];

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSiteName(domain: string): string {
  if (domain.includes("facebook")) return "Facebook";
  if (domain.includes("youtube")) return "YouTube";
  return domain;
}

function buildStatsHtml(domain: string, siteData: SiteData | null): string {
  if (!siteData) return "";
  const siteName = getSiteName(domain);
  const visits = siteData.visits;
  if (visits > 0) {
    const timeStr = formatTime(siteData.totalSeconds);
    return `You've already spent <strong>${timeStr}</strong> on ${siteName} today, across <strong>${visits} visit${visits !== 1 ? "s" : ""}</strong>.`;
  }
  return `How about a day without ${siteName}? It would be lovely!`;
}

/** Show entry overlay immediately. Stats update when data arrives. */
export function createOverlay(domain: string): {
  element: HTMLElement;
  updateStats: (data: SiteData) => void;
  waitForOpen: () => Promise<void>;
} {
  const overlay = document.createElement("div");
  overlay.id = "antiprocra-overlay";

  overlay.innerHTML = `
    <div id="antiprocra-overlay-content">
      <div id="antiprocra-overlay-stats"></div>
      <div id="antiprocra-overlay-prompt">Take a breath. Is this intentional?</div>
      <button id="antiprocra-open-btn">Yes, I need this</button>
      <div id="antiprocra-overlay-countdown"></div>
    </div>
  `;

  const statsEl = overlay.querySelector("#antiprocra-overlay-stats");

  function updateStats(data: SiteData): void {
    if (statsEl) statsEl.innerHTML = buildStatsHtml(domain, data);
  }

  function waitForOpen(): Promise<void> {
    return new Promise((resolve) => {
      const btn = overlay.querySelector("#antiprocra-open-btn");
      const countdownEl = overlay.querySelector("#antiprocra-overlay-countdown");
      if (!btn || !countdownEl) {
        resolve();
        return;
      }

      btn.addEventListener("click", () => {
        btn.remove();
        let remaining = COUNTDOWN_SECONDS;
        countdownEl.innerHTML = `Opening in <span id="antiprocra-countdown-number">${remaining}</span>...`;
        const numEl = overlay.querySelector("#antiprocra-countdown-number");

        const interval = setInterval(() => {
          remaining -= 1;
          if (numEl) numEl.textContent = String(remaining);

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
    });
  }

  return { element: overlay, updateStats, waitForOpen };
}

/** Show lock screen — farewell with time saved and a rotating message. */
export function showLockScreen(remainingSeconds: number): void {
  // Guard against duplicate lock screens
  if (document.getElementById("antiprocra-lock")) return;

  const message = LOCK_MESSAGES[Math.floor(Math.random() * LOCK_MESSAGES.length)];
  const saved = formatCountdown(remainingSeconds);

  const overlay = document.createElement("div");
  overlay.id = "antiprocra-lock";

  overlay.innerHTML = `
    <div id="antiprocra-lock-content">
      <div id="antiprocra-lock-saved">You saved ${saved} 🌱</div>
      <div id="antiprocra-lock-message">${message}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Remove the bar
  document.getElementById("antiprocra-bar")?.remove();
}

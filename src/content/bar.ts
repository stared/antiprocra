import type { SiteData } from "../shared/types";
import { showLockScreen } from "./overlay";

const BAR_HEIGHT = 56;
const SITE_CSS_ID = "antiprocra-site-css";

const YOUTUBE_CSS = `
#masthead-container { top: ${BAR_HEIGHT}px !important; transform: none !important; }
#frosted-glass { top: ${BAR_HEIGHT}px !important; }
tp-yt-app-drawer#guide { top: ${BAR_HEIGHT * 2}px !important; }
ytd-mini-guide-renderer { top: ${BAR_HEIGHT * 2}px !important; }
#page-manager { margin-top: ${BAR_HEIGHT * 2}px !important; }
`;

const FACEBOOK_CSS = `
div[role="banner"] { top: ${BAR_HEIGHT}px !important; }
div[role="main"] { padding-top: ${BAR_HEIGHT}px !important; }
`;

let barElement: HTMLElement | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let cachedSiteData: SiteData;

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getSessionRemaining(site: SiteData): number {
  if (site.currentSessionStart <= 0) return 0;
  const elapsed = Math.floor((Date.now() - site.currentSessionStart) / 1000);
  return Math.max(0, site.currentSessionSeconds - elapsed);
}

function getBarState(remaining: number, total: number): string {
  if (remaining <= 0) return "expired";
  if (remaining < 120) return "critical";
  if (remaining < total / 2) return "warning";
  return "neutral";
}

function updateBarDisplay(): void {
  if (!barElement) return;

  const remaining = getSessionRemaining(cachedSiteData);
  const state = getBarState(remaining, cachedSiteData.currentSessionSeconds);

  barElement.setAttribute("data-state", state);

  const timeSpan = barElement.querySelector("#antiprocra-bar-time");
  const statsSpan = barElement.querySelector("#antiprocra-bar-stats");
  if (timeSpan) {
    timeSpan.textContent =
      state === "expired"
        ? "Time's up!"
        : `Session: ${formatCountdown(remaining)}`;
  }

  if (statsSpan) {
    statsSpan.textContent = `${cachedSiteData.visits} visit${cachedSiteData.visits !== 1 ? "s" : ""} · ${formatTotal(cachedSiteData.totalSeconds)} today`;
  }
}

function handleLock(): void {
  const remaining = getSessionRemaining(cachedSiteData);
  if (timerInterval) clearInterval(timerInterval);
  removeSiteCSS();
  showLockScreen(remaining);
}

function injectSiteCSS(domain: string): void {
  document.getElementById(SITE_CSS_ID)?.remove();

  let css = "";
  if (domain.includes("youtube")) {
    css = YOUTUBE_CSS;
  } else if (domain.includes("facebook")) {
    css = FACEBOOK_CSS;
    // Fallback: scan body direct children for fixed headers not covered by role selectors
    shiftFixedBodyChildren();
  }

  if (!css) return;

  const style = document.createElement("style");
  style.id = SITE_CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function shiftFixedBodyChildren(): void {
  const children = document.body.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i] as HTMLElement;
    if (el.id?.startsWith("antiprocra-")) continue;
    const computed = getComputedStyle(el);
    if (computed.position === "fixed" && (computed.top === "0px" || computed.top === "0")) {
      el.style.setProperty("top", `${BAR_HEIGHT}px`, "important");
      el.dataset.antiprocraPushed = "true";
    }
  }
}

function removeSiteCSS(): void {
  document.getElementById(SITE_CSS_ID)?.remove();
  const pushed = document.querySelectorAll("[data-antiprocra-pushed]");
  pushed.forEach((el) => {
    (el as HTMLElement).style.removeProperty("top");
    delete (el as HTMLElement).dataset.antiprocraPushed;
  });
}

export function createBar(domain: string, siteData: SiteData): void {
  cachedSiteData = siteData;

  barElement = document.createElement("div");
  barElement.id = "antiprocra-bar";
  barElement.setAttribute("data-state", "neutral");

  barElement.innerHTML = `
    <span id="antiprocra-bar-time"></span>
    <span class="antiprocra-sep">&middot;</span>
    <span id="antiprocra-bar-stats"></span>
    <span id="antiprocra-bar-buttons">
      <button id="antiprocra-lock-btn">Lock now 🌱</button>
    </span>
  `;

  document.body.prepend(barElement);
  injectSiteCSS(domain);

  barElement
    .querySelector("#antiprocra-lock-btn")
    ?.addEventListener("click", handleLock);

  updateBarDisplay();

  timerInterval = setInterval(updateBarDisplay, 1000);
}

export function updateSiteData(siteData: SiteData): void {
  cachedSiteData = siteData;
  updateBarDisplay();
}

export function ensureBarExists(domain: string, siteData: SiteData): void {
  if (!document.getElementById("antiprocra-bar")) {
    if (timerInterval) clearInterval(timerInterval);
    createBar(domain, siteData);
  }
}

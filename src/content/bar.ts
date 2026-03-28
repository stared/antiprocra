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
body { margin-top: ${BAR_HEIGHT}px !important; }
`;

let barElement: HTMLElement | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let cachedSiteData: SiteData;
let fixedElementObserver: MutationObserver | null = null;
let observerDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getSessionRemaining(site: SiteData): number {
  if (site.currentSessionStart <= 0) return 0;
  const elapsed = Math.floor((Date.now() - site.currentSessionStart) / 1000);
  return site.currentSessionSeconds - elapsed;
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
    if (state === "expired") {
      const overstay = Math.abs(remaining);
      timeSpan.textContent = `Overstayed your welcome by ${formatCountdown(overstay)}`;
    } else {
      timeSpan.textContent = `Session: ${formatCountdown(remaining)}`;
    }
  }

  if (state === "expired") {
    const overstayMinutes = Math.floor(Math.abs(remaining) / 60);
    const extraHeight = Math.min(overstayMinutes * 4, 80);
    barElement.style.height = `${BAR_HEIGHT + extraHeight}px`;
    barElement.style.fontSize = `${16 + Math.min(overstayMinutes, 10)}px`;
  } else {
    barElement.style.height = "";
    barElement.style.fontSize = "";
  }

  if (statsSpan) {
    statsSpan.textContent = `${cachedSiteData.visits} visit${cachedSiteData.visits !== 1 ? "s" : ""} · ${formatTotal(cachedSiteData.totalSeconds)} today`;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    updateBarDisplay();
  }
}

function handleLock(): void {
  const remaining = getSessionRemaining(cachedSiteData);
  if (timerInterval) clearInterval(timerInterval);
  document.removeEventListener("visibilitychange", onVisibilityChange);
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
    // Deep-scan all elements for fixed/sticky headers not covered by CSS selectors
    shiftFixedTopElements();
    // Watch for dynamically added elements (Facebook is an SPA)
    startFixedElementObserver();
  }

  if (!css) return;

  const style = document.createElement("style");
  style.id = SITE_CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function isFixedAtTop(el: HTMLElement): boolean {
  if (el.id?.startsWith("antiprocra-")) return false;
  if (el.dataset.antiprocraPushed) return false;
  const computed = getComputedStyle(el);
  if (computed.position !== "fixed" && computed.position !== "sticky") return false;
  const top = parseFloat(computed.top);
  return !isNaN(top) && top >= 0 && top < BAR_HEIGHT;
}

function pushElementDown(el: HTMLElement): void {
  el.style.setProperty("top", `${BAR_HEIGHT}px`, "important");
  el.dataset.antiprocraPushed = "true";
}

function shiftFixedTopElements(root?: Element): void {
  const container = root ?? document.body;
  const elements = container.querySelectorAll("*");
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    if (isFixedAtTop(el)) {
      pushElementDown(el);
    }
  }
  // Also check the container itself if it's not document.body
  if (root && root instanceof HTMLElement && isFixedAtTop(root)) {
    pushElementDown(root);
  }
}

function startFixedElementObserver(): void {
  stopFixedElementObserver();

  fixedElementObserver = new MutationObserver((mutations) => {
    if (observerDebounceTimer) clearTimeout(observerDebounceTimer);
    observerDebounceTimer = setTimeout(() => {
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            shiftFixedTopElements(node as Element);
          }
        }
      }
    }, 200);
  });

  fixedElementObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopFixedElementObserver(): void {
  if (observerDebounceTimer) {
    clearTimeout(observerDebounceTimer);
    observerDebounceTimer = null;
  }
  if (fixedElementObserver) {
    fixedElementObserver.disconnect();
    fixedElementObserver = null;
  }
}

function removeSiteCSS(): void {
  stopFixedElementObserver();
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
    <span id="antiprocra-bar-stats"></span>
    <span id="antiprocra-bar-time"></span>
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

  // Check immediately when tab regains focus (setInterval is throttled in background tabs)
  document.addEventListener("visibilitychange", onVisibilityChange);
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

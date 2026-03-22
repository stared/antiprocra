import { SESSION_EXTEND_SECONDS } from "../shared/config";
import type { SiteData, SessionExtendMessage } from "../shared/types";
import { showLockScreen } from "./overlay";

let barElement: HTMLElement | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let cachedDomain: string;
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
  const extendBtn = barElement.querySelector("#antiprocra-extend-btn") as HTMLElement | null;

  if (timeSpan) {
    timeSpan.textContent =
      state === "expired"
        ? "Time's up!"
        : `Session: ${formatCountdown(remaining)}`;
  }

  if (statsSpan) {
    statsSpan.textContent = `${cachedSiteData.visits} visit${cachedSiteData.visits !== 1 ? "s" : ""} · ${formatTotal(cachedSiteData.totalSeconds)} today`;
  }

  if (extendBtn) {
    extendBtn.style.visibility = state === "expired" ? "visible" : "hidden";
  }
}

function handleExtend(): void {
  const msg: SessionExtendMessage = {
    type: "SESSION_EXTEND",
    domain: cachedDomain,
  };
  void chrome.runtime.sendMessage(msg);
  cachedSiteData.currentSessionSeconds += SESSION_EXTEND_SECONDS;
  updateBarDisplay();
}

function handleLock(): void {
  const remaining = getSessionRemaining(cachedSiteData);
  if (timerInterval) clearInterval(timerInterval);
  showLockScreen(remaining);
}

export function createBar(domain: string, siteData: SiteData): void {
  cachedDomain = domain;
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
      <button id="antiprocra-extend-btn">Continue (+5 min)</button>
    </span>
  `;

  document.body.prepend(barElement);
  document.documentElement.style.setProperty(
    "--antiprocra-bar-height",
    "56px",
  );
  document.body.style.marginTop = "56px";

  barElement
    .querySelector("#antiprocra-extend-btn")
    ?.addEventListener("click", handleExtend);
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

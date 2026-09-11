/**
 * The site inside Telegram as a Mini App; the only file that talks to `window.Telegram`. Telegram launches the page
 * with `#tgWebAppPlatform=…`, and the launch is remembered in sessionStorage so a reload after an in-app navigation
 * still knows its host. The official script loads here, on demand, so a plain browser never fetches it; outside
 * Telegram `telegram()` is null and every helper is a no-op. What the client gives, from which version, and its
 * limits: docs/reference/telegram-mini-app.md.
 */
import type { WebApp } from "@twa-dev/types";
import { bindSystemScheme, onThemeChange } from "./theme";

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}

const SCRIPT_URL = "https://telegram.org/js/telegram-web-app.js?63";
const HOST_KEY = "ta.host";
const HOST = "telegram";
const READING_ID = /^[A-Za-z0-9_-]{1,32}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

let app: WebApp | null = null;
let startParam: string | null = null;
let backHandler: (() => void) | null = null;

export function telegram(): WebApp | null {
  return app;
}

/** Whether Telegram launched this page: the launch hash on the first load, the remembered flag on a reload. */
export function launchedByTelegram(hash: string, remembered: string | null): boolean {
  return remembered === HOST || launchParams(hash).has("tgWebAppPlatform");
}

/** The reading id a `t.me/<bot>?startapp=<id>` link carries; only the launch itself, a reload does not replay it. */
export function startReadingOf(hash: string): string | null {
  const param = launchParams(hash).get("tgWebAppStartParam");
  return param !== null && READING_ID.test(param) ? param : null;
}

function launchParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ""));
}

export async function initTelegram(): Promise<void> {
  const hash = window.location.hash;
  if (!launchedByTelegram(hash, remembered())) return;
  remember();
  startParam = startReadingOf(hash);
  const loaded = await loadScript();
  if (loaded === null) return;
  app = loaded;
  document.documentElement.dataset.host = HOST;
  // The launch hash carries initData, the viewer's signed identity: strip it before any link is built from the URL.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  loaded.expand();
  bindSystemScheme(
    () => loaded.colorScheme,
    (listener) => {
      loaded.onEvent("themeChanged", listener);
    },
  );
  onThemeChange(() => {
    paintChrome(loaded);
  });
  // A new tab is not a thing inside the client: such links go to the external browser through Telegram.
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[target="_blank"]') : null;
    if (link === null) return;
    event.preventDefault();
    loaded.openLink(link.href);
  });
}

/** The shell is painted: Telegram drops its loading placeholder. */
export function telegramReady(): void {
  app?.ready();
}

/** The viewer's Telegram language, to go ahead of the browser's list. */
export function telegramLanguages(): readonly string[] {
  const code = app?.initDataUnsafe.user?.language_code;
  return code === undefined ? [] : [code];
}

export function telegramStartReading(): string | null {
  return app === null ? null : startParam;
}

/** Telegram's own back arrow for a page under the landing; null hides it. */
export function telegramBack(onBack: (() => void) | null): void {
  if (app === null) return;
  if (backHandler !== null) app.BackButton.offClick(backHandler);
  backHandler = onBack;
  if (onBack === null) app.BackButton.hide();
  else app.BackButton.onClick(onBack).show();
}

/** The Settings item in the client's own menu opens ours. */
export function telegramSettings(onOpen: () => void): void {
  app?.SettingsButton.onClick(onOpen).show();
}

/** Telegram's "send to" dialog for a reading link; false outside Telegram, where the caller shows its own. */
export function telegramShare(link: string): boolean {
  if (app === null) return false;
  app.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
  return true;
}

function loadScript(): Promise<WebApp | null> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.onload = () => {
      resolve(window.Telegram?.WebApp ?? null);
    };
    script.onerror = () => {
      resolve(null);
    };
    document.head.append(script);
  });
}

/** The client paints a bar over the page and a ground under it: both take the theme's ink, and follow a switch. */
function paintChrome(webApp: WebApp): void {
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  if (!HEX_COLOR.test(ink)) return;
  const color = ink as `#${string}`;
  webApp.setHeaderColor(color);
  webApp.setBackgroundColor(color);
}

function remembered(): string | null {
  try {
    return sessionStorage.getItem(HOST_KEY);
  } catch {
    return null;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(HOST_KEY, HOST);
  } catch {
    // Storage blocked: a reload inside the client falls back to the plain site.
  }
}

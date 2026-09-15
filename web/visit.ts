/**
 * Who is looking and in which visit: a random token this browser keeps, a session for this tab, and what only the
 * browser knows about itself — language, theme, host, device, where the visit came from. It rides on every `/api/*`
 * call in one `X-Visit` header, so an event the Worker writes itself lands in the same visit as the clicks before
 * it; country and the rest of the edge the Worker adds on its side (docs/analytics.md).
 * The token is not an account: it is random, never leaves this browser and buys nothing.
 */
import { lang } from "./i18n";
import { telegram } from "./telegram";
import { resolvedTheme } from "./theme";

const VISITOR_KEY = "ta.visitor";
const SESSION_KEY = "ta.session";
const SOURCE_KEY = "ta.source";
const OS_BY_AGENT: readonly (readonly [RegExp, string])[] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];
// A browser with storage blocked is still counted; it just forgets itself when the page goes.
const inMemory = new Map<string, string>();

/** The `X-Visit` value: what this browser can name, as a query string the Worker parses. */
export function visitHeader(): string {
  const app = telegram();
  const agent = navigator.userAgent;
  const fields: Record<string, string> = {
    v: kept(localStorage, VISITOR_KEY, random),
    s: kept(sessionStorage, SESSION_KEY, random),
    p: app === null ? "web" : "tg",
    tp: app?.platform ?? "",
    d: deviceOf(agent),
    os: osOf(agent),
    l: lang(),
    th: resolvedTheme(),
    // Read once per tab: a click deeper into the site must not rewrite where the visit came from.
    src: kept(sessionStorage, SOURCE_KEY, () => sourceOf(document.referrer, location.search, location.host)),
    h: String(new Date().getHours()),
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== "") params.set(key, value);
  return params.toString();
}

export function deviceOf(agent: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod/.test(agent) ? "mobile" : "desktop";
}

export function osOf(agent: string): string {
  return OS_BY_AGENT.find(([pattern]) => pattern.test(agent))?.[1] ?? "other";
}

/** Who sent the visit: the campaign when the link says so, else the site that linked here, else nobody. */
export function sourceOf(referrer: string, search: string, host: string): string {
  const campaign = new URLSearchParams(search).get("utm_source");
  if (campaign !== null && campaign !== "") return campaign;
  const from = hostOf(referrer);
  return from === "" || from === host ? "direct" : from;
}

function kept(store: Storage, key: string, make: () => string): string {
  try {
    const found = store.getItem(key);
    if (found !== null) return found;
    const fresh = make();
    store.setItem(key, fresh);
    return fresh;
  } catch {
    const found = inMemory.get(key);
    if (found !== undefined) return found;
    const fresh = make();
    inMemory.set(key, fresh);
    return fresh;
  }
}

// `randomUUID` would be shorter, but it is gated behind a secure context and a preview over plain HTTP is not one.
function random(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

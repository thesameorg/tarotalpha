/**
 * Eleven interface languages, one dictionary shape. The language is the viewer's stored choice, else the share link's
 * `lang`, else the first we have of the host's languages (Telegram's) and then the browser's, else English.
 * Switching is live: modules that hold text
 * re-render on `onLangChange`, static markup in index.html is relabelled through `data-i18n` keys ("path.to.text",
 * or "path@attr" for an attribute, several joined with ";").
 */
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { isLang, LANGS, matchLang, type Lang } from "./langs";
import { pt } from "./pt";
import { ru } from "./ru";
import { tr } from "./tr";
import { zh } from "./zh";

export { isLang, LANGS, type Lang };
export type Dictionary = typeof ru;

const STORAGE_KEY = "ta.lang";
export const DICTIONARIES: Record<Lang, Dictionary> = { en, es, pt, fr, it, de, tr, ru, zh, ja, ko };
const listeners = new Set<() => void>();
let current: Lang = "en";

export function lang(): Lang {
  return current;
}

export function t(): Dictionary {
  return DICTIONARIES[current];
}

export function initLang(params: URLSearchParams, hostLangs: readonly string[] = []): void {
  const stored = read();
  const param = params.get("lang");
  if (isLang(stored)) current = stored;
  else if (isLang(param)) current = param;
  else current = matchLang([...hostLangs, ...navigator.languages]) ?? "en";
  apply();
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  store(next);
  apply();
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fills every `data-i18n` element under `root` from the current dictionary. */
export function applyStatic(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    for (const spec of (el.dataset.i18n ?? "").split(";")) {
      const [path = "", attr] = spec.split("@");
      const value = lookup(path);
      if (attr === undefined) el.textContent = value;
      else el.setAttribute(attr, value);
    }
  }
}

function apply(): void {
  document.documentElement.lang = current;
  document.title = t().title;
  applyStatic(document);
}

function lookup(path: string): string {
  let node: unknown = t();
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null) return "";
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "string" ? node : "";
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(value: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or a full quota: the choice lives until the tab closes.
  }
}

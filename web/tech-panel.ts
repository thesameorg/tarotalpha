/**
 * The terminal facts behind the "tech" button: exchange lag, UTC clock, candle source, engine version, anchor, ATR,
 * reading id. Hidden by default, the choice survives in localStorage; markup lives in index.html. The only place
 * on the page that still speaks UTC, and it speaks English whatever the interface language: terms are not translated.
 */
import type { Source } from "../exchange/provider";
import { onLangChange, t } from "./i18n/index";
import { utcClock, utcDateTime } from "./utc-format";

const STORAGE_KEY = "ta.tech";

export interface TechFacts {
  lag: number | null;
  source: Source | null;
  engine: string | null;
  anchorTs: number | null;
  atr: string | null;
  readingId: string | null;
}

const facts: TechFacts = { lag: null, source: null, engine: null, anchorTs: null, atr: null, readingId: null };

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el !== null) el.textContent = text;
}

const dash = (text: string | null): string => text ?? "—";

function paint(): void {
  setText("tech-lag", facts.lag === null ? "—" : `${String(facts.lag)} ms`);
  setText("tech-source", facts.source === null ? "—" : t().sources[facts.source]);
  setText("tech-engine", dash(facts.engine));
  setText("tech-anchor", facts.anchorTs === null ? "—" : `${utcDateTime(facts.anchorTs)} · ${String(facts.anchorTs)}`);
  setText("tech-atr", dash(facts.atr));
  setText("tech-reading", dash(facts.readingId));
}

export function setTechFacts(next: Partial<TechFacts>): void {
  if (next.lag !== undefined) facts.lag = next.lag;
  if (next.source !== undefined) facts.source = next.source;
  if (next.engine !== undefined) facts.engine = next.engine;
  if (next.anchorTs !== undefined) facts.anchorTs = next.anchorTs;
  if (next.atr !== undefined) facts.atr = next.atr;
  if (next.readingId !== undefined) facts.readingId = next.readingId;
  paint();
}

function storedOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Private mode or a full quota: the panel still toggles, it just forgets.
  }
}

export function initTechPanel(): void {
  const panel = document.getElementById("tech");
  const toggle = document.getElementById("tech-toggle");
  if (panel === null || toggle === null) return;
  const apply = (open: boolean): void => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  apply(storedOpen());
  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    apply(open);
    storeOpen(open);
  });
  const tick = (): void => {
    setText("tech-utc", utcClock(Date.now()));
  };
  tick();
  setInterval(tick, 1000);
  onLangChange(paint);
  paint();
}

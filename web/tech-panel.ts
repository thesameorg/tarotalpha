/**
 * The terminal facts behind the "tech" button: exchange lag, UTC clock, candle source, engine version, anchor, ATR,
 * reading id. Hidden by default, the choice survives in localStorage; markup lives in index.html. The only place
 * on the page that still speaks UTC.
 */
import type { Source } from "../exchange/provider";
import { copy } from "./copy";
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

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el !== null) el.textContent = text;
}

const dash = (text: string | null): string => text ?? "—";

export function setTechFacts(facts: Partial<TechFacts>): void {
  if (facts.lag !== undefined) setText("tech-lag", facts.lag === null ? "—" : `${String(facts.lag)} мс`);
  if (facts.source !== undefined) setText("tech-source", facts.source === null ? "—" : copy.sources[facts.source]);
  if (facts.engine !== undefined) setText("tech-engine", dash(facts.engine));
  if (facts.anchorTs !== undefined) {
    setText(
      "tech-anchor",
      facts.anchorTs === null ? "—" : `${utcDateTime(facts.anchorTs)} · ${String(facts.anchorTs)}`,
    );
  }
  if (facts.atr !== undefined) setText("tech-atr", dash(facts.atr));
  if (facts.readingId !== undefined) setText("tech-reading", dash(facts.readingId));
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
}

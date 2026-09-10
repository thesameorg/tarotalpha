/**
 * The cards block under the chart, one for both pages: day tabs, the three cards of the chosen day with one esoteric
 * line under each, the day's summary with its disclaimer, and the technical panel behind the round "i" — the
 * engine's sentence per card, the ATR line and the disclaimer again. The popover never changes the page height.
 * Everything here is text, so the block re-renders itself when the language switches.
 */
import { cardById } from "../engine/deck";
import type { StepResult } from "../engine/index";
import { frontMarkup, slotMarkup } from "./card-face";
import { required } from "./dom-lookup";
import { onLangChange, t } from "./i18n/index";
import type { RevealCard } from "./reveal-overlay";
import { daySummary } from "./spread-summary";

export interface SpreadPanel {
  setSteps(steps: readonly StepResult[], active: number): void;
  clear(): void;
  /** The snapshot's ATR as the interface prints it; `null` while no chart is loaded. */
  setAtr(atr: string | null): void;
  dispose(): void;
}

export function cardsOf(step: StepResult): RevealCard[] {
  return step.cards.map(([id, reversed]) => ({ card: cardById(id), reversed: reversed === 1 }));
}

function markup(): string {
  return `<div class="tabs"><div class="tablist" role="tablist"></div><button class="info" type="button" aria-expanded="false" hidden>i</button></div>
<div class="info-panel" hidden></div>
<div class="spread"></div>
<div class="meanings"></div>
<div class="summary" hidden></div>`;
}

function tabMarkup(index: number, active: boolean): string {
  return `<button type="button" role="tab" aria-selected="${String(active)}" data-index="${String(index)}">${t().day(index + 1)}</button>`;
}

function infoLine(drawn: RevealCard, position: number, sentence: string): string {
  const name = t().cardName(drawn.card);
  const title = `${name}${drawn.reversed ? `, ${t().reversed}` : ""} · ${t().positions[position] ?? ""}`;
  return `<p><b>${title}</b>${sentence}</p>`;
}

export function createSpreadPanel(root: HTMLElement, eager: boolean): SpreadPanel {
  root.classList.add("panel");
  root.innerHTML = markup();
  const tablist = required(root, ".tablist", HTMLElement);
  const info = required(root, ".info", HTMLButtonElement);
  const infoPanel = required(root, ".info-panel", HTMLElement);
  const spread = required(root, ".spread", HTMLElement);
  const meanings = required(root, ".meanings", HTMLElement);
  const summary = required(root, ".summary", HTMLElement);

  let steps: readonly StepResult[] = [];
  let active = 0;
  let atr: string | null = null;

  const openInfo = (open: boolean): void => {
    infoPanel.hidden = !open;
    info.setAttribute("aria-expanded", String(open));
  };

  const renderInfo = (): void => {
    const step = steps[active];
    if (step === undefined) return;
    const lines = cardsOf(step)
      .map((c, index) => {
        const effect = step.effects[index];
        return infoLine(c, index, effect === undefined ? "" : t().effect(effect));
      })
      .join("");
    const atrLine = atr === null ? "" : t().atrLine(atr);
    infoPanel.innerHTML = `${lines}<p class="info-atr">${atrLine}</p><p class="disclaimer">${t().disclaimer}</p>`;
  };

  // `fresh` replays the appear animation: on for a new day, off when only the words change.
  const render = (fresh: boolean): void => {
    const step = steps[active];
    info.setAttribute("aria-label", t().info);
    info.title = t().info;
    tablist.innerHTML = steps.map((_, index) => tabMarkup(index, index === active)).join("");
    info.hidden = step === undefined;
    summary.hidden = step === undefined;
    if (step === undefined) {
      spread.innerHTML = slotMarkup(null, false).repeat(3);
      meanings.replaceChildren();
      summary.replaceChildren();
      infoPanel.replaceChildren();
      return;
    }
    const cards = cardsOf(step);
    spread.innerHTML = cards.map((c) => slotMarkup(frontMarkup(c.card, c.reversed, eager), true)).join("");
    spread.classList.remove("fresh");
    if (fresh) {
      spread.getBoundingClientRect();
      spread.classList.add("fresh");
    }
    meanings.innerHTML = cards
      .map((c) => {
        const line = t().meaning(c.card.id, c.reversed);
        return `<p title="${line}">${line}</p>`;
      })
      .join("");
    summary.innerHTML = `<p><b>${t().summaryTitle}</b> ${daySummary(step)}</p><p class="disclaimer">${t().disclaimer}</p>`;
    renderInfo();
  };

  const select = (index: number): void => {
    if (index < 0 || index >= steps.length || index === active) return;
    active = index;
    openInfo(false);
    render(true);
  };

  tablist.addEventListener("click", (event) => {
    const tab = event.target instanceof Element ? event.target.closest("[data-index]") : null;
    if (tab !== null) select(Number(tab.getAttribute("data-index")));
  });
  tablist.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") select(active + 1);
    if (event.key === "ArrowLeft") select(active - 1);
  });
  info.addEventListener("click", () => {
    openInfo(infoPanel.hidden);
  });
  const onDocumentClick = (event: Event): void => {
    if (infoPanel.hidden || !(event.target instanceof Node)) return;
    if (infoPanel.contains(event.target) || info.contains(event.target)) return;
    openInfo(false);
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") openInfo(false);
  };
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  const unsubscribe = onLangChange(() => {
    render(false);
  });
  render(false);

  return {
    setSteps(next, activeIndex) {
      steps = next;
      active = Math.min(Math.max(0, activeIndex), Math.max(0, next.length - 1));
      openInfo(false);
      render(true);
    },
    clear() {
      steps = [];
      active = 0;
      openInfo(false);
      render(false);
    },
    setAtr(next) {
      atr = next;
      renderInfo();
    },
    dispose() {
      unsubscribe();
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeydown);
    },
  };
}

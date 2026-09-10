/**
 * The cards block under the chart, one for both pages: day tabs, the three cards of the chosen day with one
 * esoteric line under each, and the technical panel behind the round "i" — the engine's sentence per card, the
 * ATR line and the one-line disclaimer. The panel is a popover over the cards so it never changes the page height.
 */
import type { Card } from "../engine/v1/deck";
import type { StepResult } from "../engine/v1/index";
import { frontMarkup, slotMarkup } from "./card-face";
import { cardMeaning } from "./card-meaning";
import { copy } from "./copy";
import { required } from "./dom-lookup";
import type { RevealCard } from "./reveal-overlay";

export type CardLookup = (id: number) => Card;

export interface SpreadPanel {
  setSteps(steps: readonly StepResult[], active: number): void;
  clear(): void;
  setAtr(line: string | null): void;
  dispose(): void;
}

export function cardsOf(step: StepResult, cardById: CardLookup): RevealCard[] {
  return step.cards.map(([id, reversed]) => ({ card: cardById(id), reversed: reversed === 1 }));
}

function markup(): string {
  return `<div class="tabs"><div class="tablist" role="tablist"></div><button class="info" type="button" aria-expanded="false" aria-label="${copy.info}" title="${copy.info}" hidden>i</button></div>
<div class="info-panel" hidden></div>
<div class="spread"></div>
<div class="meanings"></div>`;
}

function tabMarkup(index: number, active: boolean): string {
  return `<button type="button" role="tab" aria-selected="${String(active)}" data-index="${String(index)}">${copy.day(index + 1)}</button>`;
}

function infoLine(drawn: RevealCard, position: number, sentence: string): string {
  const title = `${drawn.card.name}${drawn.reversed ? `, ${copy.reversed}` : ""} · ${copy.positions[position] ?? ""}`;
  return `<p><b>${title}</b>${sentence}</p>`;
}

export function createSpreadPanel(root: HTMLElement, cardById: CardLookup, eager: boolean): SpreadPanel {
  root.classList.add("panel");
  root.innerHTML = markup();
  const tablist = required(root, ".tablist", HTMLElement);
  const info = required(root, ".info", HTMLButtonElement);
  const infoPanel = required(root, ".info-panel", HTMLElement);
  const spread = required(root, ".spread", HTMLElement);
  const meanings = required(root, ".meanings", HTMLElement);

  let steps: readonly StepResult[] = [];
  let active = 0;
  let atr: string | null = null;

  const openInfo = (open: boolean): void => {
    infoPanel.hidden = !open;
    info.setAttribute("aria-expanded", String(open));
  };

  const render = (): void => {
    const step = steps[active];
    tablist.innerHTML = steps.map((_, index) => tabMarkup(index, index === active)).join("");
    info.hidden = step === undefined;
    if (step === undefined) {
      spread.innerHTML = slotMarkup(null, false).repeat(3);
      meanings.replaceChildren();
      infoPanel.replaceChildren();
      return;
    }
    const cards = cardsOf(step, cardById);
    spread.innerHTML = cards.map((c) => slotMarkup(frontMarkup(c.card, c.reversed, eager), true)).join("");
    spread.classList.remove("fresh");
    spread.getBoundingClientRect();
    spread.classList.add("fresh");
    meanings.innerHTML = cards
      .map((c) => {
        const line = cardMeaning(c.card.id, c.reversed);
        return `<p title="${line}">${line}</p>`;
      })
      .join("");
    renderInfo();
  };

  const renderInfo = (): void => {
    const step = steps[active];
    if (step === undefined) return;
    const cards = cardsOf(step, cardById);
    const lines = cards.map((c, index) => infoLine(c, index, step.interpretation[index] ?? "")).join("");
    infoPanel.innerHTML = `${lines}<p class="info-atr">${atr ?? ""}</p><p class="disclaimer">${copy.disclaimer}</p>`;
  };

  const select = (index: number): void => {
    if (index < 0 || index >= steps.length || index === active) return;
    active = index;
    openInfo(false);
    render();
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
  render();

  return {
    setSteps(next, activeIndex) {
      steps = next;
      active = Math.min(Math.max(0, activeIndex), Math.max(0, next.length - 1));
      openInfo(false);
      render();
    },
    clear() {
      steps = [];
      active = 0;
      openInfo(false);
      render();
    },
    setAtr(line) {
      atr = line;
      renderInfo();
    },
    dispose() {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeydown);
    },
  };
}

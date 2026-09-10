/**
 * The cards block under the chart, one for both pages: day tabs with a link to the method page, the three cards of
 * the chosen day with one esoteric line under each, and the day's summary with its disclaimer. The numbers behind
 * a card are not shown here: how they are computed is the English page /how.html, opened in a new tab.
 * Everything here is text, so the block re-renders itself when the language switches.
 */
import { cardById } from "../engine/deck";
import type { StepResult } from "../engine/index";
import { frontMarkup, slotMarkup } from "./card-face";
import { required } from "./dom-lookup";
import { onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import type { RevealCard } from "./reveal-overlay";
import { daySummary } from "./spread-summary";

export const HOW_URL = "/how.html";

export interface SpreadPanel {
  setSteps(steps: readonly StepResult[], active: number): void;
  clear(): void;
  dispose(): void;
}

export function cardsOf(step: StepResult): RevealCard[] {
  return step.cards.map(([id, reversed]) => ({ card: cardById(id), reversed: reversed === 1 }));
}

function markup(): string {
  return `<div class="tabs"><div class="tablist" role="tablist"></div><a class="how-link" href="${HOW_URL}" target="_blank" rel="noopener" hidden></a></div>
<div class="spread"></div>
<div class="meanings"></div>
<div class="summary" hidden></div>`;
}

function tabMarkup(index: number, active: boolean): string {
  return `<button type="button" role="tab" aria-selected="${String(active)}" data-index="${String(index)}">${t().day(index + 1)}</button>`;
}

export function createSpreadPanel(root: HTMLElement, eager: boolean): SpreadPanel {
  root.classList.add("panel");
  root.innerHTML = markup();
  const tablist = required(root, ".tablist", HTMLElement);
  const how = required(root, ".how-link", HTMLAnchorElement);
  const spread = required(root, ".spread", HTMLElement);
  const meanings = required(root, ".meanings", HTMLElement);
  const summary = required(root, ".summary", HTMLElement);

  let steps: readonly StepResult[] = [];
  let active = 0;

  // `fresh` replays the appear animation: on for a new day, off when only the words change.
  const render = (fresh: boolean): void => {
    const step = steps[active];
    tablist.innerHTML = steps.map((_, index) => tabMarkup(index, index === active)).join("");
    how.innerHTML = `${t().how}${icons.external}`;
    how.hidden = step === undefined;
    summary.hidden = step === undefined;
    if (step === undefined) {
      // No card slots before a step: how many cards a reader draws is its own business, and one may throw bones.
      spread.innerHTML = `<div class="cloth" aria-hidden="true"></div>`;
      meanings.replaceChildren();
      summary.replaceChildren();
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
  };

  const select = (index: number): void => {
    if (index < 0 || index >= steps.length || index === active) return;
    active = index;
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
  const unsubscribe = onLangChange(() => {
    render(false);
  });
  render(false);

  return {
    setSteps(next, activeIndex) {
      steps = next;
      active = Math.min(Math.max(0, activeIndex), Math.max(0, next.length - 1));
      render(true);
    },
    clear() {
      steps = [];
      active = 0;
      render(false);
    },
    dispose() {
      unsubscribe();
    },
  };
}

/**
 * The loot-box in fullscreen: a stack of backs shuffles, bursts into sparks and spreads into a fan along the bottom;
 * the user pulls three backs out of it (card-fan.ts), each flies to its slot and flips with a spark, a reversed
 * major flips red and shakes the stage. The i-th pull reveals card i: the fan is theatre, the cards are fixed by
 * the seed. Markup is in index.html, the ring and flash live inside the overlay so they stay above the page.
 * Reveals queue: two never overlap. `auto` pulls by itself for a replay; "close" resolves false and nothing applies.
 * With reduced motion there are no particles and no flight: backs vanish from the fan, cards fade in face up.
 */
import type { Card } from "../engine/v1/deck";
import { createCardFan, type PullPoint } from "./card-fan";
import { frontMarkup, slotMarkup } from "./card-face";
import { copy } from "./copy";
import { required } from "./dom-lookup";
import { Sparkles } from "./sparkles";
import { flash, reducedMotion, ring, shake, sleep } from "./stage-effects";

export interface RevealCard {
  card: Card;
  reversed: boolean;
}

export interface RevealOptions {
  auto?: boolean;
}

const FADE_IN_MS = 200;
const SHUFFLE_MS = 420;
const FLY_MS = 560;
const AFTER_FLIP_MS = 650;
const HOLD_MS = 500;
const FADE_OUT_MS = 400;
const REDUCED_FADE_MS = 150;
const REDUCED_HOLD_MS = 900;
const AUTO_PULL_GAP_MS = 700;
const BURST_COUNT = 460;
const FLIP_BURST = 140;
const LEGENDARY_BURST = 260;
const DECK_SIZE = 6;

let sparkles: Sparkles | null = null;
let queue: Promise<boolean> = Promise.resolve(true);

/** Resolves true once every card is pulled, false when the viewer closed the overlay before that. */
export function playReveal(cards: readonly RevealCard[], options: RevealOptions = {}): Promise<boolean> {
  queue = queue.then(() => run(cards, options.auto === true));
  return queue;
}

function centreOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function fade(overlay: HTMLElement, on: boolean, ms: number): Promise<void> {
  overlay.style.transitionDuration = `${String(ms)}ms`;
  overlay.getBoundingClientRect();
  overlay.classList.toggle("on", on);
  await sleep(ms);
}

async function run(cards: readonly RevealCard[], auto: boolean): Promise<boolean> {
  const overlay = required(document, "#reveal", HTMLElement);
  const stage = required(overlay, ".reveal-stage", HTMLElement);
  const deck = required(overlay, ".reveal-deck", HTMLElement);
  const slots = required(overlay, ".reveal-slots", HTMLElement);
  const hint = required(overlay, ".reveal-hint", HTMLElement);
  const fanEl = required(overlay, ".reveal-fan", HTMLElement);
  const close = required(overlay, ".reveal-close", HTMLButtonElement);
  sparkles ??= new Sparkles(required(overlay, ".reveal-sparks", HTMLCanvasElement));
  const sparks = sparkles;
  const reduced = reducedMotion();

  overlay.hidden = false;
  slots.innerHTML = cards.map((c) => slotMarkup(frontMarkup(c.card, c.reversed, true), false)).join("");
  const slotEls = [...slots.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
  for (const slot of slotEls) slot.classList.add("awaiting");
  slots.style.visibility = "hidden";
  hint.textContent = copy.fan.hint;
  close.textContent = copy.fan.close;

  let live = true;
  let pulled = 0;
  const settled: Promise<void>[] = [];
  let finish: (ok: boolean) => void = () => undefined;
  const outcome = new Promise<boolean>((resolve) => {
    finish = resolve;
  });

  // The slot's own card starts where the back left the fan and flies home; the back itself is already gone.
  const settle = async (index: number, from: PullPoint): Promise<void> => {
    const slot = slotEls[index];
    const drawn = cards[index];
    if (slot === undefined || drawn === undefined) return;
    const card = slot.querySelector(".card");
    if (!reduced) {
      const own = centreOf(slot);
      const scale = from.width / slot.getBoundingClientRect().width;
      const move = `translate(${String(from.x - own.x)}px, ${String(from.y - own.y)}px)`;
      slot.style.transform = `${move} rotate(${String(from.angle)}rad) scale(${String(scale)})`;
    }
    slot.classList.remove("awaiting");
    slot.getBoundingClientRect();
    slot.style.transform = "";
    if (reduced) {
      card?.classList.add("flipped");
      await sleep(REDUCED_FADE_MS);
      return;
    }
    await sleep(FLY_MS);
    if (!live) return;
    card?.classList.add("flipped");
    const legendary = drawn.card.arcana === "major" && drawn.reversed;
    const at = centreOf(slot);
    sparks.burst(at.x, at.y, legendary ? LEGENDARY_BURST : FLIP_BURST, legendary ? "red" : "gold", 0.7);
    if (legendary) shake(stage);
    await sleep(AFTER_FLIP_MS);
  };

  const fan = createCardFan(fanEl, cards.length, (from) => {
    const index = pulled++;
    settled.push(settle(index, from));
    if (pulled < cards.length) return;
    hint.hidden = true;
    close.hidden = true;
    void Promise.all(settled).then(() => {
      finish(true);
    });
  });
  const cancel = (): void => {
    finish(false);
  };
  close.addEventListener("click", cancel);

  if (reduced) {
    deck.hidden = true;
    await fade(overlay, true, REDUCED_FADE_MS);
  } else {
    sparks.fit();
    deck.hidden = false;
    deck.innerHTML = '<div class="deck-card"></div>'.repeat(DECK_SIZE);
    deck.classList.remove("shuffle");
    deck.getBoundingClientRect();
    deck.classList.add("shuffle");
    await fade(overlay, true, FADE_IN_MS);
    await sleep(Math.max(0, SHUFFLE_MS - FADE_IN_MS));
    const centre = centreOf(deck);
    deck.hidden = true;
    flash();
    ring();
    sparks.burst(centre.x, centre.y, BURST_COUNT, "gold");
  }
  slots.style.visibility = "";
  fanEl.hidden = false;
  hint.hidden = false;
  close.hidden = auto;
  await fan.spread();
  if (!auto) fanEl.focus({ preventScroll: true });

  const autoPulls = async (): Promise<void> => {
    for (let i = 0; i < cards.length && live; i++) {
      await sleep(AUTO_PULL_GAP_MS);
      await fan.autoPull();
    }
  };
  if (auto) void autoPulls();
  const ok = await outcome;
  live = false;
  close.removeEventListener("click", cancel);
  fan.dispose();

  if (ok) await sleep(reduced ? REDUCED_HOLD_MS : HOLD_MS);
  await fade(overlay, false, reduced ? REDUCED_FADE_MS : FADE_OUT_MS);
  sparks.clear();
  overlay.hidden = true;
  fanEl.hidden = true;
  hint.hidden = true;
  close.hidden = true;
  slots.replaceChildren();
  deck.replaceChildren();
  fanEl.replaceChildren();
  return ok;
}

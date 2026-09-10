/**
 * The loot-box in fullscreen: a stack of backs shuffles, bursts into sparks, three cards fly out of the centre and
 * flip one by one with a spark on each; a reversed major flips red and shakes the stage. Markup is in index.html,
 * the ring and flash live inside the overlay so they stay above the page. Reveals queue: two never overlap.
 * With reduced motion there are no particles and no flight: the cards fade in face up and fade out.
 */
import type { Card } from "../engine/v1/deck";
import { frontMarkup, slotMarkup } from "./card-face";
import { required } from "./dom-lookup";
import { Sparkles } from "./sparkles";
import { flash, reducedMotion, ring, shake, sleep } from "./stage-effects";

export interface RevealCard {
  card: Card;
  reversed: boolean;
}

const FADE_IN_MS = 200;
const SHUFFLE_MS = 420;
const FLY_MS = 560;
const FLY_STAGGER_MS = 90;
const BETWEEN_FLIPS_MS = 650;
const HOLD_MS = 500;
const FADE_OUT_MS = 400;
const REDUCED_FADE_MS = 150;
const REDUCED_HOLD_MS = 900;
const BURST_COUNT = 460;
const FLIP_BURST = 140;
const LEGENDARY_BURST = 260;
const DECK_SIZE = 6;

let sparkles: Sparkles | null = null;
let queue: Promise<void> = Promise.resolve();

export function playReveal(cards: readonly RevealCard[]): Promise<void> {
  queue = queue.then(() => run(cards));
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

async function run(cards: readonly RevealCard[]): Promise<void> {
  const overlay = required(document, "#reveal", HTMLElement);
  const stage = required(overlay, ".reveal-stage", HTMLElement);
  const deck = required(overlay, ".reveal-deck", HTMLElement);
  const slots = required(overlay, ".reveal-slots", HTMLElement);
  sparkles ??= new Sparkles(required(overlay, ".reveal-sparks", HTMLCanvasElement));

  overlay.hidden = false;
  slots.innerHTML = cards.map((c) => slotMarkup(frontMarkup(c.card, c.reversed, true), false)).join("");
  const slotEls = [...slots.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
  const cardEls = slotEls.map((slot) => slot.querySelector(".card"));

  if (reducedMotion()) {
    deck.hidden = true;
    for (const card of cardEls) card?.classList.add("flipped");
    await fade(overlay, true, REDUCED_FADE_MS);
    await sleep(REDUCED_HOLD_MS);
    await fade(overlay, false, REDUCED_FADE_MS);
  } else {
    sparkles.fit();
    deck.hidden = false;
    deck.innerHTML = '<div class="deck-card"></div>'.repeat(DECK_SIZE);
    deck.classList.remove("shuffle");
    deck.getBoundingClientRect();
    deck.classList.add("shuffle");
    slots.style.visibility = "hidden";
    await fade(overlay, true, FADE_IN_MS);
    await sleep(Math.max(0, SHUFFLE_MS - FADE_IN_MS));

    const centre = centreOf(deck);
    deck.hidden = true;
    flash();
    ring();
    sparkles.burst(centre.x, centre.y, BURST_COUNT, "gold");
    for (const slot of slotEls) {
      const own = centreOf(slot);
      slot.style.transform = `translate(${String(centre.x - own.x)}px, ${String(centre.y - own.y)}px) scale(0.5)`;
    }
    slots.style.visibility = "";
    slots.getBoundingClientRect();
    for (const [index, slot] of slotEls.entries()) {
      slot.style.transform = "";
      if (index < slotEls.length - 1) await sleep(FLY_STAGGER_MS);
    }
    await sleep(FLY_MS);

    for (const [index, slot] of slotEls.entries()) {
      const drawn = cards[index];
      if (drawn === undefined) break;
      cardEls[index]?.classList.add("flipped");
      const legendary = drawn.card.arcana === "major" && drawn.reversed;
      const at = centreOf(slot);
      sparkles.burst(at.x, at.y, legendary ? LEGENDARY_BURST : FLIP_BURST, legendary ? "red" : "gold", 0.7);
      if (legendary) shake(stage);
      await sleep(BETWEEN_FLIPS_MS);
    }
    await sleep(HOLD_MS);
    await fade(overlay, false, FADE_OUT_MS);
  }
  sparkles.clear();
  overlay.hidden = true;
  slots.replaceChildren();
  deck.replaceChildren();
}

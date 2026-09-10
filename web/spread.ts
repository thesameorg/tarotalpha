/**
 * Three card slots and the reveal from the prototype: fill the front, flip, shake the stage on a reversed major,
 * put the sentence under the card. The timings and the rarity frames are the approved visual, not tunables.
 */
import type { Card } from "../engine/v1/deck";
import type { DrawnCard } from "../engine/v1/draw-cards";
import type { StepResult } from "../engine/v1/index";
import { copy } from "./copy";
import { flash, ring, shake, sleep } from "./stage-effects";

export interface SpreadBlock {
  spread: HTMLElement;
  reading: HTMLElement;
}

export type CardLookup = (id: number) => Card;

const RING_MS = 350;
const BEFORE_FLIP_MS = 120;
const AFTER_FLIP_MS = 650;

export function slotMarkup(): string {
  return '<div class="slot empty"><div class="card"><div class="face back"></div><div class="face front"></div></div></div>';
}

export function resetBlock(block: SpreadBlock): void {
  block.spread.innerHTML = slotMarkup() + slotMarkup() + slotMarkup();
  block.reading.replaceChildren();
}

function fillFront(slot: Element, card: Card, reversed: boolean): void {
  const front = slot.querySelector(".front");
  if (front === null) return;
  const reversedTag = reversed ? `<div class="rev">${copy.reversed}</div>` : "";
  front.innerHTML = `<div class="num">${card.label}</div><div class="glyph">${card.glyph}</div><div><div class="name">${card.name}</div>${reversedTag}</div>`;
  front.classList.toggle("major", card.arcana === "major");
  front.classList.toggle("reversed", reversed);
  slot.classList.remove("empty");
}

function sentenceMarkup(card: Card, reversed: boolean, position: number, sentence: string): string {
  const title = `${card.name}${reversed ? `, ${copy.reversed}` : ""} · ${copy.positions[position] ?? ""}`;
  return `<p><b>${title}</b>${sentence}</p>`;
}

function slotsOf(block: SpreadBlock): Element[] {
  if (block.spread.children.length !== 3) resetBlock(block);
  return [...block.spread.children];
}

function drawn(step: StepResult, index: number): DrawnCard {
  const card = step.cards[index];
  if (card === undefined) throw new RangeError(`step ${String(step.step)} has no card ${String(index)}`);
  return card;
}

/** The loot-box sequence: ring, flash, then each card flips and its sentence appears under the spread. */
export async function revealStep(
  block: SpreadBlock,
  stage: HTMLElement,
  step: StepResult,
  cardById: CardLookup,
): Promise<void> {
  resetBlock(block);
  const slots = slotsOf(block);
  ring();
  await sleep(RING_MS);
  flash();
  for (const [index, slot] of slots.entries()) {
    const [id, reversedFlag] = drawn(step, index);
    const card = cardById(id);
    const reversed = reversedFlag === 1;
    fillFront(slot, card, reversed);
    await sleep(BEFORE_FLIP_MS);
    slot.querySelector(".card")?.classList.add("flipped");
    if (card.arcana === "major" && reversed) shake(stage);
    block.reading.insertAdjacentHTML(
      "beforeend",
      sentenceMarkup(card, reversed, index, step.interpretation[index] ?? ""),
    );
    await sleep(AFTER_FLIP_MS);
  }
}

/** The same step already open: cards face up, sentences in place, no theatre. */
export function showStep(block: SpreadBlock, step: StepResult, cardById: CardLookup): void {
  resetBlock(block);
  for (const [index, slot] of slotsOf(block).entries()) {
    const [id, reversedFlag] = drawn(step, index);
    const card = cardById(id);
    const reversed = reversedFlag === 1;
    fillFront(slot, card, reversed);
    slot.querySelector(".card")?.classList.add("flipped");
    block.reading.insertAdjacentHTML(
      "beforeend",
      sentenceMarkup(card, reversed, index, step.interpretation[index] ?? ""),
    );
  }
}

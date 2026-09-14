/**
 * One card as markup: the Rider-Waite picture fills the front, the name sits on a bottom gradient, a reversed card
 * shows its picture upside down with the label still upright. Rarity is the frame: gold for a major, red for a
 * reversed major. The back is the pattern from the prototype. Shared by the page row and the fullscreen reveal.
 */
import type { Card } from "../engine/deck";
import { cardImageUrl } from "./card-image";
import { t } from "./i18n/index";

export function frontMarkup(card: Card, reversed: boolean, eager: boolean): string {
  const classes = ["face", "front", card.arcana, reversed ? "reversed" : ""].join(" ").trim();
  const loading = eager ? "eager" : "lazy";
  const reversedTag = reversed ? `<div class="rev">${t().reversed}</div>` : "";
  return `<div class="${classes}"><img class="art" src="${cardImageUrl(card.id)}" alt="" loading="${loading}" decoding="async" draggable="false"><div class="caption"><div class="name">${t().cardName(card)}</div>${reversedTag}</div></div>`;
}

/** A slot: back, plus a front when given; `flipped` shows it at once. Face-down stays out of the accessibility
 * tree — the name sits in the markup from the start, and `reveal-overlay.ts` lifts the attribute with the flip. */
export function slotMarkup(front: string | null, flipped: boolean): string {
  const slotClass = front === null ? "slot empty" : "slot";
  const cardClass = flipped ? "card flipped" : "card";
  const muted = flipped ? "" : ' aria-hidden="true"';
  return `<div class="${slotClass}"><div class="${cardClass}"${muted}><div class="face back"></div>${front ?? ""}</div></div>`;
}

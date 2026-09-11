/**
 * The deck of backs fanned along the bottom of the reveal: all of it on a wide screen, and on a narrow one only as
 * many as keep a sliver of each back in sight, so a phone holds a hand instead of a solid band. Each back sits on an
 * arc around a pivot below the screen, and the fan closes the gap when one leaves. Pointer Events give mouse and
 * touch one path: a click or a tap pulls the back at once, pressing and dragging it up past the threshold pulls it
 * too, a drag released short of that snaps back; arrows move a highlight, Enter or Space pull it. Which back is
 * taken never matters: the caller maps the i-th pull to card i.
 */
import { DECK } from "../engine/deck";
import { reducedMotion, sleep } from "./stage-effects";

/** Where a back left the fan: its centre in viewport px, its tilt in radians and its CSS width, for the flight. */
export interface PullPoint {
  x: number;
  y: number;
  angle: number;
  width: number;
}

export interface CardFan {
  spread(): Promise<void>;
  /** Stops listening; the backs stay in place until the caller clears the root, so nothing pops before a fade. */
  dispose(): void;
}

interface Rest {
  x: number;
  y: number;
  angle: number;
}

interface Drag {
  el: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

const SPREAD_RAD = (50 * Math.PI) / 180;
const MIN_STEP_PX = 10;
const MAX_ARC_WIDTH = 900;
const EDGE_PAD = 12;
const TOP_PAD = 4;
const PULL_THRESHOLD_PX = 80;
const TAP_SLOP_PX = 6;
const PRESS_LIFT_PX = 12;
const SPREAD_MS = 500;
const BACK_MARKUP = '<div class="fan-card"><div class="fan-lift"><div class="face back"></div></div></div>';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const arcWidth = (width: number, cardW: number): number => Math.min(width - 2 * EDGE_PAD, MAX_ARC_WIDTH) - cardW;

// The whole deck while every back keeps MIN_STEP_PX of itself in view, fewer on a screen too narrow for that.
function handSize(width: number, cardW: number): number {
  return Math.max(2, Math.min(DECK.length, Math.floor(arcWidth(width, cardW) / MIN_STEP_PX) + 1));
}

// Spacing comes from the full hand, so a fan with fewer backs re-centres instead of stretching.
function layout(width: number, cardW: number, hand: number, count: number): Rest[] {
  const cardH = (cardW * 8) / 5;
  const spacing = arcWidth(width, cardW) / (hand - 1);
  const step = SPREAD_RAD / (hand - 1);
  const radius = spacing / step;
  const pivotY = TOP_PAD + cardH / 2 + radius;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i - (count - 1) / 2) * step;
    return { x: width / 2 + radius * Math.sin(angle), y: pivotY - radius * Math.cos(angle), angle };
  });
}

function tiltOf(el: HTMLElement): number {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return Math.atan2(m.b, m.a);
}

export function createCardFan(root: HTMLElement, limit: number, onPull: (from: PullPoint) => void): CardFan {
  const abort = new AbortController();
  const signal = abort.signal;
  let backs: HTMLElement[] = [];
  let rests: Rest[] = [];
  let cardW = 0;
  let hand = DECK.length;
  let pulls = 0;
  let drag: Drag | null = null;
  let focused = -1;

  const locked = (): boolean => pulls >= limit || signal.aborted;
  const middle = (): number => Math.floor((backs.length - 1) / 2);

  const place = (el: HTMLElement, rest: Rest, dx: number, dy: number, tilt: number): void => {
    const x = rest.x - cardW / 2 + dx;
    const y = rest.y - (cardW * 8) / 10 + dy;
    el.style.transform = `translate(${String(x)}px, ${String(y)}px) rotate(${String(rest.angle * tilt)}rad)`;
  };
  const settle = (index: number): void => {
    const el = backs[index];
    const rest = rests[index];
    if (el !== undefined && rest !== undefined) place(el, rest, 0, 0, 1);
  };
  const relayout = (): void => {
    rests = layout(root.clientWidth, cardW, hand, backs.length);
    for (let i = 0; i < backs.length; i++) settle(i);
  };
  const highlight = (): void => {
    backs.forEach((el, i) => {
      el.classList.toggle("focus", i === focused);
    });
  };

  const pull = (index: number): void => {
    const el = backs[index];
    if (el === undefined || locked()) return;
    pulls++;
    const rect = el.getBoundingClientRect();
    const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, angle: tiltOf(el), width: cardW };
    backs.splice(index, 1);
    el.remove();
    relayout();
    focused = Math.min(focused, backs.length - 1);
    highlight();
    onPull(from);
  };

  root.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || drag !== null || locked()) return;
      const el = event.target instanceof Element ? event.target.closest(".fan-card") : null;
      const index = el instanceof HTMLElement ? backs.indexOf(el) : -1;
      if (!(el instanceof HTMLElement) || index < 0) return;
      event.preventDefault();
      root.setPointerCapture(event.pointerId);
      drag = { el, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
      el.classList.add("dragging");
      const rest = rests[index];
      if (rest !== undefined) place(el, rest, 0, -PRESS_LIFT_PX, 1);
    },
    { signal },
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) drag.moved = true;
      const rest = rests[backs.indexOf(drag.el)];
      if (rest !== undefined) place(drag.el, rest, dx, dy - PRESS_LIFT_PX, 1 - clamp(-dy / PULL_THRESHOLD_PX, 0, 1));
    },
    { signal },
  );
  const release = (event: PointerEvent): void => {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    const { el, startY, moved } = drag;
    drag = null;
    el.classList.remove("dragging");
    const index = backs.indexOf(el);
    if (index < 0) return;
    const lift = startY - event.clientY;
    const aboveFan = event.clientY < root.getBoundingClientRect().top;
    const pulled = event.type === "pointerup" && (!moved || lift >= PULL_THRESHOLD_PX || aboveFan);
    if (pulled && !locked()) pull(index);
    else settle(index);
  };
  root.addEventListener("pointerup", release, { signal });
  root.addEventListener("pointercancel", release, { signal });
  root.addEventListener(
    "keydown",
    (event) => {
      if (drag !== null || locked()) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        root.classList.add("keys");
        const from = focused < 0 ? middle() : focused;
        focused = clamp(from + (event.key === "ArrowRight" ? 1 : -1), 0, backs.length - 1);
        highlight();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pull(focused < 0 ? middle() : focused);
      }
    },
    { signal },
  );
  window.addEventListener("resize", relayout, { signal });

  return {
    async spread() {
      root.innerHTML = BACK_MARKUP;
      cardW = root.firstElementChild instanceof HTMLElement ? root.firstElementChild.offsetWidth : 0;
      hand = handSize(root.clientWidth, cardW);
      root.innerHTML = BACK_MARKUP.repeat(hand);
      backs = [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
      root.classList.add("still");
      if (reducedMotion()) {
        relayout();
        return;
      }
      const stacked = layout(root.clientWidth, cardW, hand, 1)[0];
      if (stacked !== undefined) for (const el of backs) place(el, stacked, 0, 0, 1);
      root.getBoundingClientRect();
      root.classList.remove("still");
      root.classList.add("spreading");
      relayout();
      await sleep(SPREAD_MS);
      root.classList.remove("spreading");
    },
    dispose() {
      abort.abort();
      drag = null;
      root.classList.remove("keys", "still", "spreading");
    },
  };
}

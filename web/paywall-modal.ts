/**
 * The paywall: opens when the tank is short of the next day's mana and offers the packs of `web/mana.ts`. Every buy
 * button only toasts, there is no billing. Closes on the corner cross, the text link, a click outside or Escape.
 */
import { applyStatic, onLangChange, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { MANA_PACKS } from "./mana";
import { toast } from "./toast";

function modal(): HTMLElement {
  const el = document.getElementById("paywall");
  if (el === null) throw new Error("paywall modal: #paywall is missing");
  return el;
}

export function openPaywall(): void {
  modal().classList.add("on");
}

export function initPaywallModal(): void {
  const el = modal();
  const close = (): void => {
    el.classList.remove("on");
  };
  const corner = document.getElementById("closePayCorner");
  if (corner !== null) {
    setIcon(corner, icons.close, t().close);
    onLangChange(() => {
      setIcon(corner, icons.close, t().close);
    });
    corner.addEventListener("click", close);
  }
  document.getElementById("closePay")?.addEventListener("click", close);
  el.addEventListener("click", (event) => {
    if (event.target === el) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && el.classList.contains("on")) close();
  });
  const packs = document.getElementById("mana-packs");
  if (packs === null) return;
  packs.innerHTML = MANA_PACKS.map(
    (mana) =>
      `<div class="tier"><div class="t"><span class="mana-glyph">${icons.bolt}</span>${String(mana)}</div><button type="button" data-i18n="paywall.buy"></button></div>`,
  ).join("");
  applyStatic(packs);
  for (const button of packs.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      toast(t().paywall.meditating);
    });
  }
}

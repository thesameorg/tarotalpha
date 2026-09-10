/**
 * The paywall on the third step. Tiers are markup in index.html; every buy button only toasts, there is no billing.
 * Closes on the corner cross, the text link, a click outside or Escape.
 */
import { onLangChange, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
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
  for (const button of el.querySelectorAll(".tier button")) {
    button.addEventListener("click", () => {
      toast(t().paywall.meditating);
    });
  }
}

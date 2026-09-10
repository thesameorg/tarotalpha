/** The paywall after step three. Tiers are markup in index.html; every buy button only toasts, there is no billing. */
import { copy } from "./copy";
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
  document.getElementById("closePay")?.addEventListener("click", close);
  el.addEventListener("click", (event) => {
    if (event.target === el) close();
  });
  for (const button of el.querySelectorAll(".tier button")) {
    button.addEventListener("click", () => {
      toast(copy.paywall.meditating);
    });
  }
}

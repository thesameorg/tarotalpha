/** Prices as the terminal prints them: thousands grouped by the interface locale, two decimals above 10, four below. */
import { t } from "./i18n/index";

export function formatPrice(x: number): string {
  if (x >= 1000) return x.toLocaleString(t().locale, { maximumFractionDigits: 0 });
  if (x >= 10) return x.toFixed(2);
  return x.toFixed(4);
}

/** Price-scale step with the same number of decimals `formatPrice` shows around `x`. */
export function priceMinMove(x: number): number {
  if (x >= 1000) return 1;
  if (x >= 10) return 0.01;
  return 0.0001;
}

/** Signed to two decimals. The sign follows the printed number, so a move too small to show never reads as "-0.00". */
export function formatPercent(pct: number): string {
  const shown = Number(pct.toFixed(2));
  return `${shown >= 0 ? "+" : ""}${shown.toFixed(2)} %`;
}

export function formatChange(pct: number): string {
  return `${formatPercent(pct)} ${t().per24h}`;
}

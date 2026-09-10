/** Prices as the prototype prints them: thousands with a space, two decimals above 10, four below. */
export function formatPrice(x: number): string {
  if (x >= 1000) return x.toLocaleString("ru", { maximumFractionDigits: 0 });
  if (x >= 10) return x.toFixed(2);
  return x.toFixed(4);
}

/** Price-scale step with the same number of decimals `formatPrice` shows around `x`. */
export function priceMinMove(x: number): number {
  if (x >= 1000) return 1;
  if (x >= 10) return 0.01;
  return 0.0001;
}

export function formatChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} % / 24ч`;
}

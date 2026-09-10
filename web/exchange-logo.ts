/** The candle source in the price row is a logo from /exchanges, named in the tooltip; no source, no logo. */
import type { Source } from "../exchange/provider";
import { copy } from "./copy";

export function showExchangeLogo(img: HTMLImageElement, source: Source | null): void {
  img.hidden = source === null;
  if (source === null) return;
  const name = copy.sources[source];
  img.src = `/exchanges/${source}.svg`;
  img.alt = name;
  img.title = name;
}

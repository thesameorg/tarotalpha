/** Header and footer facts that change with the loaded reading: exchange lag, engine version, candle source. */
import type { Source } from "../exchange/provider";
import { copy } from "./copy";

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el !== null) el.textContent = text;
}

export function setLag(ms: number | null): void {
  setText("lag", ms === null ? "—" : `${String(ms)} мс`);
}

export function setEngineVersion(version: string): void {
  setText("engine", version);
}

export function setSource(source: Source | null): void {
  setText("footer-source", source === null ? "—" : copy.sources[source]);
}

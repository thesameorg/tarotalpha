/**
 * The theme's colours for the canvas: the chart, the forecast zone and the anchor pulse cannot read CSS variables
 * themselves, so this reads them from <html> once per theme and hands out the same object until the theme changes.
 */
import { onThemeChange } from "./theme";

export interface Palette {
  bg: string;
  line: string;
  grid: string;
  text: string;
  up: string;
  down: string;
  forecastUp: string;
  forecastDown: string;
  crosshair: string;
  zoneTint: string;
  zoneLine: string;
  gold: string;
  goldRgb: string;
}

let cached: Palette | null = null;
onThemeChange(() => {
  cached = null;
});

export function palette(): Palette {
  if (cached !== null) return cached;
  const style = getComputedStyle(document.documentElement);
  const v = (name: string): string => style.getPropertyValue(name).trim();
  cached = {
    bg: v("--ink-2"),
    line: v("--line"),
    grid: v("--grid"),
    text: v("--paper-dim"),
    up: v("--up"),
    down: v("--down"),
    forecastUp: v("--forecast-up"),
    forecastDown: v("--forecast-down"),
    crosshair: v("--crosshair"),
    zoneTint: v("--zone-tint"),
    zoneLine: v("--zone-line"),
    gold: v("--gold"),
    goldRgb: v("--gold-rgb"),
  };
  return cached;
}

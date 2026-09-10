/**
 * The terminal chart on Lightweight Charts: real candles that draw in left to right, forecast candles that flow
 * in one at a time, hollow real candles over the forecast for the prophecy check, plus the forecast zone and the
 * anchor pulse as series primitives. Colours come from the theme's CSS variables and are re-applied on a theme
 * switch; the locale follows the interface language. The library has no timezone, so candle times are shifted by
 * the viewer's offset before they go in: day ticks then land on local midnight and labels read as local wall clock.
 * The frame is fixed around the anchor: 72 real candles on the left, room for the three forecast days on the right.
 */
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  TickMarkType,
  type CandlestickData,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type TimeChartOptions,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../engine/atr";
import { AnchorPulse } from "./anchor-pulse";
import { ForecastZone } from "./forecast-zone";
import { onLangChange, t } from "./i18n/index";
import { localOffsetMs } from "./local-time-format";
import { palette, type Palette } from "./palette";
import { formatPrice, priceMinMove } from "./price-format";
import { reducedMotion } from "./stage-effects";
import { onThemeChange } from "./theme";

const CANDLES_PER_DAY = 24;
const FORECAST_DAYS = 3;
const DRAW_MS_PER_CANDLE = 10;
const REAL_VISIBLE = 72;
const MIN_REAL_VISIBLE = 24;
const FUTURE_VISIBLE = FORECAST_DAYS * CANDLES_PER_DAY + 3;
const PX_PER_BAR = 4.5;
const TRANSPARENT = "rgba(0,0,0,0)";

type Bar = CandlestickData;

export interface CandleChart {
  showSnapshot(candles: readonly Candle[], animate: boolean): Promise<void>;
  setSteps(count: number): void;
  appendForecast(candle: Candle): void;
  setForecast(candles: readonly Candle[]): void;
  setActual(candles: readonly Candle[]): void;
  remove(): void;
}

// A candle the draw-in has not reached yet stays in the data as a transparent bar: whitespace would leave the time
// scale without a base index, and the frame around the anchor could not hold until the last candle was in.
const toHidden = (bar: Bar): Bar => ({ ...bar, color: TRANSPARENT, borderColor: TRANSPARENT, wickColor: TRANSPARENT });

// Shifted times are "UTC" to the library, so ISO slices of them read as the viewer's wall clock.
const clock = (ms: number): string => new Date(ms).toISOString().slice(11, 16);
const monthDay = (ms: number): string => new Date(ms).toISOString().slice(5, 10);

function tickMark(time: Time, type: TickMarkType): string {
  if (typeof time !== "number") return "";
  const ms = time * 1000;
  return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds ? clock(ms) : monthDay(ms);
}

function crosshairLabel(time: Time): string {
  if (typeof time !== "number") return "";
  const ms = time * 1000;
  return `${monthDay(ms)} ${clock(ms)}`;
}

function colours(p: Palette): DeepPartial<TimeChartOptions> {
  return {
    layout: { background: { type: ColorType.Solid, color: p.bg }, textColor: p.text },
    grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
    crosshair: {
      vertLine: { color: p.crosshair, labelBackgroundColor: p.line },
      horzLine: { color: p.crosshair, labelBackgroundColor: p.line },
    },
    rightPriceScale: { borderColor: p.line },
    timeScale: { borderColor: p.line },
  };
}

function localization(): DeepPartial<TimeChartOptions> {
  return { localization: { locale: t().locale, priceFormatter: formatPrice, timeFormatter: crosshairLabel } };
}

const realColours = (p: Palette) => ({
  upColor: p.up,
  downColor: p.down,
  wickUpColor: p.up,
  wickDownColor: p.down,
  priceLineColor: p.line,
});
const forecastColours = (p: Palette) => ({
  upColor: p.forecastUp,
  downColor: p.forecastDown,
  wickUpColor: p.forecastUp,
  wickDownColor: p.forecastDown,
});
const actualColours = (p: Palette) => ({
  borderUpColor: p.up,
  borderDownColor: p.down,
  wickUpColor: p.up,
  wickDownColor: p.down,
});

export function createCandleChart(container: HTMLElement): CandleChart {
  const p = palette();
  const chart: IChartApi = createChart(container, {
    autoSize: true,
    ...colours(p),
    ...localization(),
    layout: {
      background: { type: ColorType.Solid, color: p.bg },
      textColor: p.text,
      fontFamily: getComputedStyle(document.body).getPropertyValue("--mono"),
      fontSize: 11,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: p.crosshair, labelBackgroundColor: p.line },
      horzLine: { color: p.crosshair, labelBackgroundColor: p.line },
    },
    rightPriceScale: { borderColor: p.line, scaleMargins: { top: 0.12, bottom: 0.14 } },
    timeScale: {
      borderColor: p.line,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 0,
      shiftVisibleRangeOnNewBar: false,
      tickMarkFormatter: tickMark,
    },
    handleScroll: { vertTouchDrag: false },
  });

  const real = chart.addSeries(CandlestickSeries, { ...realColours(p), borderVisible: false });
  const forecast = chart.addSeries(CandlestickSeries, {
    ...forecastColours(p),
    borderVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  // Hollow bodies with solid outlines: what really happened, drawn over the pale forecast.
  const actual = chart.addSeries(CandlestickSeries, {
    ...actualColours(p),
    upColor: TRANSPARENT,
    downColor: TRANSPARENT,
    borderVisible: true,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const zone = new ForecastZone();
  const pulse = new AnchorPulse();
  real.attachPrimitive(zone);
  real.attachPrimitive(pulse);

  const retheme = (): void => {
    const next = palette();
    chart.applyOptions(colours(next));
    real.applyOptions(realColours(next));
    forecast.applyOptions(forecastColours(next));
    actual.applyOptions(actualColours(next));
  };
  const relocale = (): void => {
    chart.applyOptions(localization());
  };
  const unsubscribeTheme = onThemeChange(retheme);
  const unsubscribeLang = onLangChange(relocale);

  let anchor: UTCTimestamp | null = null;
  let snapshotLength = 0;
  let generation = 0;
  // One offset per snapshot, taken at the anchor: a per-candle offset could double a time across a DST switch.
  let offsetMs = 0;
  const toTime = (ms: number): UTCTimestamp => Math.floor((ms + offsetMs) / 1000) as UTCTimestamp;
  const toBar = (c: Candle): Bar => ({ time: toTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c });

  const applyPriceFormat = (lastClose: number): void => {
    const priceFormat = { type: "custom" as const, formatter: formatPrice, minMove: priceMinMove(lastClose) };
    for (const series of [real, forecast, actual]) series.applyOptions({ priceFormat });
  };

  // Frame: the anchor near the middle, 72 real candles left of it (fewer on a narrow screen), all three days right.
  const frame = (): void => {
    if (snapshotLength === 0) return;
    const anchorIndex = snapshotLength - 1;
    const fits = Math.floor(chart.timeScale().width() / PX_PER_BAR) - FUTURE_VISIBLE;
    const visibleReal = Math.min(REAL_VISIBLE, Math.max(MIN_REAL_VISIBLE, fits));
    chart.timeScale().setVisibleLogicalRange({
      from: anchorIndex - visibleReal + 0.5,
      to: anchorIndex + FUTURE_VISIBLE + 0.5,
    });
  };

  let lastWidth = container.clientWidth;
  const observer = new ResizeObserver(() => {
    if (container.clientWidth === lastWidth) return;
    lastWidth = container.clientWidth;
    frame();
  });
  observer.observe(container);

  const drawIn = (bars: Bar[], mine: number): Promise<void> =>
    new Promise((resolve) => {
      const start = performance.now();
      const tick = (now: number): void => {
        if (mine !== generation) {
          resolve();
          return;
        }
        const shown = Math.min(bars.length, Math.floor((now - start) / DRAW_MS_PER_CANDLE) + 1);
        real.setData([...bars.slice(0, shown), ...bars.slice(shown).map(toHidden)]);
        if (shown < bars.length) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  const seriesSetter =
    (series: ISeriesApi<"Candlestick">) =>
    (candles: readonly Candle[]): void => {
      series.setData(candles.map(toBar));
    };

  return {
    async showSnapshot(candles, animate) {
      const mine = ++generation;
      const last = candles[candles.length - 1];
      if (last === undefined) return;
      snapshotLength = candles.length;
      offsetMs = localOffsetMs(last.t);
      anchor = toTime(last.t);
      forecast.setData([]);
      actual.setData([]);
      pulse.setPoint(null);
      zone.setAnchor(anchor, 0);
      applyPriceFormat(last.c);
      const bars = candles.map(toBar);
      if (!animate || reducedMotion()) {
        real.setData(bars);
        frame();
      } else {
        real.setData(bars.map(toHidden));
        frame();
        await drawIn(bars, mine);
        if (mine !== generation) return;
      }
      pulse.setPoint({ time: anchor, price: last.c });
    },
    setSteps(count) {
      zone.setAnchor(anchor, count);
      frame();
    },
    appendForecast(candle) {
      forecast.update(toBar(candle));
    },
    setForecast: seriesSetter(forecast),
    setActual: seriesSetter(actual),
    remove() {
      generation++;
      unsubscribeTheme();
      unsubscribeLang();
      observer.disconnect();
      real.detachPrimitive(pulse);
      real.detachPrimitive(zone);
      chart.remove();
    },
  };
}

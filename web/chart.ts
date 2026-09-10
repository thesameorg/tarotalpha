/**
 * The terminal chart on Lightweight Charts: real candles that draw in left to right, forecast candles that flow
 * in one at a time, hollow real candles over the forecast for the prophecy check, plus the forecast zone and the
 * anchor pulse as series primitives. Candle times go in as ms and out as UTC seconds: the library has no
 * timezone, which is exactly the terminal look the product wants.
 */
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  TickMarkType,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts";
import type { Candle } from "../engine/v1/atr";
import { AnchorPulse } from "./anchor-pulse";
import { ForecastZone } from "./forecast-zone";
import { formatPrice, priceMinMove } from "./price-format";
import { reducedMotion } from "./stage-effects";
import { utcMonthDay, utcTime } from "./utc-format";

const INK_2 = "#1e2130";
const LINE = "#33384d";
const GRID = "#2a2e40";
const PAPER_DIM = "#9d9887";
const UP = "#4fbf8b";
const DOWN = "#e05c62";
const FORECAST_UP = "rgba(121,214,168,.85)";
const FORECAST_DOWN = "rgba(240,138,143,.85)";
const CROSSHAIR = "#5a5f78";
const CANDLES_PER_DAY = 24;
const DRAW_MS_PER_CANDLE = 10;
const MAX_REAL_VISIBLE = 96;
const MIN_REAL_VISIBLE = 24;
const PX_PER_BAR = 4.5;

type Bar = CandlestickData;

export interface CandleChart {
  showSnapshot(candles: readonly Candle[], animate: boolean): Promise<void>;
  setSteps(count: number): void;
  appendForecast(candle: Candle): void;
  setForecast(candles: readonly Candle[]): void;
  setActual(candles: readonly Candle[]): void;
  remove(): void;
}

const toTime = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;
const toBar = (c: Candle): Bar => ({ time: toTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c });
const toWhitespace = (bar: Bar): WhitespaceData => ({ time: bar.time });

function tickMark(time: Time, type: TickMarkType): string {
  if (typeof time !== "number") return "";
  const ms = time * 1000;
  return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds ? utcTime(ms) : utcMonthDay(ms);
}

function crosshairLabel(time: Time): string {
  if (typeof time !== "number") return "";
  const ms = time * 1000;
  return `${utcMonthDay(ms)} ${utcTime(ms)}`;
}

export function createCandleChart(container: HTMLElement): CandleChart {
  const chart: IChartApi = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: INK_2 },
      textColor: PAPER_DIM,
      fontFamily: getComputedStyle(document.body).getPropertyValue("--mono"),
      fontSize: 11,
    },
    grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: CROSSHAIR, labelBackgroundColor: LINE },
      horzLine: { color: CROSSHAIR, labelBackgroundColor: LINE },
    },
    rightPriceScale: { borderColor: LINE, scaleMargins: { top: 0.12, bottom: 0.14 } },
    timeScale: {
      borderColor: LINE,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 0,
      tickMarkFormatter: tickMark,
    },
    localization: { locale: "ru", priceFormatter: formatPrice, timeFormatter: crosshairLabel },
    handleScroll: { vertTouchDrag: false },
  });

  const real = chart.addSeries(CandlestickSeries, {
    upColor: UP,
    downColor: DOWN,
    borderVisible: false,
    wickUpColor: UP,
    wickDownColor: DOWN,
    priceLineColor: LINE,
  });
  const forecast = chart.addSeries(CandlestickSeries, {
    upColor: FORECAST_UP,
    downColor: FORECAST_DOWN,
    borderVisible: false,
    wickUpColor: FORECAST_UP,
    wickDownColor: FORECAST_DOWN,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  // Hollow bodies with solid outlines: what really happened, drawn over the pale forecast.
  const actual = chart.addSeries(CandlestickSeries, {
    upColor: "rgba(0,0,0,0)",
    downColor: "rgba(0,0,0,0)",
    borderVisible: true,
    borderUpColor: UP,
    borderDownColor: DOWN,
    wickUpColor: UP,
    wickDownColor: DOWN,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const zone = new ForecastZone();
  const pulse = new AnchorPulse();
  real.attachPrimitive(zone);
  real.attachPrimitive(pulse);

  let anchor: UTCTimestamp | null = null;
  let snapshotLength = 0;
  let steps = 0;
  let generation = 0;

  const applyPriceFormat = (lastClose: number): void => {
    const priceFormat = { type: "custom" as const, formatter: formatPrice, minMove: priceMinMove(lastClose) };
    for (const series of [real, forecast, actual]) series.applyOptions({ priceFormat });
  };

  // Frame: as many real candles as fit at a readable bar width, then room for every day opened so far.
  const frame = (): void => {
    if (snapshotLength === 0) return;
    const anchorIndex = snapshotLength - 1;
    const future = Math.max(1, steps) * CANDLES_PER_DAY + 3;
    const fits = Math.floor(chart.timeScale().width() / PX_PER_BAR) - future;
    const visibleReal = Math.min(MAX_REAL_VISIBLE, Math.max(MIN_REAL_VISIBLE, fits));
    chart.timeScale().setVisibleLogicalRange({ from: anchorIndex - visibleReal + 0.5, to: anchorIndex + future + 0.5 });
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
        real.setData([...bars.slice(0, shown), ...bars.slice(shown).map(toWhitespace)]);
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
      anchor = toTime(last.t);
      steps = 0;
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
        real.setData(bars.map(toWhitespace));
        frame();
        await drawIn(bars, mine);
        if (mine !== generation) return;
      }
      pulse.setPoint({ time: anchor, price: last.c });
    },
    setSteps(count) {
      steps = count;
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
      observer.disconnect();
      real.detachPrimitive(pulse);
      real.detachPrimitive(zone);
      chart.remove();
    },
  };
}

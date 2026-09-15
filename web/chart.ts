/**
 * The terminal chart on Lightweight Charts: real candles that draw in left to right, hollow forecast candles
 * in cyan and pink that flow in one at a time, solid real candles over them for the prophecy check, plus the
 * forecast zone, the band between the two sets of closes and the anchor pulse as series primitives. Colours come
 * from the theme's CSS variables and are re-applied on a theme switch; the locale follows the interface language.
 * The library has no timezone, so candle times are shifted by the viewer's offset before they go in: day ticks
 * then land on local midnight and labels read as local wall clock. The frame holds around the anchor: 72 real
 * candles on the left, on the right three days or one past the open ones. Dragged left of the snapshot, the chart
 * pulls earlier candles from the exchange: that past is drawn only, it never reaches the engine or a stored reading.
 */
import {
  CandlestickSeries,
  LineSeries,
  ColorType,
  createChart,
  CrosshairMode,
  TickMarkType,
  type CandlestickData,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type LogicalRange,
  type TimeChartOptions,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../engine/atr";
import { CANDLES_PER_STEP, MAX_STEPS } from "../engine/index";
import type { ReaderId } from "../engine/readers";
import { AnchorPulse } from "./anchor-pulse";
import { DeviationRibbon, type DeviationPair } from "./deviation-ribbon";
import { ForecastZone, type ZoneLayout } from "./forecast-zone";
import { onLangChange, t } from "./i18n/index";
import { localOffsetMs } from "./local-time-format";
import { palette, type Palette } from "./palette";
import { formatPrice, priceMinMove } from "./price-format";
import { PriceOverlay } from "./price-overlay";
import { reducedMotion } from "./stage-effects";
import { onThemeChange } from "./theme";

const MIN_FORECAST_DAYS = 3;
const DRAW_MS_PER_CANDLE = 10;
// A bought line draws in over this long whatever the horizon: one day and seven days both deserve the moment.
const OPINION_DRAW_MS = 800;
// Below this the native price scale costs a quarter of the width, and prices move over the candles (price-overlay.ts).
const OVERLAY_PRICES = "(max-width: 640px)";
const REAL_VISIBLE = 72;
const MIN_REAL_VISIBLE = 24;
const PX_PER_BAR = 4.5;
// The past comes a week at a time, and the pull starts a dozen candles before the edge, so the bars are already
// there when the drag reaches them.
const HISTORY_CHUNK = 168;
const HISTORY_EDGE = 12;
const TRANSPARENT = "rgba(0,0,0,0)";

type Bar = CandlestickData;

// The next day always has an empty slot to stand in until the horizon; three days at least, so the frame starts wide.
const futureVisible = (steps: number): number =>
  Math.min(MAX_STEPS, Math.max(MIN_FORECAST_DAYS, steps + 1)) * CANDLES_PER_STEP + 3;

/** Ascending 1H candles ending before `beforeMs`, at most `limit`; an empty list when the exchange has no more. */
export type HistorySource = (beforeMs: number, limit: number) => Promise<readonly Candle[]>;

export interface CandleChart {
  showSnapshot(candles: readonly Candle[], animate: boolean): Promise<void>;
  /** Where the chart takes its past when the viewer drags left of the snapshot; it is asked about that snapshot's
   *  own candles, so it is set beside it. Without a source the chart stops at the snapshot's left edge. */
  setHistorySource(load: HistorySource | null): void;
  setSteps(count: number): void;
  appendForecast(candle: Candle): void;
  setForecast(candles: readonly Candle[]): void;
  setActual(candles: readonly Candle[]): void;
  /** One thin line of closes per reader asked besides the author, in her own colour; drawn over the same hours as
   *  the forecast. Readers left out of the map lose their line. */
  setOpinions(opinions: ReadonlyMap<ReaderId, readonly Candle[]>): void;
  /** Draws one reader's line in left to right, the way a bought opinion arrives; at once under reduced motion.
   *  A later `setOpinions` overtakes it: the last writer of a line owns it, and the drawing stops where it is. */
  drawOpinion(id: ReaderId, candles: readonly Candle[]): Promise<void>;
  /** Hears the forecast zone's pixel layout on every viewport change; the listener lives as long as the chart. */
  onZoneLayout(listener: (layout: ZoneLayout | null) => void): void;
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
// Hollow, and in colours the market never uses: an invented candle should look invented and never pass for a
// real one. Reality, historical or verified, is always solid green and red.
const forecastColours = (p: Palette) => ({
  upColor: TRANSPARENT,
  downColor: TRANSPARENT,
  borderUpColor: p.forecastUp,
  borderDownColor: p.forecastDown,
  wickUpColor: p.forecastUp,
  wickDownColor: p.forecastDown,
});
// Thin, so the author's candles stay the subject and the second opinions fan out behind them.
const opinionColours = (p: Palette, id: ReaderId) => ({ color: p.readers[id], lineWidth: 1 as const });
const actualColours = (p: Palette) => ({
  upColor: p.up,
  downColor: p.down,
  wickUpColor: p.up,
  wickDownColor: p.down,
});

export function createCandleChart(container: HTMLElement, anchorWord?: () => string): CandleChart {
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
    borderVisible: true,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  // Solid, exactly like the history to its left: what really happened, drawn over the hollow forecast.
  const actual = chart.addSeries(CandlestickSeries, {
    ...actualColours(p),
    borderVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const zone = new ForecastZone(anchorWord);
  const ribbon = new DeviationRibbon();
  const pulse = new AnchorPulse();
  real.attachPrimitive(zone);
  real.attachPrimitive(ribbon);
  real.attachPrimitive(pulse);

  // A narrow screen keeps the prices and loses the column they stood in; the grid goes with the scale, because the
  // overlay draws a line under every price it writes and two sets of them would not agree.
  const narrow = window.matchMedia(OVERLAY_PRICES);
  const overlay = new PriceOverlay();
  let overlaid = false;
  const fitPrices = (): void => {
    if (narrow.matches === overlaid) return;
    overlaid = narrow.matches;
    chart.applyOptions({
      rightPriceScale: { visible: !overlaid },
      grid: { horzLines: { visible: !overlaid } },
    });
    if (overlaid) real.attachPrimitive(overlay);
    else real.detachPrimitive(overlay);
  };
  fitPrices();
  narrow.addEventListener("change", fitPrices);

  const retheme = (): void => {
    const next = palette();
    chart.applyOptions(colours(next));
    real.applyOptions(realColours(next));
    forecast.applyOptions(forecastColours(next));
    actual.applyOptions(actualColours(next));
    for (const [id, line] of opinionLines) line.applyOptions(opinionColours(next, id));
  };
  const relocale = (): void => {
    chart.applyOptions(localization());
  };
  const unsubscribeTheme = onThemeChange(retheme);
  const unsubscribeLang = onLangChange(relocale);

  let anchor: UTCTimestamp | null = null;
  let snapshotBars: Bar[] = [];
  // Earlier candles pulled in on a drag; they stand left of the snapshot and belong to no reading.
  let historyBars: Bar[] = [];
  let oldestMs = 0;
  let historySource: HistorySource | null = null;
  let pulling = false;
  let pastEnded = false;
  // Fresh data starts out fully in view, edge and all, and that is the library's layout rather than anybody's drag.
  let framed = false;
  let future = futureVisible(0);
  let generation = 0;
  // One offset per snapshot, taken at the anchor: a per-candle offset could double a time across a DST switch.
  let offsetMs = 0;
  const toTime = (ms: number): UTCTimestamp => Math.floor((ms + offsetMs) / 1000) as UTCTimestamp;
  const toBar = (c: Candle): Bar => ({ time: toTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c });

  const applyPriceFormat = (lastClose: number): void => {
    const priceFormat = { type: "custom" as const, formatter: formatPrice, minMove: priceMinMove(lastClose) };
    for (const series of [real, forecast, actual]) series.applyOptions({ priceFormat });
  };

  // Frame: the anchor near the middle, 72 real candles left of it (fewer on a narrow screen), the forecast days right.
  const frame = (): void => {
    if (snapshotBars.length === 0) return;
    const anchorIndex = historyBars.length + snapshotBars.length - 1;
    const fits = Math.floor(chart.timeScale().width() / PX_PER_BAR) - future;
    const visibleReal = Math.min(REAL_VISIBLE, Math.max(MIN_REAL_VISIBLE, fits));
    chart.timeScale().setVisibleLogicalRange({
      from: anchorIndex - visibleReal + 0.5,
      to: anchorIndex + future + 0.5,
    });
    framed = true;
  };

  let lastWidth = container.clientWidth;
  const observer = new ResizeObserver(() => {
    if (container.clientWidth === lastWidth) return;
    lastWidth = container.clientWidth;
    frame();
  });
  observer.observe(container);

  const pullHistory = (): void => {
    if (historySource === null || pulling || pastEnded || !framed) return;
    pulling = true;
    const mine = generation;
    void historySource(oldestMs, HISTORY_CHUNK)
      .then((candles) => {
        const first = candles[0];
        if (mine !== generation) return;
        if (first === undefined) {
          pastEnded = true;
          return;
        }
        oldestMs = first.t;
        const held = chart.timeScale().getVisibleLogicalRange();
        historyBars = [...candles.map(toBar), ...historyBars];
        real.setData([...historyBars, ...snapshotBars]);
        // Bars are numbered from the left and the view is held by number, so without the shift the chart would
        // jump a chunk deeper into the past under the viewer's finger.
        if (held !== null) {
          const shift = candles.length;
          chart.timeScale().setVisibleLogicalRange({ from: held.from + shift, to: held.to + shift });
        }
      })
      .catch(() => {
        // The exchange refused; every further drag would ask again and hammer it, so the past ends here.
        pastEnded = true;
      })
      .finally(() => {
        pulling = false;
      });
  };

  const onRange = (range: LogicalRange | null): void => {
    if (range !== null && range.from <= HISTORY_EDGE) pullHistory();
  };
  chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

  const drawIn = (bars: Bar[], mine: number): Promise<void> =>
    new Promise((resolve) => {
      const start = performance.now();
      const tick = (now: number): void => {
        if (mine !== generation) {
          resolve();
          return;
        }
        const shown = Math.min(bars.length, Math.floor((now - start) / DRAW_MS_PER_CANDLE) + 1);
        real.setData([...historyBars, ...bars.slice(0, shown), ...bars.slice(shown).map(toHidden)]);
        if (shown < bars.length) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  let forecastCandles: Candle[] = [];
  let actualCandles: readonly Candle[] = [];
  // Lines, not candles: five sets of bars on the same hour are unreadable, five lines fan out.
  const opinionLines = new Map<ReaderId, ISeriesApi<"Line">>();
  // Every write to the lines takes a turn, so a drawing that was overtaken can tell and stop instead of fighting.
  let opinionTurn = 0;
  const toPoint = (candle: Candle): { time: UTCTimestamp; value: number } => ({
    time: toTime(candle.t),
    value: candle.c,
  });
  const lineFor = (id: ReaderId): ISeriesApi<"Line"> => {
    let line = opinionLines.get(id);
    if (line === undefined) {
      line = chart.addSeries(LineSeries, { ...opinionColours(palette(), id), priceLineVisible: false });
      opinionLines.set(id, line);
    }
    return line;
  };

  // The band is a function of both sets of candles, so every write to either of them recomputes the pairs.
  const syncRibbon = (): void => {
    const realByTime = new Map(actualCandles.map((candle) => [candle.t, candle.c]));
    const pairs: DeviationPair[] = [];
    for (const candle of forecastCandles) {
      const close = realByTime.get(candle.t);
      if (close !== undefined) pairs.push({ time: toTime(candle.t), forecast: candle.c, real: close });
    }
    ribbon.setPairs(pairs);
  };

  return {
    async showSnapshot(candles, animate) {
      const mine = ++generation;
      const last = candles[candles.length - 1];
      if (last === undefined) return;
      // A new snapshot is a new instrument or a new anchor: the past drawn for the old one says nothing here.
      historyBars = [];
      pastEnded = false;
      framed = false;
      oldestMs = candles[0]?.t ?? last.t;
      offsetMs = localOffsetMs(last.t);
      anchor = toTime(last.t);
      forecast.setData([]);
      actual.setData([]);
      // A new snapshot is a new reading: opinions bought about the old one say nothing about these candles.
      for (const line of opinionLines.values()) chart.removeSeries(line);
      opinionLines.clear();
      forecastCandles = [];
      actualCandles = [];
      syncRibbon();
      pulse.setPoint(null);
      zone.setAnchor(anchor, 0);
      future = futureVisible(0);
      applyPriceFormat(last.c);
      const bars = candles.map(toBar);
      snapshotBars = bars;
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
    setHistorySource(load) {
      historySource = load;
    },
    setSteps(count) {
      zone.setAnchor(anchor, count);
      future = futureVisible(count);
      frame();
    },
    appendForecast(candle) {
      forecast.update(toBar(candle));
      forecastCandles.push(candle);
      syncRibbon();
    },
    setForecast(candles) {
      forecast.setData(candles.map(toBar));
      forecastCandles = [...candles];
      syncRibbon();
    },
    setActual(candles) {
      actual.setData(candles.map(toBar));
      actualCandles = candles;
      syncRibbon();
    },
    setOpinions(opinions) {
      opinionTurn++;
      for (const [id, line] of opinionLines) {
        if (opinions.has(id)) continue;
        chart.removeSeries(line);
        opinionLines.delete(id);
      }
      for (const [id, candles] of opinions) lineFor(id).setData(candles.map(toPoint));
    },
    async drawOpinion(id, candles) {
      const line = lineFor(id);
      const points = candles.map(toPoint);
      if (reducedMotion()) {
        line.setData(points);
        return;
      }
      const mine = generation;
      const turn = ++opinionTurn;
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          // A new snapshot takes the line away under us, and writing to a removed series throws; a newer write to
          // the lines knows more than this drawing does, and the drawing gives way to it.
          if (mine !== generation || opinionTurn !== turn || opinionLines.get(id) !== line) {
            resolve();
            return;
          }
          const grown = Math.ceil(((now - start) / OPINION_DRAW_MS) * points.length);
          const shown = Math.min(points.length, Math.max(1, grown));
          line.setData(points.slice(0, shown));
          if (shown < points.length) requestAnimationFrame(tick);
          else resolve();
        };
        const start = performance.now();
        requestAnimationFrame(tick);
      });
    },
    onZoneLayout(listener) {
      zone.onLayout(listener);
    },
    remove() {
      generation++;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      unsubscribeTheme();
      unsubscribeLang();
      narrow.removeEventListener("change", fitPrices);
      observer.disconnect();
      zone.onLayout(null);
      if (overlaid) real.detachPrimitive(overlay);
      real.detachPrimitive(pulse);
      real.detachPrimitive(ribbon);
      real.detachPrimitive(zone);
      chart.remove();
    },
  };
}

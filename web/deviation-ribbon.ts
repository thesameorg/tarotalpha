/**
 * Series primitive that fills the gap between the forecast closes and the real ones: the wider the band, the further
 * the reading ran from the market. Candles are paired by time, and a missing hour breaks the band in two rather than
 * being drawn across, so a hole in exchange data cannot pass for a match. What the number under the chart means:
 * ../docs/engine.md
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  UTCTimestamp,
} from "lightweight-charts";
import { palette } from "./palette";

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

const HOUR_S = 3600;

export interface DeviationPair {
  time: UTCTimestamp;
  forecast: number;
  real: number;
}

interface Point {
  x: number;
  forecastY: number;
  realY: number;
}

export class DeviationRibbon implements ISeriesPrimitive {
  private chart: IChartApiBase | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private pairs: readonly DeviationPair[] = [];
  private runs: Point[][] = [];
  private readonly views: readonly IPrimitivePaneView[] = [new RibbonView(this)];

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  setPairs(pairs: readonly DeviationPair[]): void {
    this.pairs = pairs;
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    this.runs = this.measure();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  currentRuns(): readonly Point[][] {
    return this.runs;
  }

  private measure(): Point[][] {
    const { chart, series } = this;
    if (chart === null || series === null) return [];
    const scale = chart.timeScale();
    const runs: Point[][] = [];
    let run: Point[] = [];
    let previous: UTCTimestamp | null = null;
    for (const pair of this.pairs) {
      const x = scale.timeToCoordinate(pair.time);
      const forecastY = series.priceToCoordinate(pair.forecast);
      const realY = series.priceToCoordinate(pair.real);
      const gap = previous !== null && pair.time - previous !== HOUR_S;
      previous = pair.time;
      if (x === null || forecastY === null || realY === null) continue;
      if (gap && run.length > 0) {
        runs.push(run);
        run = [];
      }
      run.push({ x, forecastY, realY });
    }
    if (run.length > 0) runs.push(run);
    return runs;
  }
}

class RibbonView implements IPrimitivePaneView {
  constructor(private readonly ribbon: DeviationRibbon) {}

  zOrder(): "bottom" {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const runs = this.ribbon.currentRuns();
    if (runs.length === 0) return null;
    return {
      draw(target: RenderTarget) {
        const p = palette();
        target.useMediaCoordinateSpace(({ context }) => {
          context.fillStyle = p.deviationBand;
          for (const run of runs) {
            if (run.length < 2) continue;
            context.beginPath();
            context.moveTo(run[0]?.x ?? 0, run[0]?.forecastY ?? 0);
            for (const point of run.slice(1)) context.lineTo(point.x, point.forecastY);
            for (const point of [...run].reverse()) context.lineTo(point.x, point.realY);
            context.closePath();
            context.fill();
          }
        });
      },
    };
  }
}

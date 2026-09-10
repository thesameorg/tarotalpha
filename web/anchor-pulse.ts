/**
 * Series primitive that pulses a gold ring at the close of the last real candle. It asks the chart to redraw
 * on a timer instead of animating a DOM element, so the dot stays on the candle through scroll and zoom.
 * With reduced motion it is a still dot.
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
import { reducedMotion } from "./stage-effects";

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

const PERIOD_MS = 1600;
const FRAME_MS = 50;
const GOLD = "#d6b25a";

export interface PulsePoint {
  time: UTCTimestamp;
  price: number;
}

export class AnchorPulse implements ISeriesPrimitive {
  private chart: IChartApiBase | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private point: PulsePoint | null = null;
  private position: { x: number; y: number } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly views: readonly IPrimitivePaneView[] = [new PulseView(this)];

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
    this.schedule();
  }

  detached(): void {
    this.stop();
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  setPoint(point: PulsePoint | null): void {
    this.point = point;
    this.schedule();
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    if (this.chart === null || this.series === null || this.point === null) {
      this.position = null;
      return;
    }
    const x = this.chart.timeScale().timeToCoordinate(this.point.time);
    const y = this.series.priceToCoordinate(this.point.price);
    this.position = x === null || y === null ? null : { x, y };
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  currentPosition(): { x: number; y: number } | null {
    return this.position;
  }

  private schedule(): void {
    this.stop();
    if (this.point === null || this.requestUpdate === null || reducedMotion()) return;
    this.timer = setInterval(() => this.requestUpdate?.(), FRAME_MS);
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}

class PulseView implements IPrimitivePaneView {
  constructor(private readonly pulse: AnchorPulse) {}

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const position = this.pulse.currentPosition();
    if (position === null) return null;
    const phase = reducedMotion() ? 0 : (performance.now() % PERIOD_MS) / PERIOD_MS;
    return {
      draw(target: RenderTarget) {
        target.useMediaCoordinateSpace(({ context }) => {
          context.beginPath();
          context.arc(position.x, position.y, 3, 0, Math.PI * 2);
          context.fillStyle = GOLD;
          context.fill();
          if (phase === 0) return;
          context.beginPath();
          context.arc(position.x, position.y, 4 + phase * 12, 0, Math.PI * 2);
          context.strokeStyle = `rgba(214,178,90,${String(0.7 * (1 - phase))})`;
          context.lineWidth = 1.5;
          context.stroke();
        });
      },
    };
  }
}

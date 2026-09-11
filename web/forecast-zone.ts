/**
 * Series primitive that tints the chart from the anchor to the right edge, draws a dashed line per forecast day
 * with its label and marks the anchor with the "now" word. Coordinates are recomputed by the chart on every viewport
 * change, so the zone follows scroll, zoom and resize with no DOM overlay to keep in sync. The one DOM element
 * that rides with it, the button row over the free days, takes its place from the layout reported here.
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  UTCTimestamp,
} from "lightweight-charts";
import { t } from "./i18n/index";
import { palette } from "./palette";

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

const CANDLES_PER_DAY = 24;

export interface ZoneLayout {
  start: number;
  width: number;
  dayWidth: number;
  separators: number[];
  dayLabels: { x: number; text: string; short: string }[];
}

let labelFont: string | null = null;
function font(): string {
  labelFont ??= `11px ${getComputedStyle(document.body).getPropertyValue("--mono")}`;
  return labelFont;
}

export class ForecastZone implements ISeriesPrimitive {
  private chart: IChartApiBase | null = null;
  private requestUpdate: (() => void) | null = null;
  private anchor: UTCTimestamp | null = null;
  private steps = 0;
  private layout: ZoneLayout | null = null;
  private listener: ((layout: ZoneLayout | null) => void) | null = null;
  private readonly views: readonly IPrimitivePaneView[] = [new BackdropView(this), new LabelsView(this)];

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
  }

  setAnchor(anchor: UTCTimestamp | null, steps: number): void {
    this.anchor = anchor;
    this.steps = steps;
    this.requestUpdate?.();
  }

  onLayout(listener: ((layout: ZoneLayout | null) => void) | null): void {
    this.listener = listener;
  }

  updateAllViews(): void {
    this.layout = this.measure();
    this.listener?.(this.layout);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  currentLayout(): ZoneLayout | null {
    return this.layout;
  }

  // The zone starts half a bar right of the anchor candle; every day is 24 bar widths further.
  private measure(): ZoneLayout | null {
    if (this.chart === null || this.anchor === null) return null;
    const scale = this.chart.timeScale();
    const index = scale.timeToIndex(this.anchor, false);
    if (index === null) return null;
    const base = index as number;
    const anchorX = scale.logicalToCoordinate(base as Logical);
    const nextX = scale.logicalToCoordinate((base + 1) as Logical);
    if (anchorX === null || nextX === null) return null;
    const dayWidth = CANDLES_PER_DAY * (nextX - anchorX);
    const start = (anchorX + nextX) / 2;
    const separators: number[] = [];
    const dayLabels: ZoneLayout["dayLabels"] = [];
    for (let day = 0; day <= this.steps; day++) {
      const x = start + day * dayWidth;
      separators.push(x);
      if (day < this.steps) dayLabels.push({ x: x + 6, text: t().day(day + 1), short: String(day + 1) });
    }
    return { start, width: scale.width(), dayWidth, separators, dayLabels };
  }
}

class BackdropView implements IPrimitivePaneView {
  constructor(private readonly zone: ForecastZone) {}

  zOrder(): "bottom" {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const layout = this.zone.currentLayout();
    if (layout === null) return null;
    return {
      draw(target: RenderTarget) {
        const p = palette();
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          const width = mediaSize.width - layout.start;
          if (width > 0) {
            context.fillStyle = p.zoneTint;
            context.fillRect(layout.start, 0, width, mediaSize.height);
          }
          context.save();
          context.setLineDash([3, 4]);
          context.strokeStyle = p.zoneLine;
          context.lineWidth = 1;
          for (const x of layout.separators) {
            if (x < 0 || x > mediaSize.width) continue;
            context.beginPath();
            context.moveTo(Math.round(x) + 0.5, 0);
            context.lineTo(Math.round(x) + 0.5, mediaSize.height);
            context.stroke();
          }
          context.restore();
        });
      },
    };
  }
}

class LabelsView implements IPrimitivePaneView {
  constructor(private readonly zone: ForecastZone) {}

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const layout = this.zone.currentLayout();
    if (layout === null) return null;
    return {
      draw(target: RenderTarget) {
        const p = palette();
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          context.font = font();
          context.fillStyle = p.gold;
          context.textBaseline = "alphabetic";
          for (const label of layout.dayLabels) {
            if (label.x < 0 || label.x > mediaSize.width) continue;
            // A long reading on a phone leaves a day narrower than its label: the number alone then.
            const fits = context.measureText(label.text).width + 12 <= layout.dayWidth;
            context.fillText(fits ? label.text : label.short, label.x, mediaSize.height - 8);
          }
          const now = t().now;
          const nowWidth = context.measureText(now).width;
          const nowX = layout.start - nowWidth - 6;
          if (nowX > 0 && layout.start < mediaSize.width) context.fillText(now, nowX, 14);
        });
      },
    };
  }
}

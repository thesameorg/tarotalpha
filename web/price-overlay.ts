/**
 * Series primitive that gives a narrow screen its prices back without spending width on them: round levels drawn
 * over the candles at the right edge, each on its own hairline, and the market's last close in a chip under them.
 * The native scale is hidden while this one is on — ninety pixels of a three-hundred-ninety-pixel screen is the
 * quarter of the chart the forecast candles were owed. Levels are the round steps inside the visible range, found
 * here rather than read from the library, which keeps its own ticks to itself. Where the line between a phone and
 * a desktop is drawn: ../docs/idea.md
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
} from "lightweight-charts";
import { palette } from "./palette";
import { formatPrice } from "./price-format";

type RenderTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

const LEVELS = 5;
const FONT_PX = 10;
const PAD_X = 6;
const CHIP_PAD_Y = 3;
// A label sitting on the very top or bottom edge would be half cut off, so the band ends short of both.
const EDGE = 8;

interface Level {
  y: number;
  /** null for a level whose price is hidden behind the last-close chip: the line stays, the number would collide. */
  text: string | null;
}

const CHIP_HEIGHT = FONT_PX + CHIP_PAD_Y * 2;

/** Where the market stands right now, in the chip the library would have drawn on the scale. */
interface Chip {
  y: number;
  text: string;
}

/** The round step just above `raw`: 1, 2 or 5 times a power of ten, the steps a price scale has always used. */
function roundStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / magnitude;
  const step = scaled > 5 ? 10 : scaled > 2 ? 5 : scaled > 1 ? 2 : 1;
  return step * magnitude;
}

export class PriceOverlay implements ISeriesPrimitive {
  private chart: IChartApiBase | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private levels: Level[] = [];
  private last: Chip | null = null;
  private readonly views: readonly IPrimitivePaneView[] = [new OverlayView(this)];

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.levels = [];
    this.last = null;
  }

  updateAllViews(): void {
    const last = this.lastClose();
    this.last = last;
    this.levels = this.measure().map((level) =>
      last !== null && Math.abs(level.y - last.y) < CHIP_HEIGHT ? { ...level, text: null } : level,
    );
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  currentLevels(): readonly Level[] {
    return this.levels;
  }

  currentLast(): Chip | null {
    return this.last;
  }

  private measure(): Level[] {
    const { chart, series } = this;
    if (chart === null || series === null) return [];
    const { height } = chart.paneSize();
    const top = series.coordinateToPrice(EDGE);
    const bottom = series.coordinateToPrice(height - EDGE);
    if (height <= 0 || top === null || bottom === null || !(top > bottom)) return [];
    const step = roundStep((top - bottom) / LEVELS);
    const levels: Level[] = [];
    for (let rung = Math.ceil(bottom / step); rung * step <= top; rung++) {
      const price = rung * step;
      const y = series.priceToCoordinate(price);
      if (y !== null) levels.push({ y, text: formatPrice(price) });
    }
    return levels;
  }

  private lastClose(): Chip | null {
    const series = this.series;
    if (series === null) return null;
    const bars = series.data();
    const last = bars[bars.length - 1];
    if (last === undefined || !("close" in last) || typeof last.close !== "number") return null;
    const y = series.priceToCoordinate(last.close);
    return y === null ? null : { y, text: formatPrice(last.close) };
  }
}

class OverlayView implements IPrimitivePaneView {
  constructor(private readonly overlay: PriceOverlay) {}

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const levels = this.overlay.currentLevels();
    const last = this.overlay.currentLast();
    if (levels.length === 0) return null;
    return {
      draw(target: RenderTarget) {
        const p = palette();
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          ctx.font = `${String(FONT_PX)}px ${getComputedStyle(document.body).getPropertyValue("--mono")}`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "right";
          const right = mediaSize.width - PAD_X;
          for (const level of levels) {
            ctx.strokeStyle = p.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, level.y);
            ctx.lineTo(mediaSize.width, level.y);
            ctx.stroke();
            if (level.text === null) continue;
            // The price is outlined in the background rather than boxed: a chip per level would be five more boxes.
            ctx.lineWidth = 3;
            ctx.strokeStyle = p.bg;
            ctx.strokeText(level.text, right, level.y);
            ctx.fillStyle = p.text;
            ctx.fillText(level.text, right, level.y);
          }
          if (last === null) return;
          const width = ctx.measureText(last.text).width;
          ctx.fillStyle = p.line;
          ctx.fillRect(
            right - width - PAD_X,
            last.y - FONT_PX / 2 - CHIP_PAD_Y,
            width + PAD_X * 2,
            FONT_PX + CHIP_PAD_Y * 2,
          );
          ctx.fillStyle = p.text;
          ctx.fillText(last.text, right, last.y);
        });
      },
    };
  }
}

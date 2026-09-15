/**
 * The scroll at /s/:id: one sheet that certifies what a ripened reading foretold — the certifying line, the table
 * that read it with each reader's gap, the facts of the reading, the cards of every day, the chart under them and a
 * QR back. A permanent link, so it is a page and not a file: print makes the PDF on one A4 leaf, and text stays text
 * in all eleven languages. Nothing is stored for it — the reading in D1 and the exchange's own candles are the whole
 * document, and the sheet is only drawn when every forecast candle has a real one to compare against.
 * Why a scroll is a link and what the list does with it: docs/reading-lifecycle.md
 */
import {
  accuracy,
  atr,
  CANDLES_PER_STEP,
  deviation,
  forecastFromCards,
  type Candle,
  type StepResult,
} from "../engine/index";
import { cardById } from "../engine/deck";
import { fetchAfter } from "../exchange/closed-candles";
import type { ReaderId } from "../engine/readers";
import { ApiError, fetchReading, postEvent, type ReadingRecord } from "./api";
import { cardImageUrl } from "./card-image";
import { createCandleChart, type CandleChart } from "./chart";
import { required } from "./dom-lookup";
import { lang, onLangChange, t } from "./i18n/index";
import { localDateTime } from "./local-time-format";
import { markScrolled } from "./my-readings";
import { formatGap } from "./price-format";
import { readerAvatarUrl } from "./reader-choice";
import type { Navigate, View } from "./router";
import { candlesByReader, opinionLines } from "./second-opinion";

interface Sheet {
  record: ReadingRecord;
  snapshot: Candle[];
  results: StepResult[];
  opinions: Map<ReaderId, StepResult[]>;
  real: Candle[];
  /** Share of forecast candles whose direction the market repeated, already in percent. */
  accuracyPct: number;
  /** The author's gap to the market in ATR of the snapshot: what the sheet certifies. */
  gap: number;
  /** Everyone who read this reading, the author first, each with her gap to the market. */
  seats: Seat[];
  /** Whose gap is the smallest; null when nobody could be measured. */
  closest: ReaderId | null;
}

interface Seat {
  id: ReaderId;
  /** The gap to the market in ATR of the snapshot; null when no pair could be measured. */
  deviation: number | null;
}

function factMarkup(label: string, value: string): string {
  return `<div class="fact"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function cardsMarkup(results: readonly StepResult[]): string {
  return results
    .map((step, index) => {
      const cards = step.cards
        .map(([id, reversed]) => {
          const card = cardById(id);
          const upsideDown = reversed === 1 ? " rev" : "";
          return `<figure class="scroll-card${upsideDown}"><img src="${cardImageUrl(card.id)}" alt="" loading="eager" decoding="async"><figcaption>${t().cardName(card)}</figcaption></figure>`;
        })
        .join("");
      return `<div class="scroll-day"><div class="scroll-day-no">${t().day(index + 1)}</div><div class="scroll-day-cards">${cards}</div></div>`;
    })
    .join("");
}

const candlesOf = (steps: readonly StepResult[]): Candle[] => steps.flatMap((step) => step.candles);

function closestOf(seats: readonly Seat[]): ReaderId | null {
  const best = seats.reduce<Seat | null>(
    (won, seat) => (seat.deviation !== null && (won?.deviation ?? Infinity) > seat.deviation ? seat : won),
    null,
  );
  return best?.id ?? null;
}

// The table of the reading in the colours of the chart below: the author drew the candles, everyone bought after
// her drew a line of her own hue. The gap is the one the scoring counts, so the sheet ranks them like the verdict.
function seatMarkup(seat: Seat, author: boolean, closest: boolean): string {
  const gap = seat.deviation === null ? "—" : formatGap(seat.deviation);
  const mark = closest ? ` <b>${t().reader.closest}</b>` : "";
  const hue = author ? "" : ` style="--hue: var(--reader-${seat.id})"`;
  const name = t().readerName(seat.id);
  return `<div class="scroll-seat${author ? " author" : ""}"${hue}><img src="${readerAvatarUrl(seat.id)}" alt=""><div class="scroll-seat-text"><b>${name}</b><span>${gap}${mark}</span></div></div>`;
}

function seatsMarkup(sheet: Sheet): string {
  const many = sheet.seats.length > 1;
  const label = many ? t().scroll.readers : t().scroll.reader;
  const seats = sheet.seats
    .map((seat, index) => seatMarkup(seat, index === 0, many && seat.id === sheet.closest))
    .join("");
  return `<div class="scroll-seats"><div class="scroll-seats-label">${label}</div>${seats}</div>`;
}

function sheetMarkup(sheet: Sheet, url: string): string {
  const { record, accuracyPct } = sheet;
  const horizon = `${String(sheet.results.length * CANDLES_PER_STEP)} h`;
  // What the sheet certifies is the gap, the same number the author's seat carries: the share of candle signs is a
  // coin's number and stands below as a fact, not as the sentence (../docs/engine.md).
  const gap = formatGap(sheet.gap);
  return `
<article class="scroll">
  <header class="scroll-head">
    <span class="scroll-mark">TAROTALPHA</span>
    <h1 class="scroll-title">${t().scroll.title}</h1>
    <p class="scroll-certify">${t().scroll.certify(record.id, record.asset, gap)}</p>
  </header>
  <div class="scroll-top">
    ${seatsMarkup(sheet)}
    <dl class="scroll-facts">
      ${factMarkup(t().scroll.instrument, record.asset)}
      ${factMarkup(t().scroll.anchor, localDateTime(record.anchor_ts))}
      ${factMarkup(t().scroll.horizon, horizon)}
      ${factMarkup(t().scroll.signs, `${String(accuracyPct)} %`)}
    </dl>
  </div>
  <div class="scroll-cards">${cardsMarkup(sheet.results)}</div>
  <div class="scroll-chart" id="scroll-chart"></div>
  <footer class="scroll-foot">
    <div class="scroll-qr"><img id="scroll-qr" alt="" hidden><span class="scroll-url">${url}</span></div>
    <p class="disclaimer">${t().disclaimer}</p>
  </footer>
</article>
<div class="scroll-actions">
  <button class="go" type="button" id="scroll-print">${t().scroll.print}</button>
  <button class="draw" type="button" id="scroll-reading">${t().scroll.reading}</button>
</div>`;
}

function messageMarkup(message: string, button: string): string {
  return `<div class="stage"><div class="chart-box"><div class="chart-state"><p>${message}</p><button class="go" type="button" id="scroll-reading">${button}</button></div></div></div>`;
}

class ScrollPage {
  private alive = true;
  private sheet: Sheet | null = null;
  private chart: CandleChart | null = null;
  private message: (() => string) | null = null;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly root: HTMLElement,
    private readonly id: string,
    private readonly navigate: Navigate,
  ) {
    this.root.innerHTML = `<div class="stage"><div class="chart-box"><div class="chart-state busy"><p>${t().reading.loading}</p></div></div></div>`;
    this.unsubscribe = onLangChange(() => {
      this.paint();
    });
    void this.load();
  }

  dispose(): void {
    this.alive = false;
    this.unsubscribe();
    this.chart?.remove();
    this.chart = null;
  }

  private gone(): boolean {
    return !this.alive;
  }

  private async load(): Promise<void> {
    let record: ReadingRecord;
    try {
      record = await fetchReading(this.id);
    } catch (error: unknown) {
      if (this.gone()) return;
      const notFound = error instanceof ApiError && error.status === 404;
      this.say(notFound ? (): string => t().reading.notFound : (): string => t().reading.loadFailed);
      return;
    }
    if (this.gone()) return;
    await this.measure(record);
  }

  // A scroll certifies a finished story, so it needs every forecast candle answered by a real one. Anything less —
  // a reading still ripening, an exchange with a hole in its history — is not a document, and says so.
  private async measure(record: ReadingRecord): Promise<void> {
    const snapshot: Candle[] = record.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const results = forecastFromCards({
      asset: record.asset,
      anchorTs: record.anchor_ts,
      snapshot,
      reader: record.reader,
      nonce: record.seed_nonce,
      cards: record.steps,
    });
    const opinions = opinionLines(record, snapshot);
    const forecast = results.flatMap((step) => step.candles);
    let real: Candle[];
    try {
      real = await fetchAfter(record.asset, record.anchor_ts, forecast.length, record.source, Date.now());
    } catch {
      if (this.gone()) return;
      this.say(() => t().prophecy.checkFailed);
      return;
    }
    if (this.gone()) return;
    const overall = accuracy(forecast, real);
    if (overall.compared < results.length * CANDLES_PER_STEP) {
      this.say(() => t().scroll.notRipe);
      return;
    }
    const unit = atr(snapshot);
    const gap = deviation(forecast, real, unit).deviation;
    if (gap === null) {
      this.say(() => t().scroll.notRipe);
      return;
    }
    const seats: Seat[] = [
      { id: record.reader, deviation: gap },
      ...[...opinions].map(([id, steps]) => ({
        id,
        deviation: deviation(candlesOf(steps), real, unit).deviation,
      })),
    ];
    this.sheet = {
      record,
      snapshot,
      results,
      opinions,
      real,
      accuracyPct: Math.round((overall.accuracy ?? 0) * 100),
      gap,
      seats,
      closest: closestOf(seats),
    };
    this.message = null;
    this.paint();
    void markScrolled(record.id);
    postEvent({ type: "scroll_opened", asset: record.asset, reading_id: record.id });
  }

  private say(message: () => string): void {
    this.sheet = null;
    this.message = message;
    this.paint();
  }

  private readingUrl(): string {
    const url = new URL(`/r/${this.id}`, window.location.href);
    url.searchParams.set("lang", lang());
    return url.href;
  }

  /** The whole sheet is words, so a language switch redraws it; the chart is cheap to rebuild from candles in hand. */
  private paint(): void {
    this.chart?.remove();
    this.chart = null;
    const sheet = this.sheet;
    if (sheet === null) {
      const message = this.message;
      if (message === null) return;
      this.root.innerHTML = messageMarkup(message(), t().scroll.reading);
      this.bindReading();
      return;
    }
    this.root.innerHTML = sheetMarkup(sheet, this.readingUrl());
    this.bindReading();
    required(this.root, "#scroll-print", HTMLButtonElement).addEventListener("click", () => {
      window.print();
    });
    const chart = createCandleChart(required(this.root, "#scroll-chart", HTMLElement));
    this.chart = chart;
    void chart.showSnapshot(sheet.snapshot, false).then(() => {
      if (this.gone()) return;
      chart.setSteps(sheet.results.length);
      chart.setForecast(candlesOf(sheet.results));
      chart.setOpinions(candlesByReader(sheet.opinions));
      chart.setActual(sheet.real);
    });
    void this.paintQr();
  }

  private bindReading(): void {
    required(this.root, "#scroll-reading", HTMLButtonElement).addEventListener("click", () => {
      this.navigate(`/r/${this.id}`);
    });
  }

  /** The square is what makes a printed sheet worth anything: paper cannot be clicked. */
  private async paintQr(): Promise<void> {
    const img = this.root.querySelector("#scroll-qr");
    if (!(img instanceof HTMLImageElement)) return;
    try {
      const { toDataURL } = await import("qrcode");
      const square = await toDataURL(this.readingUrl(), { margin: 1, width: 400, errorCorrectionLevel: "M" });
      if (this.gone()) return;
      img.src = square;
      img.hidden = false;
    } catch {
      // No square, no loss: the link under it is printed in full and can be typed in.
    }
  }
}

export function scrollView(id: string, navigate: Navigate): View {
  let page: ScrollPage | null = null;
  return {
    mount(root) {
      page = new ScrollPage(root, id, navigate);
    },
    unmount() {
      page?.dispose();
      page = null;
    },
  };
}

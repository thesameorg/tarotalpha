/**
 * The scroll at /s/:id: one sheet that certifies what a ripened reading foretold — the certifying line, the chart
 * with the forecast over the real candles, the cards of every day, the reader, the accuracy and a QR back to the
 * reading. A permanent link, so it is a page and not a file: print makes the PDF, and text stays text in all eleven
 * languages. Nothing is stored for it — the reading in D1 and the exchange's own candles are the whole document,
 * and the sheet is only drawn when every forecast candle has a real one to compare against.
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
import { ApiError, fetchReading, postEvent, type ReadingRecord } from "./api";
import { cardImageUrl } from "./card-image";
import { createCandleChart, type CandleChart } from "./chart";
import { required } from "./dom-lookup";
import { lang, onLangChange, t } from "./i18n/index";
import { localDateTime } from "./local-time-format";
import { markScrolled } from "./my-readings";
import type { Navigate, View } from "./router";

interface Sheet {
  record: ReadingRecord;
  snapshot: Candle[];
  results: StepResult[];
  real: Candle[];
  /** Share of forecast candles whose direction the market repeated, already in percent. */
  accuracyPct: number;
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

function sheetMarkup(sheet: Sheet, url: string): string {
  const { record, accuracyPct } = sheet;
  const gap = sheet.deviation === null ? "" : ` · ${sheet.deviation.toFixed(2)} ATR`;
  return `
<article class="scroll">
  <header class="scroll-head">
    <span class="scroll-mark">TAROTALPHA</span>
    <h1 class="scroll-title">${t().scroll.title}</h1>
  </header>
  <p class="scroll-certify">${t().scroll.certify(record.id, record.asset, accuracyPct)}</p>
  <div class="scroll-body">
    <div class="scroll-chart" id="scroll-chart"></div>
    <dl class="scroll-facts">
      ${factMarkup(t().scroll.instrument, record.asset)}
      ${factMarkup(t().scroll.anchor, localDateTime(record.anchor_ts))}
      ${factMarkup(t().scroll.reader, t().readerName(record.reader))}
      ${factMarkup(t().scroll.accuracy, `${String(accuracyPct)} %${gap}`)}
    </dl>
  </div>
  <div class="scroll-cards">${cardsMarkup(sheet.results)}</div>
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
    this.sheet = {
      record,
      snapshot,
      results,
      real,
      accuracyPct: Math.round((overall.accuracy ?? 0) * 100),
      deviation: deviation(forecast, real, atr(snapshot)).deviation,
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
      chart.setForecast(sheet.results.flatMap((step) => step.candles));
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

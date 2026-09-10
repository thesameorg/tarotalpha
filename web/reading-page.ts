/**
 * A saved reading at /r/:id: the stored snapshot and cards, the forecast recomputed by the current engine, and the
 * prophecy check against candles this browser fetches from the same exchange. The first paint is static: every
 * candle, real and forecast, is on the chart at once. Days are tabs under the chart; replay alone animates, running
 * the fullscreen reveal for each day and flowing its candles in. The API answers only the reading itself; 404 and
 * network failures render as text, never as an empty chart. Labels are functions of the dictionary, so a language
 * switch relabels the page in place.
 */
import { accuracy, forecastFromCards, readerScale, type Accuracy, type Candle, type StepResult } from "../engine/index";
import { fetchAfter, HOUR_MS } from "../exchange/closed-candles";
import { ApiError, fetchReading, postEvent, type ReadingRecord } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { createCoinPicker } from "./coin-picker";
import { required } from "./dom-lookup";
import { showExchangeLogo } from "./exchange-logo";
import { lang, onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { localDateTime, localTime } from "./local-time-format";
import { formatChange, formatPrice } from "./price-format";
import { playReveal } from "./reveal-overlay";
import type { Navigate, View } from "./router";
import { openShareModal } from "./share-modal";
import { cardsOf, createSpreadPanel, type SpreadPanel } from "./spread-panel";
import { sleep } from "./stage-effects";
import { setTechFacts } from "./tech-panel";

const CANDLES_PER_DAY = 24;
const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;

type Text = () => string;

interface Elements {
  stage: HTMLElement;
  picker: HTMLElement;
  srcLogo: HTMLImageElement;
  last: HTMLElement;
  chg: HTMLElement;
  meta: HTMLElement;
  steps: HTMLElement;
  chart: HTMLElement;
  prophecy: HTMLElement;
  panel: HTMLElement;
  replay: HTMLButtonElement;
  own: HTMLButtonElement;
  share: HTMLButtonElement;
  note: HTMLElement;
}

interface Verdict {
  overall: Accuracy;
  perStep: readonly Accuracy[];
  total: number;
}

type Prophecy = { kind: "verdict"; verdict: Verdict } | { kind: "pending"; text: Text; retry: boolean } | null;

function messageMarkup(message: string, buttonId: string, buttonText: string): string {
  return `
<div class="stage">
  <div class="chart-box">
    <div class="chart-state">
      <p>${message}</p>
      <button class="go" id="${buttonId}">${buttonText}</button>
    </div>
  </div>
</div>`;
}

function readingMarkup(): string {
  return `
<div class="stage" id="stage">
  <div class="stage-top">
    <div class="px"><div id="picker"></div><img class="src-logo" id="src-logo" alt="" hidden><span id="last"></span><span class="chg" id="chg"></span></div>
    <span class="meta" id="meta"></span>
    <div class="steps" id="steps"><span></span><span></span><span class="locked"></span></div>
  </div>
  <div class="chart-box"><div class="chart" id="chart"></div></div>
  <div class="prophecy" id="prophecy"></div>
  <div id="panel"></div>
  <div class="actions">
    <div class="group">
      <button class="draw" id="replay"></button>
      <button class="go" id="own"></button>
      <button class="icon-btn" id="share" type="button">${icons.share}</button>
    </div>
    <span class="note" id="note"></span>
  </div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    stage: required(root, "#stage", HTMLElement),
    picker: required(root, "#picker", HTMLElement),
    srcLogo: required(root, "#src-logo", HTMLImageElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    meta: required(root, "#meta", HTMLElement),
    steps: required(root, "#steps", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    prophecy: required(root, "#prophecy", HTMLElement),
    panel: required(root, "#panel", HTMLElement),
    replay: required(root, "#replay", HTMLButtonElement),
    own: required(root, "#own", HTMLButtonElement),
    share: required(root, "#share", HTMLButtonElement),
    note: required(root, "#note", HTMLElement),
  };
}

function percent(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

function verdictMarkup({ overall, perStep, total }: Verdict): string {
  const pct = percent(overall.accuracy) ?? 0;
  const hit = (overall.accuracy ?? 0) >= 0.5;
  const title = hit ? t().prophecy.hit(pct) : t().prophecy.miss(pct);
  const status = overall.compared === total ? t().prophecy.final : t().prophecy.interim;
  const lines = perStep
    .map((step, index) => t().prophecy.stepLine(index + 1, percent(step.accuracy), step.hits, step.compared))
    .join(" · ");
  return `<div class="verdict ${hit ? "hit" : "miss"}">
  <div class="verdict-title">${title}</div>
  <div class="verdict-sub">${t().prophecy.compared(overall.compared, total)} · ${status}</div>
  <div class="verdict-steps">${lines}</div>
  <p class="disclaimer">${t().disclaimer}</p>
</div>`;
}

function pendingMarkup(text: string, retry: boolean): string {
  const button = retry ? `<button class="go" id="recheck">${t().retry}</button>` : "";
  return `<div class="verdict pending"><div class="verdict-sub">${text}</div>${button}</div>`;
}

class ReadingPage {
  private alive = true;
  private busy = false;
  private el: Elements | null = null;
  private record: ReadingRecord | null = null;
  private chart: CandleChart | null = null;
  private panel: SpreadPanel | null = null;
  private actual: Candle[] | null = null;
  private prophecy: Prophecy = null;
  private noteText: Text | null = null;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly root: HTMLElement,
    private readonly id: string,
    private readonly navigate: Navigate,
  ) {
    this.root.innerHTML = `<div class="stage"><div class="chart-box"><div class="chart-state"><p>${t().reading.loading}</p></div></div></div>`;
    this.unsubscribe = onLangChange(() => {
      this.relabel();
    });
    void this.load();
  }

  dispose(): void {
    this.alive = false;
    this.unsubscribe();
    this.panel?.dispose();
    this.panel = null;
    this.chart?.remove();
    this.chart = null;
  }

  // Read through a method: an `if (!this.alive)` guard would narrow the field to `true` for the rest of the flow.
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
      this.renderMessage(notFound ? t().reading.notFound : t().reading.loadFailed);
      return;
    }
    if (this.gone()) return;
    this.render(record);
  }

  private renderMessage(message: string): void {
    this.el = null;
    this.root.innerHTML = messageMarkup(message, "own", t().reading.ownReading);
    required(this.root, "#own", HTMLButtonElement).addEventListener("click", () => {
      this.navigate("/");
    });
  }

  private render(record: ReadingRecord): void {
    const snapshot: Candle[] = record.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    if (snapshot.length <= CHANGE_LOOKBACK) {
      this.renderMessage(t().reading.loadFailed);
      return;
    }
    const results = forecastFromCards({
      asset: record.asset,
      anchorTs: record.anchor_ts,
      snapshot,
      reader: record.reader,
      cards: record.steps,
    });
    this.record = record;
    this.root.innerHTML = readingMarkup();
    const el = lookup(this.root);
    this.el = el;
    setTechFacts({
      lag: null,
      source: record.source,
      engine: record.engine_version,
      anchorTs: record.anchor_ts,
      scale: readerScale(record.reader, snapshot),
      readingId: record.id,
    });

    showExchangeLogo(el.srcLogo, record.source);
    createCoinPicker(el.picker, record.asset, (symbol) => {
      postEvent({ type: "own_reading_clicked", asset: symbol, reading_id: record.id });
      this.navigate(`/?asset=${encodeURIComponent(symbol)}`);
    });
    this.setStepsBar(el, results.length);

    const panel = createSpreadPanel(el.panel, false);
    this.panel = panel;
    panel.setSteps(results, 0);

    const chart = createCandleChart(el.chart);
    this.chart = chart;

    el.replay.addEventListener("click", () => {
      void this.replay(el, chart, panel, results, record);
    });
    el.own.addEventListener("click", () => {
      postEvent({ type: "own_reading_clicked", asset: record.asset, reading_id: record.id });
      this.navigate(`/?asset=${encodeURIComponent(record.asset)}`);
    });
    el.share.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang());
      openShareModal(url.href);
    });
    this.relabel();

    void this.reveal(el, chart, snapshot, results, record);
  }

  private relabel(): void {
    const el = this.el;
    const record = this.record;
    if (el === null || record === null) return;
    const snapshot = record.candles_snapshot;
    const last = snapshot[snapshot.length - 1];
    const prev = snapshot[snapshot.length - 1 - CHANGE_LOOKBACK];
    if (last !== undefined && prev !== undefined) {
      const change = (last[4] / prev[4] - 1) * 100;
      el.last.textContent = formatPrice(last[4]);
      el.chg.textContent = formatChange(change);
      el.chg.style.color = change >= 0 ? "var(--up)" : "var(--down)";
    }
    el.meta.textContent = t().reading.meta(localDateTime(new Date(record.created_at).getTime()));
    el.replay.textContent = t().reading.replay;
    el.own.textContent = t().reading.own;
    el.share.setAttribute("aria-label", t().share.button);
    el.share.title = t().share.button;
    el.note.textContent = this.noteText?.() ?? "";
    this.paintProphecy(el);
  }

  private note(text: Text | null): void {
    this.noteText = text;
    if (this.el !== null) this.el.note.textContent = text?.() ?? "";
  }

  private setProphecy(el: Elements, prophecy: Prophecy): void {
    this.prophecy = prophecy;
    this.paintProphecy(el);
  }

  private paintProphecy(el: Elements): void {
    const prophecy = this.prophecy;
    if (prophecy === null) {
      el.prophecy.replaceChildren();
      return;
    }
    if (prophecy.kind === "verdict") {
      el.prophecy.innerHTML = verdictMarkup(prophecy.verdict);
      return;
    }
    el.prophecy.innerHTML = pendingMarkup(prophecy.text(), prophecy.retry);
    if (prophecy.retry) {
      required(el.prophecy, "#recheck", HTMLButtonElement).addEventListener("click", () => {
        void this.recheck();
      });
    }
  }

  private setStepsBar(el: Elements, done: number): void {
    [...el.steps.children].forEach((mark, index) => {
      mark.classList.toggle("done", index < done);
    });
  }

  private async reveal(
    el: Elements,
    chart: CandleChart,
    snapshot: Candle[],
    results: StepResult[],
    record: ReadingRecord,
  ): Promise<void> {
    await chart.showSnapshot(snapshot, false);
    if (this.gone()) return;
    chart.setSteps(results.length);
    chart.setForecast(results.flatMap((step) => step.candles));
    await this.checkProphecy(el, chart, results, record);
  }

  private async recheck(): Promise<void> {
    const { el, chart, record } = this;
    if (el === null || chart === null || record === null) return;
    const snapshot: Candle[] = record.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const results = forecastFromCards({
      asset: record.asset,
      anchorTs: record.anchor_ts,
      snapshot,
      reader: record.reader,
      cards: record.steps,
    });
    await this.checkProphecy(el, chart, results, record);
  }

  private async checkProphecy(
    el: Elements,
    chart: CandleChart,
    results: StepResult[],
    record: ReadingRecord,
  ): Promise<void> {
    this.setProphecy(el, { kind: "pending", text: () => t().prophecy.checking, retry: false });
    const total = results.length * CANDLES_PER_DAY;
    const started = performance.now();
    let real: Candle[];
    try {
      real = await fetchAfter(record.asset, record.anchor_ts, total, record.source, Date.now());
    } catch {
      if (this.gone()) return;
      setTechFacts({ lag: null });
      this.setProphecy(el, { kind: "pending", text: () => t().prophecy.checkFailed, retry: true });
      return;
    }
    setTechFacts({ lag: Math.round(performance.now() - started) });
    if (this.gone()) return;
    if (real.length === 0) {
      const closesAt = localTime(record.anchor_ts + 2 * HOUR_MS);
      this.setProphecy(el, { kind: "pending", text: () => t().prophecy.notYet(closesAt), retry: false });
      return;
    }
    this.actual = real;
    chart.setActual(real);
    const overall = accuracy(
      results.flatMap((step) => step.candles),
      real,
    );
    const perStep = results.map((step) => accuracy(step.candles, real));
    this.setProphecy(el, { kind: "verdict", verdict: { overall, perStep, total } });
  }

  private async replay(
    el: Elements,
    chart: CandleChart,
    panel: SpreadPanel,
    results: StepResult[],
    record: ReadingRecord,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    el.replay.disabled = true;
    this.note(() => t().reading.replaying);
    panel.clear();
    chart.setActual([]);
    chart.setForecast([]);
    chart.setSteps(0);
    this.setStepsBar(el, 0);
    for (const [index, step] of results.entries()) {
      if (this.gone()) return;
      const pulled = await playReveal(cardsOf(step));
      if (this.gone()) return;
      if (!pulled) {
        this.restoreAfterReplay(el, chart, panel, results);
        return;
      }
      panel.setSteps(results.slice(0, index + 1), index);
      chart.setSteps(index + 1);
      this.setStepsBar(el, index + 1);
      for (const candle of step.candles) {
        if (this.gone()) return;
        chart.appendForecast(candle);
        await sleep(FLOW_MS_PER_CANDLE);
      }
    }
    if (this.actual !== null) chart.setActual(this.actual);
    this.note(null);
    el.replay.disabled = false;
    this.busy = false;
    postEvent({ type: "replayed", asset: record.asset, reading_id: record.id });
  }

  // The viewer closed the fan mid-replay: put the stored reading back exactly as it was before the replay.
  private restoreAfterReplay(el: Elements, chart: CandleChart, panel: SpreadPanel, results: StepResult[]): void {
    panel.setSteps(results, results.length - 1);
    chart.setForecast(results.flatMap((step) => step.candles));
    chart.setSteps(results.length);
    this.setStepsBar(el, results.length);
    if (this.actual !== null) chart.setActual(this.actual);
    this.note(null);
    el.replay.disabled = false;
    this.busy = false;
  }
}

export function readingView(id: string, navigate: Navigate): View {
  let page: ReadingPage | null = null;
  return {
    mount(root) {
      page = new ReadingPage(root, id, navigate);
    },
    unmount() {
      page?.dispose();
      page = null;
    },
  };
}

/**
 * A saved reading at /r/:id: the stored snapshot and cards, the forecast recomputed by the engine version the
 * reading names (law 1), and the prophecy check against candles this browser fetches from the same exchange.
 * The API answers only the reading itself; 404 and network failures render as text, never as an empty chart.
 */
import { engineFor, type Engine } from "../engine/index";
import type { Accuracy } from "../engine/v1/accuracy";
import type { Candle } from "../engine/v1/atr";
import type { StepResult } from "../engine/v1/index";
import { fetchAfter, HOUR_MS } from "../exchange/closed-candles";
import { ApiError, fetchReading, postEvent, type ReadingRecord } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { copy } from "./copy";
import { required } from "./dom-lookup";
import { setEngineVersion, setLag, setSource } from "./footer";
import { formatChange, formatPrice } from "./price-format";
import type { Navigate, View } from "./router";
import { openShareModal } from "./share-modal";
import { resetBlock, revealStep, showStep, type SpreadBlock } from "./spread";
import { sleep } from "./stage-effects";
import { utcDateTime, utcTime } from "./utc-format";

const CANDLES_PER_DAY = 24;
const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;

interface Elements {
  stage: HTMLElement;
  sym: HTMLElement;
  last: HTMLElement;
  chg: HTMLElement;
  steps: HTMLElement;
  chart: HTMLElement;
  prophecy: HTMLElement;
  live: HTMLElement;
  liveSpread: HTMLElement;
  liveReading: HTMLElement;
  blocks: HTMLElement;
  replay: HTMLButtonElement;
  own: HTMLButtonElement;
  share: HTMLButtonElement;
  note: HTMLElement;
}

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

function stepBlockMarkup(day: number): string {
  return `
<div class="step-block" data-step="${String(day)}">
  <div class="step-title">${copy.day(day)}</div>
  <div class="spread"></div>
  <div class="reading"></div>
</div>`;
}

function readingMarkup(record: ReadingRecord, meta: string, days: number): string {
  const blocks = Array.from({ length: days }, (_, index) => stepBlockMarkup(index + 1)).join("");
  return `
<div class="ask"><span class="src" id="meta">${meta}</span></div>
<div class="stage" id="stage">
  <div class="stage-top">
    <div class="px"><span id="sym"></span> <span id="last"></span><span class="chg" id="chg"></span></div>
    <div class="steps" id="steps"><span></span><span></span><span></span></div>
  </div>
  <div class="chart-box"><div class="chart" id="chart"></div></div>
  <div class="prophecy" id="prophecy"></div>
  <div class="live" id="live" hidden>
    <div class="spread" id="live-spread"></div>
    <div class="reading" id="live-reading"></div>
  </div>
  <div class="blocks" id="blocks">${blocks}</div>
  <p class="disclaimer">${copy.disclaimer}</p>
  <div class="actions">
    <button class="draw" id="replay">Воспроизвести расклад</button>
    <button class="share" id="own">Свой расклад по этому инструменту</button>
    <button class="share" id="share">Поделиться</button>
    <span class="note" id="note"></span>
  </div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    stage: required(root, "#stage", HTMLElement),
    sym: required(root, "#sym", HTMLElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    steps: required(root, "#steps", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    prophecy: required(root, "#prophecy", HTMLElement),
    live: required(root, "#live", HTMLElement),
    liveSpread: required(root, "#live-spread", HTMLElement),
    liveReading: required(root, "#live-reading", HTMLElement),
    blocks: required(root, "#blocks", HTMLElement),
    replay: required(root, "#replay", HTMLButtonElement),
    own: required(root, "#own", HTMLButtonElement),
    share: required(root, "#share", HTMLButtonElement),
    note: required(root, "#note", HTMLElement),
  };
}

function percent(accuracy: number | null): number | null {
  return accuracy === null ? null : Math.round(accuracy * 100);
}

function verdictMarkup(overall: Accuracy, perStep: readonly Accuracy[], total: number): string {
  const pct = percent(overall.accuracy) ?? 0;
  const hit = (overall.accuracy ?? 0) >= 0.5;
  const title = hit ? copy.prophecy.hit(pct) : copy.prophecy.miss(pct);
  const status = overall.compared === total ? copy.prophecy.final : copy.prophecy.interim;
  const lines = perStep
    .map((step, index) => copy.prophecy.stepLine(index + 1, percent(step.accuracy), step.hits, step.compared))
    .join(" · ");
  return `<div class="verdict ${hit ? "hit" : "miss"}">
  <div class="verdict-title">${title}</div>
  <div class="verdict-sub">${copy.prophecy.compared(overall.compared, total)} · ${status}</div>
  <div class="verdict-steps">${lines}</div>
  <p class="disclaimer">${copy.disclaimer}</p>
</div>`;
}

function pendingMarkup(text: string, retryId: string | null): string {
  const retry = retryId === null ? "" : `<button class="go" id="${retryId}">${copy.retry}</button>`;
  return `<div class="verdict pending"><div class="verdict-sub">${text}</div>${retry}</div>`;
}

class ReadingPage {
  private alive = true;
  private busy = false;
  private chart: CandleChart | null = null;
  private actual: Candle[] | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly id: string,
    private readonly navigate: Navigate,
  ) {
    this.root.innerHTML = `<div class="stage"><div class="chart-box"><div class="chart-state"><p>${copy.reading.loading}</p></div></div></div>`;
    void this.load();
  }

  dispose(): void {
    this.alive = false;
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
      this.renderMessage(notFound ? copy.reading.notFound : copy.reading.loadFailed);
      return;
    }
    if (this.gone()) return;
    let engine: Engine;
    try {
      engine = engineFor(record.engine_version);
    } catch {
      this.renderMessage(copy.reading.unknownEngine(record.engine_version));
      return;
    }
    this.render(record, engine);
  }

  private renderMessage(message: string): void {
    this.root.innerHTML = messageMarkup(message, "own", copy.reading.ownReading);
    required(this.root, "#own", HTMLButtonElement).addEventListener("click", () => {
      this.navigate("/");
    });
  }

  private render(record: ReadingRecord, engine: Engine): void {
    const snapshot: Candle[] = record.candles_snapshot.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    const last = snapshot[snapshot.length - 1];
    const prev = snapshot[snapshot.length - 1 - CHANGE_LOOKBACK];
    if (last === undefined || prev === undefined) {
      this.renderMessage(copy.reading.loadFailed);
      return;
    }
    const results = engine.forecastFromCards({
      asset: record.asset,
      anchorTs: record.anchor_ts,
      snapshot,
      cards: record.steps,
    });
    const meta = copy.reading.meta(
      record.id,
      utcDateTime(new Date(record.created_at).getTime()),
      record.views,
      record.engine_version,
    );
    this.root.innerHTML = readingMarkup(record, meta, results.length);
    const el = lookup(this.root);
    setEngineVersion(record.engine_version);
    setSource(record.source);
    setLag(null);

    el.sym.textContent = record.asset;
    el.last.textContent = formatPrice(last.c);
    const change = (last.c / prev.c - 1) * 100;
    el.chg.textContent = formatChange(change);
    el.chg.style.color = change >= 0 ? "var(--up)" : "var(--down)";
    const atrNote = copy.atrNote(formatPrice(engine.atr(snapshot)));
    el.note.textContent = atrNote;
    this.setStepsBar(el, results.length);

    const blocks: SpreadBlock[] = [...el.blocks.querySelectorAll<HTMLElement>(".step-block")].map((block) => ({
      spread: required(block, ".spread", HTMLElement),
      reading: required(block, ".reading", HTMLElement),
    }));
    results.forEach((step, index) => {
      const block = blocks[index];
      if (block !== undefined) showStep(block, step, engine.cardById);
    });

    const chart = createCandleChart(el.chart);
    this.chart = chart;
    const liveBlock: SpreadBlock = { spread: el.liveSpread, reading: el.liveReading };

    el.replay.addEventListener("click", () => {
      void this.replay(el, chart, liveBlock, blocks, results, engine, record, atrNote);
    });
    el.own.addEventListener("click", () => {
      postEvent({ type: "own_reading_clicked", asset: record.asset, reading_id: record.id });
      this.navigate(`/?asset=${encodeURIComponent(record.asset)}`);
    });
    el.share.addEventListener("click", () => {
      openShareModal(window.location.href, record.asset, results.length);
    });

    void this.reveal(el, chart, snapshot, results, engine, record);
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
    engine: Engine,
    record: ReadingRecord,
  ): Promise<void> {
    await chart.showSnapshot(snapshot, true);
    if (this.gone()) return;
    chart.setSteps(results.length);
    chart.setForecast(results.flatMap((step) => step.candles));
    await this.checkProphecy(el, chart, results, engine, record);
  }

  private async checkProphecy(
    el: Elements,
    chart: CandleChart,
    results: StepResult[],
    engine: Engine,
    record: ReadingRecord,
  ): Promise<void> {
    el.prophecy.innerHTML = pendingMarkup(copy.prophecy.checking, null);
    const total = results.length * CANDLES_PER_DAY;
    const started = performance.now();
    let real: Candle[];
    try {
      real = await fetchAfter(record.asset, record.anchor_ts, total, record.source, Date.now());
    } catch {
      if (this.gone()) return;
      setLag(null);
      el.prophecy.innerHTML = pendingMarkup(copy.prophecy.checkFailed, "recheck");
      required(el.prophecy, "#recheck", HTMLButtonElement).addEventListener("click", () => {
        void this.checkProphecy(el, chart, results, engine, record);
      });
      return;
    }
    setLag(Math.round(performance.now() - started));
    if (this.gone()) return;
    if (real.length === 0) {
      el.prophecy.innerHTML = pendingMarkup(copy.prophecy.notYet(utcTime(record.anchor_ts + 2 * HOUR_MS)), null);
      return;
    }
    this.actual = real;
    chart.setActual(real);
    const overall = engine.accuracy(
      results.flatMap((step) => step.candles),
      real,
    );
    const perStep = results.map((step) => engine.accuracy(step.candles, real));
    el.prophecy.innerHTML = verdictMarkup(overall, perStep, total);
  }

  private async replay(
    el: Elements,
    chart: CandleChart,
    live: SpreadBlock,
    blocks: SpreadBlock[],
    results: StepResult[],
    engine: Engine,
    record: ReadingRecord,
    atrNote: string,
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    el.replay.disabled = true;
    el.note.textContent = copy.reading.replaying;
    el.blocks.hidden = true;
    el.live.hidden = false;
    resetBlock(live);
    chart.setActual([]);
    chart.setForecast([]);
    chart.setSteps(0);
    this.setStepsBar(el, 0);
    for (const [index, step] of results.entries()) {
      if (this.gone()) return;
      await revealStep(live, el.stage, step, engine.cardById);
      if (this.gone()) return;
      chart.setSteps(index + 1);
      this.setStepsBar(el, index + 1);
      for (const candle of step.candles) {
        if (this.gone()) return;
        chart.appendForecast(candle);
        await sleep(FLOW_MS_PER_CANDLE);
      }
    }
    if (this.actual !== null) chart.setActual(this.actual);
    results.forEach((step, index) => {
      const block = blocks[index];
      if (block !== undefined) showStep(block, step, engine.cardById);
    });
    el.live.hidden = true;
    el.blocks.hidden = false;
    el.note.textContent = atrNote;
    el.replay.disabled = false;
    this.busy = false;
    postEvent({ type: "replayed", asset: record.asset, reading_id: record.id });
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

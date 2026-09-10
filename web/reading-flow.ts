/**
 * The landing: load a chart for an asset, open up to three steps with the loot-box theatre, share the reading.
 * Candles come straight from the exchange and steps from the engine in this browser; the API is only asked to
 * store a reading, count today's visitors and take funnel events, and every one of those calls degrades quietly.
 */
import { engineFor, type Engine } from "../engine/index";
import type { Candle } from "../engine/v1/atr";
import { ENGINE_VERSION, type StepResult } from "../engine/v1/index";
import { ASSET_PATTERN, fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { ApiError, createReading, fetchTodayCount, postEvent } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { copy } from "./copy";
import { required } from "./dom-lookup";
import { setEngineVersion, setLag, setSource } from "./footer";
import { openPaywall } from "./paywall-modal";
import { formatChange, formatPrice } from "./price-format";
import type { View } from "./router";
import { openShareModal } from "./share-modal";
import { resetBlock, revealStep, type SpreadBlock } from "./spread";
import { sleep } from "./stage-effects";
import { toast } from "./toast";

const FREE_STEPS = 3;
const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;

interface Loaded {
  asset: string;
  anchorTs: number;
  snapshot: Candle[];
  source: Source;
  steps: StepResult[];
}

interface Elements {
  asset: HTMLInputElement;
  load: HTMLButtonElement;
  src: HTMLElement;
  asked: HTMLElement;
  stage: HTMLElement;
  sym: HTMLElement;
  last: HTMLElement;
  chg: HTMLElement;
  steps: HTMLElement;
  chart: HTMLElement;
  chartState: HTMLElement;
  chartMessage: HTMLElement;
  retry: HTMLButtonElement;
  spread: HTMLElement;
  reading: HTMLElement;
  disclaimer: HTMLElement;
  draw: HTMLButtonElement;
  share: HTMLButtonElement;
  note: HTMLElement;
}

function landingMarkup(): string {
  return `
<div class="ask">
  <label for="asset">Инструмент</label>
  <input id="asset" value="BTCUSDT" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20">
  <button class="go" id="load">Загрузить график</button>
  <span class="src" id="src"></span>
</div>
<p class="asked" id="asked" hidden></p>
<div class="stage" id="stage">
  <div class="stage-top">
    <div class="px"><span id="sym">—</span> <span id="last">—</span><span class="chg" id="chg"></span></div>
    <div class="steps" id="steps"><span></span><span></span><span></span></div>
  </div>
  <div class="chart-box">
    <div class="chart" id="chart"></div>
    <div class="chart-state" id="chart-state">
      <p id="chart-message">${copy.enterAsset}</p>
      <button class="go" id="retry" hidden>${copy.retry}</button>
    </div>
  </div>
  <div class="spread" id="spread"></div>
  <div class="reading" id="reading"></div>
  <p class="disclaimer" id="disclaimer" hidden>${copy.disclaimer}</p>
  <div class="actions">
    <button class="draw" id="draw" disabled>${copy.drawStep(1)}</button>
    <button class="share" id="share" disabled>Поделиться</button>
    <span class="note" id="note">${copy.enterAsset}</span>
  </div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    asset: required(root, "#asset", HTMLInputElement),
    load: required(root, "#load", HTMLButtonElement),
    src: required(root, "#src", HTMLElement),
    asked: required(root, "#asked", HTMLElement),
    stage: required(root, "#stage", HTMLElement),
    sym: required(root, "#sym", HTMLElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    steps: required(root, "#steps", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    chartState: required(root, "#chart-state", HTMLElement),
    chartMessage: required(root, "#chart-message", HTMLElement),
    retry: required(root, "#retry", HTMLButtonElement),
    spread: required(root, "#spread", HTMLElement),
    reading: required(root, "#reading", HTMLElement),
    disclaimer: required(root, "#disclaimer", HTMLElement),
    draw: required(root, "#draw", HTMLButtonElement),
    share: required(root, "#share", HTMLButtonElement),
    note: required(root, "#note", HTMLElement),
  };
}

function shareErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 502) return copy.share.snapshotFailed;
    if (error.status === 422) return copy.exchange.too_old;
    if (error.status === 429) return copy.share.tooMany;
  }
  return copy.share.failed;
}

class LandingPage {
  private readonly el: Elements;
  private readonly chart: CandleChart;
  private readonly engine: Engine = engineFor(ENGINE_VERSION);
  private readonly block: SpreadBlock;
  private alive = true;
  private busy = false;
  private loaded: Loaded | null = null;

  constructor(root: HTMLElement, params: URLSearchParams) {
    root.innerHTML = landingMarkup();
    this.el = lookup(root);
    this.block = { spread: this.el.spread, reading: this.el.reading };
    resetBlock(this.block);
    this.chart = createCandleChart(this.el.chart);
    setEngineVersion(ENGINE_VERSION);
    setSource(null);

    const load = (): void => {
      void this.load();
    };
    this.el.load.addEventListener("click", load);
    this.el.retry.addEventListener("click", load);
    this.el.asset.addEventListener("keydown", (event) => {
      if (event.key === "Enter") load();
    });
    this.el.draw.addEventListener("click", () => {
      void this.openStep();
    });
    this.el.share.addEventListener("click", () => {
      void this.share();
    });

    const preset = (params.get("asset") ?? "").trim().toUpperCase();
    if (preset !== "") {
      this.el.asset.value = preset;
      load();
    }
    this.showTodayCount();
  }

  dispose(): void {
    this.alive = false;
    this.chart.remove();
  }

  // Read through a method: an `if (!this.alive)` guard would narrow the field to `true` for the rest of the flow.
  private gone(): boolean {
    return !this.alive;
  }

  private currentAsset(): string | null {
    return this.loaded?.asset ?? null;
  }

  private showTodayCount(): void {
    fetchTodayCount()
      .then((count) => {
        if (this.gone()) return;
        this.el.asked.textContent = copy.asked(count);
        this.el.asked.hidden = false;
      })
      .catch(() => undefined);
  }

  private note(text: string): void {
    this.el.note.textContent = text;
  }

  private chartState(message: string | null, retry: boolean): void {
    this.el.chartState.hidden = message === null;
    this.el.chartMessage.textContent = message ?? "";
    this.el.retry.hidden = !retry;
  }

  private setStepsBar(done: number): void {
    [...this.el.steps.children].forEach((mark, index) => {
      mark.classList.toggle("done", index < done);
    });
  }

  private async load(): Promise<void> {
    if (this.busy) return;
    const asset = this.el.asset.value.trim().toUpperCase();
    this.el.asset.value = asset;
    if (!ASSET_PATTERN.test(asset)) {
      this.note(copy.badAsset);
      this.chartState(copy.badAsset, false);
      return;
    }
    this.busy = true;
    this.loaded = null;
    this.el.draw.disabled = true;
    this.el.share.disabled = true;
    this.el.draw.textContent = copy.drawStep(1);
    this.el.src.textContent = "";
    this.el.disclaimer.hidden = true;
    this.note(copy.loading);
    this.chartState(copy.loading, false);
    resetBlock(this.block);
    this.setStepsBar(0);

    const anchorTs = lastClosedAnchor(Date.now());
    const started = performance.now();
    let snapshot;
    try {
      snapshot = await fetchSnapshot(asset, anchorTs);
    } catch (error: unknown) {
      this.busy = false;
      setLag(null);
      if (this.gone()) return;
      const kind = error instanceof ExchangeError ? error.kind : "unavailable";
      this.chartState(copy.exchange[kind], kind !== "unknown_asset");
      this.note(copy.exchange[kind]);
      return;
    }
    this.busy = false;
    setLag(Math.round(performance.now() - started));
    if (this.gone()) return;

    const candles = snapshot.candles;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 1 - CHANGE_LOOKBACK];
    if (last === undefined || prev === undefined) {
      this.chartState(copy.exchange.too_old, true);
      this.note(copy.exchange.too_old);
      return;
    }
    this.loaded = { asset, anchorTs, snapshot: candles, source: snapshot.source, steps: [] };
    this.el.src.textContent = copy.source(copy.sources[snapshot.source]);
    setSource(snapshot.source);
    this.el.sym.textContent = asset;
    this.el.last.textContent = formatPrice(last.c);
    const change = (last.c / prev.c - 1) * 100;
    this.el.chg.textContent = formatChange(change);
    this.el.chg.style.color = change >= 0 ? "var(--up)" : "var(--down)";
    this.note(copy.atrNote(formatPrice(this.engine.atr(candles))));
    this.chartState(null, false);

    await this.chart.showSnapshot(candles, true);
    if (this.gone() || this.currentAsset() !== asset) return;
    this.el.draw.disabled = false;
    postEvent({ type: "chart_loaded", asset });
  }

  private async openStep(): Promise<void> {
    const loaded = this.loaded;
    if (this.busy || loaded === null) return;
    if (loaded.steps.length >= FREE_STEPS) {
      openPaywall();
      postEvent({ type: "paywall_hit", asset: loaded.asset, step: FREE_STEPS + 1 });
      return;
    }
    const step = loaded.steps.length + 1;
    const input = { asset: loaded.asset, anchorTs: loaded.anchorTs, snapshot: loaded.snapshot, steps: step };
    const result = this.engine.computeSteps(input)[step - 1];
    if (result === undefined) return;

    this.busy = true;
    this.el.draw.disabled = true;
    this.el.share.disabled = true;
    await revealStep(this.block, this.el.stage, result, this.engine.cardById);
    if (this.gone()) return;
    loaded.steps.push(result);
    this.chart.setSteps(step);
    this.setStepsBar(step);
    this.el.disclaimer.hidden = false;
    for (const candle of result.candles) {
      if (this.gone()) return;
      this.chart.appendForecast(candle);
      await sleep(FLOW_MS_PER_CANDLE);
    }
    this.busy = false;
    this.el.share.disabled = false;
    this.el.draw.textContent = copy.drawStep(step + 1);
    this.el.draw.disabled = false;
    postEvent({ type: "step_opened", asset: loaded.asset, step });
  }

  private async share(): Promise<void> {
    const loaded = this.loaded;
    if (this.busy || loaded === null || loaded.steps.length === 0) return;
    this.el.share.disabled = true;
    try {
      const created = await createReading({
        asset: loaded.asset,
        anchor_ts: loaded.anchorTs,
        steps: loaded.steps.length,
        source: loaded.source,
        engine_version: ENGINE_VERSION,
      });
      if (this.gone()) return;
      openShareModal(new URL(created.url, window.location.origin).href, loaded.asset, loaded.steps.length);
    } catch (error: unknown) {
      if (!this.gone()) toast(shareErrorMessage(error));
    } finally {
      this.el.share.disabled = false;
    }
  }
}

export function landingView(params: URLSearchParams): View {
  let page: LandingPage | null = null;
  return {
    mount(root) {
      page = new LandingPage(root, params);
    },
    unmount() {
      page?.dispose();
      page = null;
    },
  };
}

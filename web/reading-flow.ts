/**
 * The landing: pick an instrument, load its chart, open two free steps with the fullscreen reveal, hit the paywall
 * on the third, share the reading. Candles come straight from the exchange and steps from the engine in this
 * browser; the API only stores a reading, counts today's visitors and takes funnel events, and every one of those
 * calls degrades quietly.
 */
import { engineFor, type Engine } from "../engine/index";
import type { Candle } from "../engine/v1/atr";
import { ENGINE_VERSION, type StepResult } from "../engine/v1/index";
import { ASSET_PATTERN, fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { ApiError, createReading, fetchTodayCount, postEvent } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { createCoinPicker, type CoinPicker } from "./coin-picker";
import { copy } from "./copy";
import { required } from "./dom-lookup";
import { showExchangeLogo } from "./exchange-logo";
import { openPaywall } from "./paywall-modal";
import { formatChange, formatPrice } from "./price-format";
import { playReveal } from "./reveal-overlay";
import type { View } from "./router";
import { openShareModal } from "./share-modal";
import { cardsOf, createSpreadPanel, type SpreadPanel } from "./spread-panel";
import { sleep } from "./stage-effects";
import { setTechFacts } from "./tech-panel";
import { toast } from "./toast";

const FREE_STEPS = 2;
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
  picker: HTMLElement;
  load: HTMLButtonElement;
  asked: HTMLElement;
  stage: HTMLElement;
  sym: HTMLElement;
  srcLogo: HTMLImageElement;
  last: HTMLElement;
  chg: HTMLElement;
  steps: HTMLElement;
  chart: HTMLElement;
  chartState: HTMLElement;
  chartMessage: HTMLElement;
  retry: HTMLButtonElement;
  panel: HTMLElement;
  draw: HTMLButtonElement;
  share: HTMLButtonElement;
  note: HTMLElement;
}

function landingMarkup(): string {
  return `
<div class="ask">
  <label for="asset">Инструмент</label>
  <div id="picker"></div>
  <button class="go" id="load">Загрузить график</button>
  <p class="asked" id="asked" hidden></p>
</div>
<div class="stage" id="stage">
  <div class="stage-top">
    <div class="px"><span id="sym">—</span><img class="src-logo" id="src-logo" alt="" hidden><span id="last">—</span><span class="chg" id="chg"></span></div>
    <div class="steps" id="steps" title="${copy.lockedStep}"><span></span><span></span><span class="locked"></span></div>
  </div>
  <div class="chart-box">
    <div class="chart" id="chart"></div>
    <div class="chart-state" id="chart-state">
      <p id="chart-message">${copy.enterAsset}</p>
      <button class="go" id="retry" hidden>${copy.retry}</button>
    </div>
  </div>
  <div id="panel"></div>
  <div class="actions">
    <button class="draw" id="draw" disabled>${copy.drawStep(1)}</button>
    <button class="share" id="share" disabled>Поделиться</button>
    <span class="note" id="note">${copy.enterAsset}</span>
  </div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    picker: required(root, "#picker", HTMLElement),
    load: required(root, "#load", HTMLButtonElement),
    asked: required(root, "#asked", HTMLElement),
    stage: required(root, "#stage", HTMLElement),
    sym: required(root, "#sym", HTMLElement),
    srcLogo: required(root, "#src-logo", HTMLImageElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    steps: required(root, "#steps", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    chartState: required(root, "#chart-state", HTMLElement),
    chartMessage: required(root, "#chart-message", HTMLElement),
    retry: required(root, "#retry", HTMLButtonElement),
    panel: required(root, "#panel", HTMLElement),
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
  private readonly picker: CoinPicker;
  private readonly panel: SpreadPanel;
  private alive = true;
  private busy = false;
  private loaded: Loaded | null = null;

  constructor(root: HTMLElement, params: URLSearchParams) {
    root.innerHTML = landingMarkup();
    this.el = lookup(root);
    this.panel = createSpreadPanel(this.el.panel, this.engine.cardById, true);
    this.chart = createCandleChart(this.el.chart);
    setTechFacts({ lag: null, source: null, engine: ENGINE_VERSION, anchorTs: null, atr: null, readingId: null });

    const load = (): void => {
      void this.load();
    };
    const preset = (params.get("asset") ?? "").trim().toUpperCase();
    this.picker = createCoinPicker(this.el.picker, preset === "" ? "BTCUSDT" : preset, load);
    this.el.load.addEventListener("click", load);
    this.el.retry.addEventListener("click", load);
    this.el.draw.addEventListener("click", () => {
      void this.openStep();
    });
    this.el.share.addEventListener("click", () => {
      void this.share();
    });

    if (preset !== "") load();
    this.showTodayCount();
  }

  dispose(): void {
    this.alive = false;
    this.panel.dispose();
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
    const asset = this.picker.value();
    this.picker.setValue(asset);
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
    showExchangeLogo(this.el.srcLogo, null);
    this.note(copy.loading);
    this.chartState(copy.loading, false);
    this.panel.clear();
    this.panel.setAtr(null);
    this.setStepsBar(0);
    setTechFacts({ lag: null, source: null, anchorTs: null, atr: null });

    const anchorTs = lastClosedAnchor(Date.now());
    const started = performance.now();
    let snapshot;
    try {
      snapshot = await fetchSnapshot(asset, anchorTs);
    } catch (error: unknown) {
      this.busy = false;
      if (this.gone()) return;
      const kind = error instanceof ExchangeError ? error.kind : "unavailable";
      this.chartState(copy.exchange[kind], kind !== "unknown_asset");
      this.note(copy.exchange[kind]);
      return;
    }
    this.busy = false;
    const lag = Math.round(performance.now() - started);
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
    const atr = formatPrice(this.engine.atr(candles));
    setTechFacts({ lag, source: snapshot.source, anchorTs, atr });
    showExchangeLogo(this.el.srcLogo, snapshot.source);
    this.el.sym.textContent = asset;
    this.el.last.textContent = formatPrice(last.c);
    const change = (last.c / prev.c - 1) * 100;
    this.el.chg.textContent = formatChange(change);
    this.el.chg.style.color = change >= 0 ? "var(--up)" : "var(--down)";
    this.panel.setAtr(copy.atrLine(atr));
    this.note("");
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
    await playReveal(cardsOf(result, this.engine.cardById));
    if (this.gone()) return;
    loaded.steps.push(result);
    this.panel.setSteps(loaded.steps, step - 1);
    this.chart.setSteps(step);
    this.setStepsBar(step);
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

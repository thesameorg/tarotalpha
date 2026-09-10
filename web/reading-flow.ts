/**
 * The landing: the chart of the instrument picked in its header loads by itself (the URL's `asset`, the last one
 * used, or BTCUSDT), two free steps open with the fullscreen reveal, the third hits the paywall, the reading is
 * shared with the author's language in the link. Candles come straight from the exchange and steps from the engine
 * in this browser; the API only stores a reading and takes funnel events, and both calls degrade quietly. Every
 * label is a function of the dictionary, so a language switch relabels the page without touching its state.
 */
import { computeSteps, ENGINE_VERSION, natr, type Candle, type StepResult } from "../engine/index";
import { ASSET_PATTERN, fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { ApiError, createReading, postEvent } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { createCoinPicker, type CoinPicker } from "./coin-picker";
import { required } from "./dom-lookup";
import { showExchangeLogo } from "./exchange-logo";
import { lang, onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { openPaywall } from "./paywall-modal";
import { formatChange, formatPrice } from "./price-format";
import { playReveal } from "./reveal-overlay";
import type { View } from "./router";
import { openShareModal } from "./share-modal";
import { cardsOf, createSpreadPanel, type SpreadPanel } from "./spread-panel";
import { formatAtr } from "./spread-summary";
import { sleep } from "./stage-effects";
import { setTechFacts } from "./tech-panel";
import { toast } from "./toast";

const FREE_STEPS = 2;
const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;
const DEFAULT_ASSET = "BTCUSDT";
const ASSET_KEY = "ta.asset";

type Text = () => string;

interface Loaded {
  asset: string;
  anchorTs: number;
  snapshot: Candle[];
  source: Source;
  steps: StepResult[];
}

interface Elements {
  picker: HTMLElement;
  stage: HTMLElement;
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

function storedAsset(): string | null {
  try {
    return localStorage.getItem(ASSET_KEY);
  } catch {
    return null;
  }
}

function storeAsset(asset: string): void {
  try {
    localStorage.setItem(ASSET_KEY, asset);
  } catch {
    // Private mode or a full quota: the next visit just starts from the default again.
  }
}

function landingMarkup(): string {
  return `
<div class="stage" id="stage">
  <div class="stage-top">
    <div class="px"><div id="picker"></div><img class="src-logo" id="src-logo" alt="" hidden><span id="last">—</span><span class="chg" id="chg"></span></div>
    <div class="steps" id="steps"><span></span><span></span><span class="locked"></span></div>
  </div>
  <div class="chart-box">
    <div class="chart" id="chart"></div>
    <div class="chart-state" id="chart-state">
      <p id="chart-message"></p>
      <button class="go" id="retry" hidden></button>
    </div>
  </div>
  <div id="panel"></div>
  <div class="actions">
    <div class="group">
      <button class="draw" id="draw" disabled></button>
      <button class="icon-btn" id="share" type="button" disabled>${icons.share}</button>
    </div>
    <span class="note" id="note"></span>
  </div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    picker: required(root, "#picker", HTMLElement),
    stage: required(root, "#stage", HTMLElement),
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
    if (error.status === 502) return t().share.snapshotFailed;
    if (error.status === 422) return t().exchange.too_old;
    if (error.status === 429) return t().share.tooMany;
  }
  return t().share.failed;
}

class LandingPage {
  private readonly el: Elements;
  private readonly chart: CandleChart;
  private readonly picker: CoinPicker;
  private readonly panel: SpreadPanel;
  private readonly unsubscribe: () => void;
  private alive = true;
  private busy = false;
  private loadSeq = 0;
  private loaded: Loaded | null = null;
  private noteText: Text | null = null;
  private stateText: Text | null = null;
  private stateRetry = false;

  constructor(root: HTMLElement, params: URLSearchParams) {
    root.innerHTML = landingMarkup();
    this.el = lookup(root);
    this.panel = createSpreadPanel(this.el.panel, true);
    this.chart = createCandleChart(this.el.chart);
    setTechFacts({ lag: null, source: null, engine: ENGINE_VERSION, anchorTs: null, atr: null, readingId: null });
    this.unsubscribe = onLangChange(() => {
      this.relabel();
    });

    const preset = (params.get("asset") ?? "").trim().toUpperCase();
    const initial = preset === "" ? (storedAsset() ?? DEFAULT_ASSET) : preset;
    this.picker = createCoinPicker(this.el.picker, initial, (symbol) => {
      void this.load(symbol);
    });
    this.el.retry.addEventListener("click", () => {
      void this.load(this.picker.value());
    });
    this.el.draw.addEventListener("click", () => {
      void this.openStep();
    });
    this.el.share.addEventListener("click", () => {
      void this.share();
    });
    this.relabel();
    void this.load(initial);
  }

  dispose(): void {
    this.alive = false;
    this.unsubscribe();
    this.panel.dispose();
    this.chart.remove();
  }

  // Read through a method: an `if (!this.alive)` guard would narrow the field to `true` for the rest of the flow.
  private gone(): boolean {
    return !this.alive;
  }

  private note(text: Text | null): void {
    this.noteText = text;
    this.el.note.textContent = text?.() ?? "";
  }

  private chartState(text: Text | null, retry: boolean): void {
    this.stateText = text;
    this.stateRetry = retry;
    this.el.chartState.hidden = text === null;
    this.el.chartMessage.textContent = text?.() ?? "";
    this.el.retry.hidden = !retry;
  }

  private relabel(): void {
    this.note(this.noteText);
    this.chartState(this.stateText, this.stateRetry);
    this.el.retry.textContent = t().retry;
    this.el.draw.textContent = t().drawStep((this.loaded?.steps.length ?? 0) + 1);
    this.el.share.setAttribute("aria-label", t().share.button);
    this.el.share.title = t().share.button;
    this.el.steps.title = t().lockedStep;
    this.showPrice();
  }

  private showPrice(): void {
    const candles = this.loaded?.snapshot ?? [];
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 1 - CHANGE_LOOKBACK];
    if (last === undefined || prev === undefined) {
      this.el.last.textContent = "—";
      this.el.chg.textContent = "";
      return;
    }
    const change = (last.c / prev.c - 1) * 100;
    this.el.last.textContent = formatPrice(last.c);
    this.el.chg.textContent = formatChange(change);
    this.el.chg.style.color = change >= 0 ? "var(--up)" : "var(--down)";
  }

  private setStepsBar(done: number): void {
    [...this.el.steps.children].forEach((mark, index) => {
      mark.classList.toggle("done", index < done);
    });
  }

  // A newer pick wins: every await checks that this load is still the latest and the page is still mounted.
  private async load(asset: string): Promise<void> {
    const seq = ++this.loadSeq;
    const stale = (): boolean => this.gone() || seq !== this.loadSeq;
    this.picker.setValue(asset);
    if (!ASSET_PATTERN.test(asset)) {
      this.note(() => t().badAsset);
      this.chartState(() => t().badAsset, false);
      return;
    }
    this.loaded = null;
    this.el.draw.disabled = true;
    this.el.share.disabled = true;
    showExchangeLogo(this.el.srcLogo, null);
    this.showPrice();
    this.note(() => t().loading);
    this.chartState(() => t().loading, false);
    this.relabel();
    this.panel.clear();
    this.setStepsBar(0);
    setTechFacts({ lag: null, source: null, anchorTs: null, atr: null });

    const anchorTs = lastClosedAnchor(Date.now());
    const started = performance.now();
    let snapshot;
    try {
      snapshot = await fetchSnapshot(asset, anchorTs);
    } catch (error: unknown) {
      if (stale()) return;
      const kind = error instanceof ExchangeError ? error.kind : "unavailable";
      this.chartState(() => t().exchange[kind], kind !== "unknown_asset");
      this.note(() => t().exchange[kind]);
      return;
    }
    const lag = Math.round(performance.now() - started);
    if (stale()) return;

    const candles = snapshot.candles;
    if (candles.length <= CHANGE_LOOKBACK) {
      this.chartState(() => t().exchange.too_old, true);
      this.note(() => t().exchange.too_old);
      return;
    }
    this.loaded = { asset, anchorTs, snapshot: candles, source: snapshot.source, steps: [] };
    storeAsset(asset);
    const atr = formatAtr(natr(candles));
    setTechFacts({ lag, source: snapshot.source, anchorTs, atr });
    showExchangeLogo(this.el.srcLogo, snapshot.source);
    this.showPrice();
    this.note(null);
    this.chartState(null, false);

    await this.chart.showSnapshot(candles, true);
    if (stale()) return;
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
    const result = computeSteps(input)[step - 1];
    if (result === undefined) return;

    this.busy = true;
    this.el.draw.disabled = true;
    this.el.share.disabled = true;
    const pulled = await playReveal(cardsOf(result));
    if (this.gone()) return;
    if (!pulled) {
      this.busy = false;
      this.el.draw.disabled = false;
      this.el.share.disabled = loaded.steps.length === 0;
      return;
    }
    loaded.steps.push(result);
    this.panel.setSteps(loaded.steps, step - 1);
    this.chart.setSteps(step);
    this.setStepsBar(step);
    // Another instrument picked while the candles flow in: that load owns the chart now, this step stops.
    for (const candle of result.candles) {
      if (this.gone() || this.loaded !== loaded) {
        this.busy = false;
        return;
      }
      this.chart.appendForecast(candle);
      await sleep(FLOW_MS_PER_CANDLE);
    }
    this.busy = false;
    if (this.loaded !== loaded) return;
    this.el.share.disabled = false;
    this.el.draw.textContent = t().drawStep(step + 1);
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
      const url = new URL(created.url, window.location.origin);
      url.searchParams.set("lang", lang());
      openShareModal(url.href);
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

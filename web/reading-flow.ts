/**
 * The landing: the chart of the instrument picked in its header loads by itself (the URL's `asset`, the last one
 * used, or BTCUSDT), two free steps open with the fullscreen reveal, the third hits the paywall, the reading is
 * shared with the author's language in the link. Candles come straight from the exchange and steps from the engine
 * in this browser; the API only stores a reading and takes funnel events, and both calls degrade quietly. Every
 * label is a function of the dictionary, so a language switch relabels the page without touching its state.
 * The only buttons are the row over the free days of the forecast zone: the next day and, once a day is open,
 * share. On a wide screen the row rides with the chart and shortens to the day alone when the free part is narrow;
 * on a phone it stands at the right of the chart with the full label wrapped.
 */
import { computeSteps, ENGINE_VERSION, forecastFromCards, type Candle, type StepResult } from "../engine/index";
import { ASSET_PATTERN, fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { ApiError, createReading, postEvent } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { createCoinPicker, type CoinPicker } from "./coin-picker";
import { required } from "./dom-lookup";
import { showExchangeLogo } from "./exchange-logo";
import type { ZoneLayout } from "./forecast-zone";
import { lang, onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { openPaywall } from "./paywall-modal";
import { formatChange, formatPrice } from "./price-format";
import { onReaderChange, reader } from "./reader-choice";
import { initReaderPicker } from "./reader-picker";
import { playReveal } from "./reveal-overlay";
import type { View } from "./router";
import { openShareModal } from "./share-modal";
import { cardsOf, createSpreadPanel, type SpreadPanel } from "./spread-panel";
import { sleep } from "./stage-effects";
import { toast } from "./toast";

const FREE_STEPS = 2;
const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;
const DEFAULT_ASSET = "BTCUSDT";
const ASSET_KEY = "ta.asset";
// The stylesheet's phone breakpoint: below it the row spans the pane instead of following the free days.
const narrow = window.matchMedia("(max-width: 640px)");
const ROW_MARGIN_PX = 8;

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
  readers: HTMLElement;
  stage: HTMLElement;
  srcLogo: HTMLImageElement;
  last: HTMLElement;
  chg: HTMLElement;
  steps: HTMLElement;
  chart: HTMLElement;
  chartState: HTMLElement;
  chartMessage: HTMLElement;
  retry: HTMLButtonElement;
  cta: HTMLElement;
  row: HTMLElement;
  ctaFull: HTMLElement;
  ctaShort: HTMLElement;
  draw: HTMLButtonElement;
  share: HTMLButtonElement;
  panel: HTMLElement;
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
    <div class="zone-cta" id="zone-cta" hidden>
      <div class="row">
        <button class="draw" id="draw" type="button" disabled><span class="full"></span><span class="short"></span></button>
        <button class="icon-btn" id="share" type="button" disabled hidden>${icons.share}</button>
      </div>
    </div>
    <div class="chart-state" id="chart-state">
      <p id="chart-message"></p>
      <button class="go" id="retry" hidden></button>
    </div>
  </div>
  <div class="readers" id="readers"></div>
  <div id="panel"></div>
</div>`;
}

function lookup(root: HTMLElement): Elements {
  return {
    picker: required(root, "#picker", HTMLElement),
    readers: required(root, "#readers", HTMLElement),
    stage: required(root, "#stage", HTMLElement),
    srcLogo: required(root, "#src-logo", HTMLImageElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    steps: required(root, "#steps", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    chartState: required(root, "#chart-state", HTMLElement),
    chartMessage: required(root, "#chart-message", HTMLElement),
    retry: required(root, "#retry", HTMLButtonElement),
    cta: required(root, "#zone-cta", HTMLElement),
    row: required(root, "#zone-cta .row", HTMLElement),
    ctaFull: required(root, "#zone-cta .full", HTMLElement),
    ctaShort: required(root, "#zone-cta .short", HTMLElement),
    draw: required(root, "#draw", HTMLButtonElement),
    share: required(root, "#share", HTMLButtonElement),
    panel: required(root, "#panel", HTMLElement),
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

// Where the free part begins: the last day separator, which is the anchor itself while no day is open.
const freeFrom = (zone: ZoneLayout): number => zone.separators[zone.separators.length - 1] ?? zone.start;

const sameZone = (a: ZoneLayout | null, b: ZoneLayout | null): boolean =>
  a === b || (a !== null && b !== null && a.start === b.start && a.width === b.width && freeFrom(a) === freeFrom(b));

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
  private zone: ZoneLayout | null = null;
  private readerPending = false;
  private stateText: Text | null = null;
  private stateRetry = false;

  constructor(root: HTMLElement, params: URLSearchParams) {
    root.innerHTML = landingMarkup();
    this.el = lookup(root);
    this.panel = createSpreadPanel(this.el.panel, true);
    this.chart = createCandleChart(this.el.chart);
    this.chart.onZoneLayout((layout) => {
      if (sameZone(layout, this.zone)) return;
      this.zone = layout;
      this.placeCta();
    });
    initReaderPicker(this.el.readers);
    const relabel = onLangChange(() => {
      this.relabel();
    });
    const rereads = onReaderChange(() => {
      this.applyReader();
    });
    this.unsubscribe = (): void => {
      relabel();
      rereads();
    };

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

  // Same cards, another reader's candles. A switch during the reveal waits for it: the flow is mid-animation.
  private applyReader(): void {
    const loaded = this.loaded;
    if (loaded === null) return;
    if (this.busy) {
      this.readerPending = true;
      return;
    }
    this.readerPending = false;
    if (loaded.steps.length === 0) return;
    loaded.steps = forecastFromCards({
      asset: loaded.asset,
      anchorTs: loaded.anchorTs,
      snapshot: loaded.snapshot,
      reader: reader(),
      cards: loaded.steps.map((s) => s.cards),
    });
    this.panel.setSteps(loaded.steps, loaded.steps.length - 1);
    this.chart.setForecast(loaded.steps.flatMap((s) => s.candles));
  }

  // Read through a method: an `if (!this.alive)` guard would narrow the field to `true` for the rest of the flow.
  private gone(): boolean {
    return !this.alive;
  }

  private chartState(text: Text | null, retry: boolean): void {
    this.stateText = text;
    this.stateRetry = retry;
    this.el.chartState.hidden = text === null;
    this.el.chartMessage.textContent = text?.() ?? "";
    this.el.retry.hidden = !retry;
  }

  private relabel(): void {
    this.chartState(this.stateText, this.stateRetry);
    this.el.retry.textContent = t().retry;
    this.labelDraw();
    this.el.share.setAttribute("aria-label", t().share.button);
    this.el.share.title = t().share.button;
    this.el.steps.title = t().lockedStep;
    this.showPrice();
  }

  private labelDraw(): void {
    const next = (this.loaded?.steps.length ?? 0) + 1;
    this.el.ctaFull.textContent = t().drawStep(next);
    this.el.ctaShort.textContent = t().day(next);
    this.el.draw.setAttribute("aria-label", t().drawStep(next));
  }

  private enableDraw(on: boolean): void {
    this.el.draw.disabled = !on;
    this.placeCta();
  }

  // The row stands over what is still free, from the last day separator to the pane's right edge. When even the
  // day alone does not fit there, and always on a phone, it spans the pane and keeps to the right edge instead.
  private placeCta(): void {
    const zone = this.zone;
    if (zone === null || this.el.draw.disabled) {
      this.el.cta.hidden = true;
      return;
    }
    this.el.share.hidden = (this.loaded?.steps.length ?? 0) === 0;
    const inFree = !narrow.matches && this.fit(Math.max(0, freeFrom(zone)), zone.width);
    const fits = inFree || this.fit(0, zone.width);
    this.el.cta.classList.toggle("edge", !inFree);
    this.el.cta.hidden = !fits;
  }

  // Lays the row out from `left` to the pane's right edge, the day alone when the full label is too wide, and says
  // whether even that fits; measured, so every language and font fallback gets the same rule.
  private fit(left: number, width: number): boolean {
    const free = width - left;
    const room = free - 2 * ROW_MARGIN_PX;
    this.el.cta.hidden = false;
    this.el.cta.style.left = `${String(left)}px`;
    this.el.cta.style.width = `${String(free)}px`;
    this.el.cta.classList.remove("compact");
    if (this.el.row.offsetWidth > room) this.el.cta.classList.add("compact");
    return this.el.row.offsetWidth <= room;
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
      this.chartState(() => t().badAsset, false);
      return;
    }
    this.loaded = null;
    this.enableDraw(false);
    this.el.share.disabled = true;
    showExchangeLogo(this.el.srcLogo, null);
    this.showPrice();
    this.chartState(() => t().loading, false);
    this.relabel();
    this.panel.clear();
    this.setStepsBar(0);

    const anchorTs = lastClosedAnchor(Date.now());
    let snapshot;
    try {
      snapshot = await fetchSnapshot(asset, anchorTs);
    } catch (error: unknown) {
      if (stale()) return;
      const kind = error instanceof ExchangeError ? error.kind : "unavailable";
      this.chartState(() => t().exchange[kind], kind !== "unknown_asset");
      return;
    }
    if (stale()) return;

    const candles = snapshot.candles;
    if (candles.length <= CHANGE_LOOKBACK) {
      this.chartState(() => t().exchange.too_old, true);
      return;
    }
    this.loaded = { asset, anchorTs, snapshot: candles, source: snapshot.source, steps: [] };
    storeAsset(asset);
    showExchangeLogo(this.el.srcLogo, snapshot.source);
    this.showPrice();
    this.chartState(null, false);

    await this.chart.showSnapshot(candles, true);
    if (stale()) return;
    this.enableDraw(true);
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
    const input = {
      asset: loaded.asset,
      anchorTs: loaded.anchorTs,
      snapshot: loaded.snapshot,
      reader: reader(),
      steps: step,
    };
    const result = computeSteps(input)[step - 1];
    if (result === undefined) return;

    this.busy = true;
    this.enableDraw(false);
    this.el.share.disabled = true;
    const pulled = await playReveal(cardsOf(result));
    if (this.gone()) return;
    if (!pulled) {
      this.busy = false;
      if (this.loaded === loaded) {
        this.enableDraw(true);
        this.el.share.disabled = false;
      }
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
    if (this.readerPending) this.applyReader();
    this.el.share.disabled = false;
    this.labelDraw();
    this.enableDraw(true);
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
        reader: reader(),
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

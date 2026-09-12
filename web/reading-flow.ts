/**
 * The landing: the chart of the instrument picked in the header loads by itself (the URL's `asset`, the last one
 * used, or BTCUSDT); price, exchange and timeframe sit on the chart itself. Each day costs its mana and opens with the
 * fullscreen reveal, a short tank opens the paywall. Candles come straight from the exchange and steps from the
 * engine in this browser. The first open step writes the reading through the API in the background and locks the
 * reader until a reload, another instrument or leaving the page drops the reading; the next step extends it, so
 * "Share" only hands out the link; the id lands in "my readings". Labels are functions of the dictionary, so a
 * language switch relabels in place. The only buttons are the row over the free days of the forecast zone: the next
 * day and, once a day is open, share; on a wide screen the row rides with the chart and shortens to the day alone.
 */
import { computeSteps, MAX_STEPS, type Candle, type StepResult } from "../engine/index";
import { ASSET_PATTERN, fetchSnapshot, lastClosedAnchor } from "../exchange/closed-candles";
import { ExchangeError, type Source } from "../exchange/provider";
import { ApiError, createReading, extendReading, postEvent } from "./api";
import { createCandleChart, type CandleChart } from "./chart";
import { createCoinPicker, type CoinPicker } from "./coin-picker";
import { required } from "./dom-lookup";
import { showExchangeLogo } from "./exchange-logo";
import type { ZoneLayout } from "./forecast-zone";
import { lang, onLangChange, t } from "./i18n/index";
import { icons } from "./icons";
import { zoneLabel } from "./local-time-format";
import { dayCost, manaLeft, spendMana } from "./mana";
import { rememberReading } from "./my-readings";
import { openPaywall } from "./paywall-modal";
import { formatChange, formatPrice } from "./price-format";
import { lockReader, onReaderChange, reader } from "./reader-choice";
import { initReaderPicker } from "./reader-picker";
import { cancelReveal, playReveal } from "./reveal-overlay";
import type { View } from "./router";
import { shareLink } from "./share-modal";
import { cardsOf, createSpreadPanel, type SpreadPanel } from "./spread-panel";
import { sleep } from "./stage-effects";
import { toast } from "./toast";

const FLOW_MS_PER_CANDLE = 45;
const CHANGE_LOOKBACK = 24;
const DEFAULT_ASSET = "BTCUSDT";
const ASSET_KEY = "ta.asset";
// The stylesheet's phone breakpoint: below it the row spans the pane instead of following the free days.
const narrow = window.matchMedia("(max-width: 640px)");
const ROW_MARGIN_PX = 8;

type Text = () => string;

/** A reading's entropy: 64 random bits as hex, short enough for a seed string and unique enough for a window. */
function newNonce(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface Loaded {
  asset: string;
  anchorTs: number;
  snapshot: Candle[];
  source: Source;
  /** This reading's own entropy: it goes into the seed, so the cards are nobody else's. */
  nonce: string;
  steps: StepResult[];
  /** The stored reading's id once the row holds every open step; null while nothing is stored or a write failed. */
  saved: Promise<string | null>;
}

interface Elements {
  picker: HTMLElement;
  readers: HTMLElement;
  stage: HTMLElement;
  srcLogo: HTMLImageElement;
  last: HTMLElement;
  chg: HTMLElement;
  chart: HTMLElement;
  chartState: HTMLElement;
  chartMessage: HTMLElement;
  retry: HTMLButtonElement;
  cta: HTMLElement;
  row: HTMLElement;
  ctaFull: HTMLElement;
  ctaShort: HTMLElement;
  ctaCost: HTMLElement;
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

function toolbarMarkup(): string {
  return `<div id="picker"></div>`;
}

function landingMarkup(): string {
  return `
<div class="stage" id="stage">
  <div class="chart-box">
    <div class="chart" id="chart"></div>
    <div class="legend"><div><img class="src-logo" id="src-logo" alt="" hidden><span>1H · ${zoneLabel(Date.now())}</span></div><div><span class="last" id="last">—</span><span class="chg" id="chg"></span></div></div>
    <div class="zone-cta" id="zone-cta" hidden>
      <div class="row">
        <button class="draw" id="draw" type="button" disabled><span class="full"></span><span class="short"></span><span class="cost"></span></button>
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

function lookup(root: HTMLElement, toolbar: HTMLElement): Elements {
  return {
    picker: required(toolbar, "#picker", HTMLElement),
    readers: required(root, "#readers", HTMLElement),
    stage: required(root, "#stage", HTMLElement),
    srcLogo: required(root, "#src-logo", HTMLImageElement),
    last: required(root, "#last", HTMLElement),
    chg: required(root, "#chg", HTMLElement),
    chart: required(root, "#chart", HTMLElement),
    chartState: required(root, "#chart-state", HTMLElement),
    chartMessage: required(root, "#chart-message", HTMLElement),
    retry: required(root, "#retry", HTMLButtonElement),
    cta: required(root, "#zone-cta", HTMLElement),
    row: required(root, "#zone-cta .row", HTMLElement),
    ctaFull: required(root, "#zone-cta .full", HTMLElement),
    ctaShort: required(root, "#zone-cta .short", HTMLElement),
    ctaCost: required(root, "#zone-cta .cost", HTMLElement),
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
  private readonly toolbar = required(document, "#toolbar", HTMLElement);
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
  private stateText: Text | null = null;
  private stateRetry = false;
  private stateBusy = false;

  constructor(root: HTMLElement, params: URLSearchParams) {
    root.innerHTML = landingMarkup();
    this.toolbar.innerHTML = toolbarMarkup();
    this.el = lookup(root, this.toolbar);
    this.panel = createSpreadPanel(this.el.panel, true, this.el.readers);
    this.chart = createCandleChart(this.el.chart);
    this.chart.onZoneLayout((layout) => {
      if (sameZone(layout, this.zone)) return;
      this.zone = layout;
      this.placeCta();
    });
    const unmountReader = initReaderPicker(this.el.readers);
    const relabel = onLangChange(() => {
      this.relabel();
    });
    // The reader is part of the label, so the price line is redrawn when she changes.
    const reprice = onReaderChange(() => {
      this.labelDraw();
    });
    this.unsubscribe = (): void => {
      unmountReader();
      relabel();
      reprice();
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
    lockReader(false);
    this.unsubscribe();
    this.picker.dispose();
    cancelReveal();
    this.toolbar.replaceChildren();
    this.panel.dispose();
    this.chart.remove();
  }

  // Read through a method: an `if (!this.alive)` guard would narrow the field to `true` for the rest of the flow.
  private gone(): boolean {
    return !this.alive;
  }

  private chartState(text: Text | null, retry: boolean, busy = false): void {
    this.stateText = text;
    this.stateRetry = retry;
    this.stateBusy = busy;
    this.el.chartState.hidden = text === null;
    this.el.chartState.classList.toggle("busy", busy);
    this.el.chartMessage.textContent = text?.() ?? "";
    this.el.retry.hidden = !retry;
  }

  private relabel(): void {
    this.chartState(this.stateText, this.stateRetry, this.stateBusy);
    this.el.retry.textContent = t().retry;
    this.labelDraw();
    this.el.share.setAttribute("aria-label", t().share.button);
    this.el.share.title = t().share.button;
    this.showPrice();
  }

  private labelDraw(): void {
    const next = (this.loaded?.steps.length ?? 0) + 1;
    if (next > MAX_STEPS) return;
    const cost = this.nextCost();
    this.el.ctaFull.textContent = t().drawStep(next);
    this.el.ctaShort.textContent = t().day(next);
    this.el.ctaCost.innerHTML = cost === 0 ? "" : `<span class="mana-glyph">${icons.bolt}</span>${String(cost)}`;
    const price = cost === 0 ? "" : ` · ${t().mana}: ${String(cost)}`;
    this.el.draw.setAttribute("aria-label", `${t().drawStep(next)}${price}`);
  }

  private nextCost(): number {
    return dayCost((this.loaded?.steps.length ?? 0) + 1);
  }

  private enableDraw(on: boolean): void {
    this.el.draw.disabled = !on;
    if (on) this.labelDraw();
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
    const open = this.loaded?.steps.length ?? 0;
    this.el.share.hidden = open === 0;
    this.el.draw.hidden = open >= MAX_STEPS;
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
    lockReader(false);
    this.enableDraw(false);
    this.el.share.disabled = true;
    showExchangeLogo(this.el.srcLogo, null);
    this.showPrice();
    this.chartState(() => t().loading, false, true);
    this.relabel();
    this.panel.clear();

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
    this.loaded = {
      asset,
      anchorTs,
      snapshot: candles,
      source: snapshot.source,
      nonce: newNonce(),
      steps: [],
      saved: Promise.resolve(null),
    };
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
    if (this.busy || loaded === null || loaded.steps.length >= MAX_STEPS) return;
    const step = loaded.steps.length + 1;
    const cost = this.nextCost();
    if (manaLeft() < cost) {
      openPaywall();
      postEvent({ type: "paywall_hit", asset: loaded.asset, step });
      return;
    }
    const input = {
      asset: loaded.asset,
      anchorTs: loaded.anchorTs,
      snapshot: loaded.snapshot,
      reader: reader(),
      nonce: loaded.nonce,
      steps: step,
    };
    const result = computeSteps(input)[step - 1];
    if (result === undefined) return;

    this.busy = true;
    this.enableDraw(false);
    this.el.share.disabled = true;
    const pulled = await playReveal(cardsOf(result));
    if (this.gone()) return;
    // Another instrument loaded under the reveal: this day belongs to nothing on screen, so it is neither paid nor kept.
    if (!pulled || this.loaded !== loaded) {
      this.busy = false;
      if (this.loaded === loaded) {
        this.enableDraw(true);
        this.el.share.disabled = false;
      }
      return;
    }
    // Paid once the third card is out: a reveal closed before that opened nothing and costs nothing.
    spendMana(cost);
    lockReader(true);
    loaded.steps.push(result);
    void this.persist(loaded, step);
    this.panel.setSteps(loaded.steps, step - 1);
    this.chart.setSteps(step);
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
    this.enableDraw(true);
    postEvent({ type: "step_opened", asset: loaded.asset, step });
  }

  // The row follows the steps in the background: the first one writes it, the next one extends it, and the entry
  // in "my readings" follows. A failed write leaves null behind, and "Share" then writes afresh and shows why.
  private persist(loaded: Loaded, steps: number): Promise<string> {
    const cards = loaded.steps.slice(0, steps).map((step) => step.cards);
    const saving = loaded.saved.then(async (id) => {
      const body = { steps, reader: reader() };
      const saved =
        id === null
          ? await createReading({
              asset: loaded.asset,
              anchor_ts: loaded.anchorTs,
              source: loaded.source,
              seed_nonce: loaded.nonce,
              cards,
              ...body,
            })
          : await extendReading(id, body);
      await rememberReading({
        id: saved.id,
        asset: loaded.asset,
        anchor_ts: loaded.anchorTs,
        ...body,
        steps: saved.steps,
      });
      return saved.id;
    });
    loaded.saved = saving.catch(() => null);
    return saving;
  }

  private async share(): Promise<void> {
    const loaded = this.loaded;
    if (this.busy || loaded === null || loaded.steps.length === 0) return;
    this.el.share.disabled = true;
    try {
      const id = (await loaded.saved) ?? (await this.persist(loaded, loaded.steps.length));
      if (this.gone()) return;
      const url = new URL(`/r/${id}`, window.location.origin);
      url.searchParams.set("lang", lang());
      postEvent({ type: "shared", asset: loaded.asset, reading_id: id, step: loaded.steps.length });
      shareLink(url.href);
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

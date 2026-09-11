/**
 * The instrument picker in the chart header: the ticker itself is the button. It opens a search box over the coin
 * list (icon, ticker, name); typing filters by ticker or name, arrows and Enter pick, Escape closes, a click picks.
 * A symbol that is not in the list still goes through on Enter: the list is a convenience, the exchange decides
 * what exists. Markup is rendered into the given root; what a pick does (load, navigate) is the caller's.
 */
import { COINS, type Coin } from "./coin-list";
import { required } from "./dom-lookup";
import { onLangChange, t } from "./i18n/index";
import { icons } from "./icons";

export interface CoinPicker {
  value(): string;
  setValue(symbol: string): void;
  /** Drops the language subscription; the page that mounted the picker calls it when it unmounts. */
  dispose(): void;
}

const MAX_ITEMS = 8;

function matches(query: string): Coin[] {
  const q = query.trim().toLowerCase();
  if (q === "") return COINS.slice(0, MAX_ITEMS);
  const starts = COINS.filter((c) => c.symbol.toLowerCase().startsWith(q) || c.base.toLowerCase().startsWith(q));
  const rest = COINS.filter(
    (c) => !starts.includes(c) && (c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
  );
  return [...starts, ...rest].slice(0, MAX_ITEMS);
}

function itemMarkup(coin: Coin, active: boolean): string {
  return `<li role="option" aria-selected="${String(active)}" class="${active ? "active" : ""}" data-symbol="${coin.symbol}"><img src="${coin.icon}" width="18" height="18" alt="" loading="lazy"><span class="ticker">${coin.symbol}</span><span class="name">${coin.name}</span></li>`;
}

function markup(): string {
  return `<button class="picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" title="${t().picker.choose}"><img class="picker-icon" alt="" hidden><span class="picker-ticker"></span>${icons.chevron}</button><div class="picker-pop" hidden><input id="asset" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="picker-list" aria-label="${t().picker.choose}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="${t().picker.placeholder}"><ul class="picker-list" id="picker-list" role="listbox"></ul></div>`;
}

export function createCoinPicker(root: HTMLElement, initial: string, onPick: (symbol: string) => void): CoinPicker {
  root.classList.add("picker");
  root.innerHTML = markup();
  const trigger = required(root, ".picker-trigger", HTMLButtonElement);
  const icon = required(root, ".picker-icon", HTMLImageElement);
  const ticker = required(root, ".picker-ticker", HTMLElement);
  const pop = required(root, ".picker-pop", HTMLElement);
  const input = required(root, "input", HTMLInputElement);
  const list = required(root, ".picker-list", HTMLUListElement);

  let symbol = "";
  let items: Coin[] = [];
  let active = -1;

  const show = (next: string): void => {
    symbol = next;
    ticker.textContent = next;
    const coin = COINS.find((c) => c.symbol === next);
    icon.hidden = coin === undefined;
    if (coin !== undefined) icon.src = coin.icon;
  };

  const render = (): void => {
    list.innerHTML = items.map((coin, index) => itemMarkup(coin, index === active)).join("");
    list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  };

  const filter = (): void => {
    items = matches(input.value);
    active = -1;
    render();
  };

  const open = (): void => {
    if (!pop.hidden) return;
    pop.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    input.value = "";
    filter();
    input.focus();
  };

  const close = (): void => {
    if (pop.hidden) return;
    pop.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    items = [];
    active = -1;
  };

  const pick = (raw: string): void => {
    const clean = raw.trim().toUpperCase();
    close();
    if (clean === "") return;
    show(clean);
    onPick(clean);
  };

  trigger.addEventListener("click", () => {
    if (pop.hidden) open();
    else close();
  });
  // A press on the trigger while open must not blur the input first: blur would close and the click reopen.
  trigger.addEventListener("mousedown", (event) => {
    if (!pop.hidden) event.preventDefault();
  });
  input.addEventListener("input", filter);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      active = (active + delta + items.length) % items.length;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(items[active]?.symbol ?? input.value);
    } else if (event.key === "Escape") {
      close();
      trigger.focus();
    }
  });
  // mousedown, not click: the input must keep focus, or blur would close the list before the click lands.
  list.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const item = event.target instanceof Element ? event.target.closest("[data-symbol]") : null;
    const picked = item?.getAttribute("data-symbol");
    if (typeof picked === "string") pick(picked);
  });

  show(initial);
  const dispose = onLangChange(() => {
    trigger.title = t().picker.choose;
    input.setAttribute("aria-label", t().picker.choose);
    input.placeholder = t().picker.placeholder;
  });

  return {
    value: () => symbol,
    setValue: show,
    dispose,
  };
}

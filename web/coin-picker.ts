/**
 * The instrument combobox: typing filters COINS by ticker or name, the list shows icon, ticker and name, arrows
 * and Enter pick, Escape closes, a click picks. A symbol that is not in the list still loads on Enter: the list
 * is a convenience, the exchange decides what exists. Markup is rendered into the given root.
 */
import { COINS, type Coin } from "./coin-list";
import { required } from "./dom-lookup";

export interface CoinPicker {
  value(): string;
  setValue(symbol: string): void;
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

export function createCoinPicker(root: HTMLElement, initial: string, onPick: (symbol: string) => void): CoinPicker {
  root.classList.add("picker");
  root.innerHTML = `<img class="picker-icon" alt="" hidden><input id="asset" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="picker-list" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="BTCUSDT"><ul class="picker-list" id="picker-list" role="listbox" hidden></ul>`;
  const icon = required(root, ".picker-icon", HTMLImageElement);
  const input = required(root, "input", HTMLInputElement);
  const list = required(root, ".picker-list", HTMLUListElement);

  let items: Coin[] = [];
  let active = -1;

  const showIcon = (symbol: string): void => {
    const coin = COINS.find((c) => c.symbol === symbol);
    icon.hidden = coin === undefined;
    if (coin !== undefined) icon.src = coin.icon;
    root.classList.toggle("with-icon", coin !== undefined);
  };

  const render = (): void => {
    list.innerHTML = items.map((coin, index) => itemMarkup(coin, index === active)).join("");
    list.hidden = items.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  };

  const open = (): void => {
    items = matches(input.value);
    active = -1;
    render();
  };

  const close = (): void => {
    items = [];
    active = -1;
    render();
  };

  const pick = (symbol: string): void => {
    const clean = symbol.trim().toUpperCase();
    input.value = clean;
    showIcon(clean);
    close();
    onPick(clean);
  };

  input.addEventListener("input", () => {
    showIcon(input.value.trim().toUpperCase());
    open();
  });
  input.addEventListener("focus", open);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) open();
      if (items.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      active = (active + delta + items.length) % items.length;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(items[active]?.symbol ?? input.value);
    } else if (event.key === "Escape") {
      close();
    }
  });
  // mousedown, not click: the input must keep focus, or blur would close the list before the click lands.
  list.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const item = event.target instanceof Element ? event.target.closest("[data-symbol]") : null;
    const symbol = item?.getAttribute("data-symbol");
    if (typeof symbol === "string") pick(symbol);
  });

  input.value = initial;
  showIcon(initial);

  return {
    value: () => input.value.trim().toUpperCase(),
    setValue(symbol) {
      input.value = symbol;
      showIcon(symbol);
    },
  };
}

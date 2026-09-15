/**
 * Everyone reading this reading, at the head of the day tabs: the author first, then every reader a second opinion
 * was bought from, each in the colour her line wears on the chart above, and where each of them takes the price by
 * the last open day. The row is the chart's legend, so a bought line is never a nameless stripe. Last comes the chip
 * that asks one more reader and names her price, gone once everyone is at the table or while no day is open.
 * Who may be asked, what she costs and why the author is candles and the rest are lines: ../docs/reading-lifecycle.md
 */
import type { Candle } from "../engine/atr";
import { isReaderId, READER_IDS, type ReaderId } from "../engine/readers";
import { icons } from "./icons";
import { onLangChange, t } from "./i18n/index";
import { formatPercent } from "./price-format";
import { readerAvatarUrl } from "./reader-choice";

/** What the row shows. `lines` holds every reader on the reading, the author first, with the candles she has drawn. */
export interface Roster {
  author: ReaderId;
  lines: ReadonlyMap<ReaderId, readonly Candle[]>;
  /** The close every move is measured from: the last real one, or null while the chart is empty. */
  base: number | null;
  /** Days open now: what the moves are measured to. */
  days: number;
  locked: boolean;
  /** What asking one more costs, or null when nobody may be asked here or now. */
  askCost: number | null;
}

export interface Lineup {
  show(roster: Roster): void;
  dispose(): void;
}

function move(base: number | null, candles: readonly Candle[] | undefined): number | null {
  const last = candles?.[candles.length - 1];
  if (base === null || base === 0 || last === undefined) return null;
  return (last.c / base - 1) * 100;
}

function moveMarkup(pct: number | null): string {
  if (pct === null) return "";
  return `<span class="reader-move ${pct >= 0 ? "up" : "down"}">${formatPercent(pct)}</span>`;
}

// The chip says who she is; the title says what of the chart is hers and where she takes the price by the last day.
function chipMarkup(roster: Roster, id: ReaderId, fresh: boolean, clickable: boolean): string {
  const author = id === roster.author;
  const pct = move(roster.base, roster.lines.get(id));
  const name = t().readerName(id);
  const where = pct === null ? "" : ` · ${t().reader.move(formatPercent(pct), roster.days)}`;
  const title = `${name} · ${author ? t().reader.candles : t().reader.line}${where}`;
  const locked = author && roster.locked;
  const classes = ["reader", author ? "" : "mate", locked ? "locked" : "", fresh ? "fresh" : ""]
    .filter(Boolean)
    .join(" ");
  const hue = author ? "" : ` style="--hue: var(--reader-${id})"`;
  const note = author ? `<span class="reader-note">${t().reader.current}</span>` : "";
  const tag = clickable ? "button" : "span";
  const act = clickable ? ` type="button" aria-haspopup="dialog" data-lineup-open="${id}"` : "";
  const text = `<span class="reader-text"><b>${name}</b>${note}</span>`;
  return `<${tag} class="${classes}"${hue}${act} title="${title}"><img src="${readerAvatarUrl(id)}" alt="">${text}${moveMarkup(pct)}${locked ? icons.lock : ""}</${tag}>`;
}

// Asking stands where the readers stand, priced: the card is where a reader is read about, not where she is found.
function askMarkup(roster: Roster): string {
  const cost = roster.askCost;
  const next = READER_IDS.find((id) => !roster.lines.has(id));
  if (cost === null || next === undefined) return "";
  const label = `${t().reader.askMore} · ${t().mana}: ${String(cost)}`;
  const price = `<span class="mana-glyph">${icons.mana}</span>${String(cost)}`;
  return `<button class="reader ask" type="button" data-lineup-ask="${next}" aria-label="${label}" title="${t().reader.askNote(cost)}">${t().reader.askMore}${price}</button>`;
}

/** `open` makes the chips clickable and leads to the reader's card; a row without it only names who is on the chart. */
export function createLineup(root: HTMLElement, open?: (id: ReaderId) => void): Lineup {
  let roster: Roster | null = null;
  // Who stood here at the last paint: whoever is new arrives lit, so a bought opinion is seen taking her seat.
  let seen = new Set<ReaderId>();

  const paint = (): void => {
    const shown = roster;
    if (shown === null) {
      root.replaceChildren();
      return;
    }
    const ids = [...shown.lines.keys()];
    const chips = ids.map((id) => chipMarkup(shown, id, seen.size > 0 && !seen.has(id), open !== undefined));
    root.innerHTML = chips.join("") + askMarkup(shown);
    seen = new Set(ids);
  };

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const chip = target?.closest<HTMLElement>("[data-lineup-open], [data-lineup-ask]") ?? null;
    const id = chip === null ? null : (chip.dataset.lineupOpen ?? chip.dataset.lineupAsk);
    if (isReaderId(id) && open !== undefined) open(id);
  });
  const unsubscribe = onLangChange(paint);

  return {
    show(next) {
      roster = next;
      paint();
    },
    dispose() {
      unsubscribe();
    },
  };
}

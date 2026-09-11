/** Italian interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import type { Dictionary } from "./index";
import { MEANINGS_IT } from "./meanings-it";
import { READERS_IT } from "./readers-it";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "Il Matto",
  "Il Mago",
  "La Papessa",
  "L'Imperatrice",
  "L'Imperatore",
  "Il Papa",
  "Gli Amanti",
  "Il Carro",
  "La Forza",
  "L'Eremita",
  "La Ruota della Fortuna",
  "La Giustizia",
  "L'Appeso",
  "La Morte",
  "La Temperanza",
  "Il Diavolo",
  "La Torre",
  "La Stella",
  "La Luna",
  "Il Sole",
  "Il Giudizio",
  "Il Mondo",
] as const;

const RANKS = [
  "Asso",
  "Due",
  "Tre",
  "Quattro",
  "Cinque",
  "Sei",
  "Sette",
  "Otto",
  "Nove",
  "Dieci",
  "Fante",
  "Cavaliere",
  "Regina",
  "Re",
] as const;

const SUITS = { wands: "di Bastoni", cups: "di Coppe", swords: "di Spade", pentacles: "di Denari" } as const;

if (MEANINGS_IT.length !== DECK.length)
  throw new Error(`Italian meanings cover ${String(MEANINGS_IT.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "verso l'alto" : "verso il basso");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "il crollo è annullato, il prezzo viene lanciato in alto e continua a salire"
        : "il mercato cade alla prima candela e cerca il fondo tutto il giorno";
    case "sun":
      return e.up
        ? "la luce inonda il grafico, il prezzo balza e tiene la quota"
        : "la luce si spegne, il prezzo sprofonda e scivola";
    case "wheel":
      return "la ruota gira la tendenza, il resto della giornata va contro il mattino";
    case "hanged":
      return "il mercato resta sospeso vicino alla media e non ha fretta";
    case "moon":
      return "nebbia, ombre lunghe il doppio, direzione difficile da leggere";
    case "death":
      return "la vecchia tendenza muore, ne nasce una nuova di segno opposto";
    case "fool":
      return "movimento senza bussola, escursione più ampia del solito";
    case "drift":
      return `una deriva regolare ${upDown(e.up)} senza strappi`;
    case "wands":
      return `i bastoni ${e.up ? "spingono il prezzo in alto" : "premono il prezzo in basso"}`;
    case "cups":
      return e.wide
        ? "le coppe allungano l'escursione delle candele"
        : "le coppe comprimono l'escursione delle candele";
    case "swords":
      return "le spade tagliano con ombre e false rotture";
    case "pentacles":
      return "i denari tirano il prezzo verso la media del giorno";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "un balzo in su" : "un crollo";
    case "sun":
      return e.up ? "un balzo" : "un calo";
    case "wheel":
      return "un'inversione";
    case "hanged":
      return "laterale";
    case "moon":
      return "una tempesta";
    case "death":
      return "un cambio di regime";
    case "fool":
      return "caos";
    case "drift":
      return `una deriva ${upDown(e.up)}`;
    case "wands":
      return `un impulso ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "candele lunghe" : "candele strette";
    case "swords":
      return "picchi";
    case "pentacles":
      return "un ritorno alla media";
  }
}

const CLOSING = {
  reversal: [
    "Chi è entrato al mattino, la sera litiga con le carte.",
    "La tendenza cambia segno a metà giornata; le carte avevano avvertito.",
  ],
  flat: [
    "La giornata chiude vicino allo zero: il mercato pensa, le carte pure.",
    "La giornata va in laterale; le carte non insistono.",
  ],
  up: [
    "Più in alto alla chiusura. Le carte non danno ragioni, solo la direzione.",
    "I tori ricevono la benedizione; le ombre restano lunghe.",
  ],
  down: [
    "Più in basso alla chiusura. Le carte non spiegano nulla, le carte mostrano.",
    "Gli orsi hanno il loro; le carte registrano, non compatiscono.",
  ],
} as const;

export const it: Dictionary = {
  code: "it",
  locale: "it-IT",
  title: "TarotAlpha — previsione di mercato con i tarocchi",
  tagline: "lettura sulle candele · ",
  theme: { label: "Tema", light: "Tema chiaro", dark: "Tema scuro", system: "Tema di sistema" },
  language: { label: "Lingua" },
  disclaimer: "non è un consiglio finanziario; le carte sono d'accordo",
  reversed: "rovesciata",
  day: (n: number): string => `giorno ${String(n)}`,
  now: "adesso",
  drawStep: (n: number): string => `Apri la lettura · giorno ${String(n)}`,
  mana: "Mana",
  close: "Chiudi",
  picker: { choose: "Scegli lo strumento", placeholder: "Ticker o nome" },
  badAsset: "Uno strumento è di 2–20 caratteri: lettere latine e cifre",
  loading: "Caricamento delle candele…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Riprova",
  exchange: {
    unknown_asset: "Questo strumento non esiste sull'exchange",
    unavailable: "L'exchange non risponde dalla tua rete",
    too_old: "L'exchange ha restituito uno storico incompleto",
  },
  share: {
    button: "Condividi",
    copy: "Copia il link",
    snapshotFailed: "Impossibile scattare lo snapshot, riprova",
    tooMany: "Troppe richieste",
    failed: "Impossibile creare il link, riprova più tardi",
    copied: "Copiato",
    selectToCopy: "Selezionato — premi Ctrl+C",
    title: "Link alla lettura",
    lead: "Si apre con le stesse candele e le stesse carte. Quando il futuro sarà arrivato, il link mostrerà la verifica della profezia.",
  },
  paywall: {
    meditating: "Il modulo di pagamento sta ancora meditando",
    title: "Mana esaurito",
    lead: "Ogni giorno della lettura costa mana, e più è lontano, più costa: il futuro si vede peggio. Il mana torna un po' ogni ora e si ricarica del tutto con un nuovo giorno.",
    buy: "Acquista",
    back: "Torna alla lettura",
  },
  fan: { hint: "Pesca tre carte", close: "chiudi" },
  reader: {
    unscored: "Ancora senza voto",
    rated: (stars: number, of: number): string => `voto ${String(stars)} su ${String(of)}`,
    wins: (pct: number): string => `Fra i cinque, arriva più vicino nel ${String(pct)} % delle letture`,
    others: "Tutti al tavolo",
    current: "Sta leggendo le tue candele",
    choose: (name: string): string => `Fai leggere ${name}`,
  },
  reading: {
    notFound: "Lettura non trovata",
    loadFailed: "Impossibile caricare la lettura",
    ownReading: "La tua lettura",
    loading: "Caricamento della lettura…",
    meta: (createdAt: string): string => `creata il ${createdAt}`,
    replaying: "Pesca tre carte per ogni giorno",
    replay: "Ripeti la lettura",
    own: "La tua lettura per questo strumento",
  },
  mine: {
    button: "Le mie letture",
    ripe: "pronta",
    ripensIn: (hours: number): string => `pronta tra ${String(hours)} h`,
  },
  prophecy: {
    checking: "Verifica della profezia sulle candele dell'exchange…",
    notYet: (closesAt: string): string =>
      `Il futuro non è ancora arrivato: la prima candela da verificare chiude alle ${closesAt}`,
    checkFailed: "L'exchange non risponde, la verifica della profezia è rinviata",
    noCandles: "La borsa non ha restituito candele per quel periodo",
    hit: (pct: number): string => `La profezia si è avverata al ${String(pct)} %`,
    miss: (pct: number): string => `Il mercato ha respinto la profezia: ${String(pct)} %`,
    final: "finale",
    interim: "provvisorio",
    praise: {
      close: (name: string): string => `${name}: in pieno sul mercato`,
      near: (name: string): string => `${name}: vicino al mercato`,
      far: (name: string): string => `${name}: lontano dal mercato`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `giorno ${String(day)}: non ancora` : `giorno ${String(day)}: ${String(pct)} %`,
  },
  summaryTitle: "La giornata in una riga.",
  how: "Come viene calcolato",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_IT[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_IT[id].name,
  readerBlurb: (id: ReaderId): string => READERS_IT[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " in posizione rovesciata" : "";
    const when = ["ore 0–8", "ore 8–16", "ore 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} governa la giornata dalle ${when}: ${ruling(f.rulingEffect)}.`
      : `Nessun arcano maggiore oggi, la giornata è dei minori; ${f.rulingName}${rev} dà il tono nelle ${when}: ${ruling(f.rulingEffect)}.`;
    const path = `Al mattino — ${short(f.effects[0])}, a mezzogiorno — ${short(f.effects[1])}, la sera — ${short(f.effects[2])}.`;
    const number = `Alla chiusura della giornata le carte vedono ${f.netPct} %, con ${f.highPct} % sopra e ${f.lowPct} % sotto lungo la strada.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

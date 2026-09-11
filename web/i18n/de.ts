/** German interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import type { Dictionary } from "./index";
import { MEANINGS_DE } from "./meanings-de";
import { READERS_DE } from "./readers-de";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "Der Narr",
  "Der Magier",
  "Die Hohepriesterin",
  "Die Herrscherin",
  "Der Herrscher",
  "Der Hierophant",
  "Die Liebenden",
  "Der Wagen",
  "Die Kraft",
  "Der Eremit",
  "Das Rad des Schicksals",
  "Die Gerechtigkeit",
  "Der Gehängte",
  "Der Tod",
  "Die Mäßigkeit",
  "Der Teufel",
  "Der Turm",
  "Der Stern",
  "Der Mond",
  "Die Sonne",
  "Das Gericht",
  "Die Welt",
] as const;

const RANKS = [
  "Ass",
  "Zwei",
  "Drei",
  "Vier",
  "Fünf",
  "Sechs",
  "Sieben",
  "Acht",
  "Neun",
  "Zehn",
  "Bube",
  "Ritter",
  "Königin",
  "König",
] as const;

const SUITS = { wands: "der Stäbe", cups: "der Kelche", swords: "der Schwerter", pentacles: "der Münzen" } as const;

if (MEANINGS_DE.length !== DECK.length)
  throw new Error(`German meanings cover ${String(MEANINGS_DE.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "nach oben" : "nach unten");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "der Absturz ist abgesagt, der Preis wird hochgeworfen und weiter nach oben gezogen"
        : "der Markt fällt schon in der ersten Kerze und sucht den ganzen Tag den Boden";
    case "sun":
      return e.up
        ? "Licht flutet den Chart, der Preis springt und hält die Höhe"
        : "das Licht geht aus, der Preis fällt und rutscht ab";
    case "wheel":
      return "das Rad dreht den Trend, der Rest des Tages läuft gegen den Morgen";
    case "hanged":
      return "der Markt hängt am Durchschnitt und hat es nicht eilig";
    case "moon":
      return "Nebel, Dochte doppelt so lang, die Richtung schwer zu lesen";
    case "death":
      return "der alte Trend stirbt, ein neuer wird mit umgekehrtem Vorzeichen geboren";
    case "fool":
      return "Bewegung ohne Orientierung, breitere Spanne als üblich";
    case "drift":
      return `eine gleichmäßige Drift ${upDown(e.up)} ohne scharfe Bewegungen`;
    case "wands":
      return `die Stäbe ${e.up ? "treiben den Preis nach oben" : "drücken den Preis nach unten"}`;
    case "cups":
      return e.wide ? "die Kelche dehnen die Spanne der Kerzen" : "die Kelche stauchen die Spanne der Kerzen";
    case "swords":
      return "die Schwerter schneiden mit Dochten und Fehlausbrüchen";
    case "pentacles":
      return "die Münzen ziehen den Preis zum Tagesdurchschnitt";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "ein Sprung nach oben" : "ein Absturz";
    case "sun":
      return e.up ? "ein Sprung" : "ein Fall";
    case "wheel":
      return "eine Wende";
    case "hanged":
      return "seitwärts";
    case "moon":
      return "ein Sturm";
    case "death":
      return "ein Regimewechsel";
    case "fool":
      return "Chaos";
    case "drift":
      return `eine Drift ${upDown(e.up)}`;
    case "wands":
      return `ein Impuls ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "lange Kerzen" : "schmale Kerzen";
    case "swords":
      return "Spitzen";
    case "pentacles":
      return "eine Rückkehr zum Durchschnitt";
  }
}

const CLOSING = {
  reversal: [
    "Wer am Morgen eingestiegen ist, streitet am Abend mit den Karten.",
    "Der Trend wechselt mittags das Vorzeichen; die Karten hatten gewarnt.",
  ],
  flat: [
    "Der Tag endet nahe null: der Markt denkt nach, die Karten auch.",
    "Der Tag läuft seitwärts; die Karten bestehen nicht darauf.",
  ],
  up: [
    "Höher zum Schluss. Die Karten nennen keine Gründe, nur die Richtung.",
    "Die Bullen bekommen ihren Segen; die Dochte bleiben lang.",
  ],
  down: [
    "Tiefer zum Schluss. Die Karten erklären nichts, die Karten zeigen.",
    "Die Bären bekommen ihr Teil; die Karten protokollieren, sie bemitleiden nicht.",
  ],
} as const;

export const de: Dictionary = {
  code: "de",
  locale: "de-DE",
  title: "TarotAlpha — Marktprognose aus dem Tarot",
  tagline: "Legung nach Kerzen",
  theme: { label: "Design", light: "Helles Design", dark: "Dunkles Design", system: "Systemdesign" },
  language: { label: "Sprache" },
  disclaimer: "keine Finanzberatung; die Karten sehen das genauso",
  reversed: "umgekehrt",
  day: (n: number): string => `Tag ${String(n)}`,
  now: "jetzt",
  drawStep: (n: number): string => `Legung öffnen · Tag ${String(n)}`,
  mana: "Mana",
  close: "Schließen",
  picker: { choose: "Instrument wählen", placeholder: "Ticker oder Name" },
  badAsset: "Ein Instrument hat 2–20 Zeichen: lateinische Buchstaben und Ziffern",
  loading: "Kerzen werden geladen…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Erneut versuchen",
  exchange: {
    unknown_asset: "Dieses Instrument gibt es an der Börse nicht",
    unavailable: "Die Börse antwortet aus deinem Netz nicht",
    too_old: "Die Börse hat eine unvollständige Historie geliefert",
  },
  share: {
    button: "Teilen",
    copy: "Link kopieren",
    snapshotFailed: "Snapshot fehlgeschlagen, bitte erneut versuchen",
    tooMany: "Zu viele Anfragen",
    failed: "Link konnte nicht erstellt werden, später erneut versuchen",
    copied: "Kopiert",
    selectToCopy: "Markiert — Strg+C drücken",
    title: "Link zur Legung",
    lead: "Öffnet sich mit denselben Kerzen und Karten. Wenn die Zukunft eingetreten ist, zeigt der Link die Prüfung der Prophezeiung.",
  },
  paywall: {
    meditating: "Das Zahlungsmodul meditiert noch",
    title: "Das Mana ist aufgebraucht",
    lead: "Jeder Tag der Legung kostet Mana, und je weiter voraus, desto mehr: Die Zukunft ist schwerer zu sehen. Mana kehrt jede Stunde ein wenig zurück und füllt sich mit einem neuen Tag ganz auf.",
    buy: "Kaufen",
    back: "Zurück zur Legung",
  },
  fan: { hint: "Zieh drei Karten", close: "schließen" },
  cloth: "Öffne eine Tarot-Legung — erfahre das Schicksal der Kerzen",
  reader: {
    unscored: "Noch ohne Bewertung",
    rated: (stars: number, of: number): string => `mit ${String(stars)} von ${String(of)} bewertet`,
    wins: (pct: number): string => `Von den fünf am nächsten dran in ${String(pct)} % der Legungen`,
    others: "Alle am Tisch",
    current: "Legt dir die Karten",
    locked: (name: string): string => `${name} führt diese Legung bis zum letzten Tag`,
    choose: (name: string): string => `${name} soll lesen`,
  },
  reading: {
    notFound: "Legung nicht gefunden",
    loadFailed: "Legung konnte nicht geladen werden",
    ownReading: "Eigene Legung",
    loading: "Legung wird geladen…",
    meta: (createdAt: string): string => `erstellt am ${createdAt}`,
    replaying: "Zieh für jeden Tag drei Karten",
    replay: "Legung wiederholen",
    own: "Eigene Legung für dieses Instrument",
  },
  mine: {
    button: "Meine Legungen",
    ripe: "reif",
    ripensIn: (hours: number): string => `reif in ${String(hours)} h`,
  },
  prophecy: {
    checking: "Prophezeiung wird an den Kerzen der Börse geprüft…",
    notYet: (closesAt: string): string =>
      `Die Zukunft ist noch nicht eingetreten: die erste zu prüfende Kerze schließt um ${closesAt}`,
    checkFailed: "Die Börse antwortet nicht, die Prüfung der Prophezeiung ist verschoben",
    noCandles: "Die Börse lieferte für diesen Zeitraum keine Kerzen",
    hit: (pct: number): string => `Die Prophezeiung hat sich zu ${String(pct)} % erfüllt`,
    miss: (pct: number): string => `Der Markt hat die Prophezeiung verworfen: ${String(pct)} %`,
    final: "endgültig",
    interim: "vorläufig",
    praise: {
      close: (name: string): string => `${name}: genau am Markt`,
      near: (name: string): string => `${name}: nah am Markt`,
      far: (name: string): string => `${name}: weit am Markt vorbei`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `Tag ${String(day)}: noch nicht` : `Tag ${String(day)}: ${String(pct)} %`,
  },
  summaryTitle: "Der Tag in einer Zeile.",
  how: "Wie es berechnet wird",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_DE[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_DE[id].name,
  readerBlurb: (id: ReaderId): string => READERS_DE[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " in umgekehrter Lage" : "";
    const when = ["Stunden 0–8", "Stunden 8–16", "Stunden 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} regiert den Tag ab den ${when}: ${ruling(f.rulingEffect)}.`
      : `Keine Große Arkana heute, der Tag gehört den Kleinen; ${f.rulingName}${rev} gibt in den ${when} den Ton an: ${ruling(f.rulingEffect)}.`;
    const path = `Morgens — ${short(f.effects[0])}, mittags — ${short(f.effects[1])}, abends — ${short(f.effects[2])}.`;
    const number = `Zum Tagesschluss sehen die Karten ${f.netPct} %, unterwegs ${f.highPct} % nach oben und ${f.lowPct} % nach unten.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

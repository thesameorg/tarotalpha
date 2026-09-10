/** English interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_EN } from "./meanings-en";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
] as const;

const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
] as const;

const SUITS = { wands: "of Wands", cups: "of Cups", swords: "of Swords", pentacles: "of Pentacles" } as const;

if (MEANINGS_EN.length !== DECK.length)
  throw new Error(`English meanings cover ${String(MEANINGS_EN.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "up" : "down");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "the crash is called off, the price is tossed up and pulled higher"
        : "the market drops in the very first candle and hunts for a bottom all day";
    case "sun":
      return e.up
        ? "light floods the chart, the price leaps and holds the height"
        : "the light goes out, the price drops and slides";
    case "wheel":
      return "the wheel turns the trend, the rest of the day runs against the morning";
    case "hanged":
      return "the market hangs by the average and is in no hurry";
    case "moon":
      return "fog, wicks twice as long, the direction hard to read";
    case "death":
      return "the old trend dies, a new one is born with the opposite sign";
    case "fool":
      return "movement without bearings, a wider range than usual";
    case "drift":
      return `an even drift ${upDown(e.up)} without sharp moves`;
    case "wands":
      return `the wands ${e.up ? "push the price up" : "press the price down"}`;
    case "cups":
      return e.wide ? "the cups stretch the candles' range" : "the cups squeeze the candles' range";
    case "swords":
      return "the swords cut with wicks and false breakouts";
    case "pentacles":
      return "the pentacles pull the price toward the day's average";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "a jump up" : "a crash";
    case "sun":
      return e.up ? "a leap" : "a drop";
    case "wheel":
      return "a reversal";
    case "hanged":
      return "flat";
    case "moon":
      return "a storm";
    case "death":
      return "a regime change";
    case "fool":
      return "chaos";
    case "drift":
      return `a drift ${upDown(e.up)}`;
    case "wands":
      return `an impulse ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "long candles" : "narrow candles";
    case "swords":
      return "spikes";
    case "pentacles":
      return "a pull to the average";
  }
}

const CLOSING = {
  reversal: [
    "Whoever entered in the morning argues with the cards by evening.",
    "The trend flips sign mid-day; the cards did warn.",
  ],
  flat: [
    "The day ends near zero: the market is thinking, so are the cards.",
    "The day drifts sideways; the cards do not insist.",
  ],
  up: [
    "Higher by the close. The cards name no reasons, only the direction.",
    "The bulls receive their blessing; the wicks stay long.",
  ],
  down: [
    "Lower by the close. The cards explain nothing, the cards show.",
    "The bears get their due; the cards record, they do not sympathise.",
  ],
} as const;

export const en: Dictionary = {
  code: "en",
  locale: "en-US",
  title: "TarotAlpha — market forecast by tarot reading",
  tagline: "reading by candles · ",
  theme: { label: "Theme", light: "Light theme", dark: "Dark theme", system: "System theme" },
  language: { label: "Language" },
  disclaimer: "not financial advice; the cards agree",
  reversed: "reversed",
  day: (n: number): string => `day ${String(n)}`,
  now: "now",
  drawStep: (n: number): string => `Open the reading · day ${String(n)}`,
  lockedStep: "two days free, the third behind the paywall",
  close: "Close",
  picker: { choose: "Choose an instrument", placeholder: "Ticker or name" },
  badAsset: "An instrument is 2–20 characters: Latin letters and digits",
  loading: "Loading candles…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Retry",
  exchange: {
    unknown_asset: "No such instrument on the exchange",
    unavailable: "The exchange does not answer from your network",
    too_old: "The exchange returned an incomplete history",
  },
  share: {
    button: "Share",
    copy: "Copy the link",
    snapshotFailed: "Could not take the snapshot, try again",
    tooMany: "Too many requests",
    failed: "Could not create the link, try again later",
    copied: "Copied",
    selectToCopy: "Selected — press Ctrl+C",
    title: "Link to the reading",
    lead: "Opens with the same candles and cards. Once the future has happened, the link shows the prophecy check.",
  },
  paywall: {
    meditating: "The payment module is still meditating",
    title: "The cards say no more",
    lead: "Free access covers two days ahead. The third day and the longer horizon open with the initiate status.",
    back: "Back to the reading",
    tiers: [
      {
        name: "Initiate",
        price: "$4.99",
        period: "/mo",
        features: ["up to 7 days ahead", "reading history", "no ads (there are none anyway)"],
        cta: "Choose",
      },
      {
        name: "Major Arcana",
        price: "$19.99",
        period: "/mo",
        features: [
          "everything in Initiate",
          "premium decks",
          "a second opinion from another deck",
          "fireworks on reveal",
        ],
        cta: "Choose",
      },
      {
        name: "Institutional",
        price: "$999",
        period: "/mo",
        features: ["API access", "PDF report with a seal", "personal manager"],
        cta: "Request",
      },
    ],
  },
  fan: { hint: "Pull three cards", close: "close" },
  reading: {
    notFound: "Reading not found",
    loadFailed: "Could not load the reading",
    ownReading: "Your own reading",
    loading: "Loading the reading…",
    meta: (createdAt: string): string => `created ${createdAt}`,
    replaying: "Pull three cards for each day",
    replay: "Replay the reading",
    own: "Your own reading for this instrument",
  },
  prophecy: {
    checking: "Checking the prophecy against the exchange's candles…",
    notYet: (closesAt: string): string =>
      `The future has not happened yet: the first candle to check closes at ${closesAt}`,
    checkFailed: "The exchange does not answer, the prophecy check is postponed",
    noCandles: "The exchange returned no candles for that stretch",
    hit: (pct: number): string => `The prophecy came true at ${String(pct)} %`,
    miss: (pct: number): string => `The market rejected the prophecy: ${String(pct)} %`,
    compared: (n: number, total: number): string => `on ${String(n)} of ${String(total)} candles`,
    final: "final",
    interim: "interim",
    deviation: (value: string): string => `off by ${value} ATR`,
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `day ${String(day)}: not yet`
        : `day ${String(day)}: ${String(pct)} % (${String(hits)}/${String(compared)})`,
  },
  summaryTitle: "The day in one line.",
  how: "How it's computed",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_EN[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " reversed" : "";
    const when = ["hours 0–8", "hours 8–16", "hours 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} rules the day from ${when}: ${ruling(f.rulingEffect)}.`
      : `No major arcana today, the minors have the day; the ${f.rulingName}${rev} sets the tone in ${when}: ${ruling(f.rulingEffect)}.`;
    const path = `Morning — ${short(f.effects[0])}, midday — ${short(f.effects[1])}, evening — ${short(f.effects[2])}.`;
    const number = `By the close of the day the cards see ${f.netPct} %, with ${f.highPct} % above and ${f.lowPct} % below along the way.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

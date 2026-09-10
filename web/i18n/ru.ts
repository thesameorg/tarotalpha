/**
 * Russian interface text. Content, not code: the language rule does not apply here. This dictionary is the shape
 * every other language follows (`Dictionary` in index.ts); a function receives the engine's numbers and writes
 * the sentence, so the words are free while the numbers stay the engine's.
 */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import { MEANINGS_RU } from "./meanings-ru";
import { READERS_RU } from "./readers-ru";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "Шут",
  "Маг",
  "Верховная Жрица",
  "Императрица",
  "Император",
  "Иерофант",
  "Влюблённые",
  "Колесница",
  "Сила",
  "Отшельник",
  "Колесо Фортуны",
  "Справедливость",
  "Повешенный",
  "Смерть",
  "Умеренность",
  "Дьявол",
  "Башня",
  "Звезда",
  "Луна",
  "Солнце",
  "Суд",
  "Мир",
] as const;

const RANKS = [
  "Туз",
  "Двойка",
  "Тройка",
  "Четвёрка",
  "Пятёрка",
  "Шестёрка",
  "Семёрка",
  "Восьмёрка",
  "Девятка",
  "Десятка",
  "Паж",
  "Рыцарь",
  "Королева",
  "Король",
] as const;

const SUITS = { wands: "Жезлов", cups: "Кубков", swords: "Мечей", pentacles: "Пентаклей" } as const;

if (MEANINGS_RU.length !== DECK.length)
  throw new Error(`Russian meanings cover ${String(MEANINGS_RU.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "вверх" : "вниз");

// The ruling card's line in the summary, by the branch the formula took.
function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "обвал отменён, цену подбрасывает и дальше тянет вверх"
        : "рынок падает первой же свечой и весь день ищет дно";
    case "sun":
      return e.up ? "свет заливает график, цена прыгает и держит высоту" : "свет гаснет, цена проваливается и сползает";
    case "wheel":
      return "колесо поворачивает тренд, дальше всё идёт против утреннего хода";
    case "hanged":
      return "рынок висит у среднего и никуда не торопится";
    case "moon":
      return "туман, тени вдвое длиннее, направление читается с трудом";
    case "death":
      return "старый тренд умирает, новый рождается с обратным знаком";
    case "fool":
      return "движение без ориентира, размах шире обычного";
    case "drift":
      return `ровный дрейф ${upDown(e.up)} без резких движений`;
    case "wands":
      return `жезлы ${e.up ? "гонят цену вверх" : "давят цену вниз"}`;
    case "cups":
      return e.wide ? "кубки растягивают диапазон свечей" : "кубки сжимают диапазон свечей";
    case "swords":
      return "мечи режут тенями и ложными пробоями";
    case "pentacles":
      return "пентакли тянут цену к среднему за сутки";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "рывок вверх" : "обвал";
    case "sun":
      return e.up ? "взлёт" : "провал";
    case "wheel":
      return "разворот";
    case "hanged":
      return "флэт";
    case "moon":
      return "шторм";
    case "death":
      return "смена режима";
    case "fool":
      return "хаос";
    case "drift":
      return `дрейф ${upDown(e.up)}`;
    case "wands":
      return `импульс ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "длинные свечи" : "узкие свечи";
    case "swords":
      return "шипы";
    case "pentacles":
      return "возврат к среднему";
  }
}

const CLOSING = {
  reversal: ["Кто вошёл утром, к вечеру спорит с картами.", "Тренд меняет знак посреди дня; карты предупреждали."],
  flat: ["Итог около нуля: рынок думает, карты тоже.", "Сутки уходят в боковик; карты не настаивают."],
  up: [
    "Итог — выше. Карты не называют причин, только направление.",
    "Быки получают благословение; тени остаются длинными.",
  ],
  down: [
    "Итог — ниже. Карты ничего не объясняют, карты показывают.",
    "Медведи получают своё; карты фиксируют, не сочувствуют.",
  ],
} as const;

export const ru = {
  code: "ru",
  locale: "ru",
  title: "TarotAlpha — прогноз рынка по раскладу",
  tagline: "расклад по свечам · ",
  theme: { label: "Тема", light: "Светлая тема", dark: "Тёмная тема", system: "Тема как в системе" },
  language: { label: "Язык" },
  disclaimer: "не является финансовой рекомендацией; карты тоже так считают",
  reversed: "перевёрнутая",
  day: (n: number): string => `день ${String(n)}`,
  now: "сейчас",
  drawStep: (n: number): string => `Открыть расклад · день ${String(n)}`,
  lockedStep: "два дня бесплатно, третий — за пейволом",
  close: "Закрыть",
  picker: { choose: "Выбрать инструмент", placeholder: "Тикер или название" },
  badAsset: "Инструмент — 2–20 символов: латиница и цифры",
  loading: "Загружаем свечи…",
  per24h: "/ 24ч",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Повторить",
  exchange: {
    unknown_asset: "Такого инструмента нет на бирже",
    unavailable: "Биржа не отвечает из вашей сети",
    too_old: "Биржа отдала неполную историю",
  },
  share: {
    button: "Поделиться",
    copy: "Скопировать ссылку",
    snapshotFailed: "Не удалось снять снапшот, повторите",
    tooMany: "Слишком много запросов",
    failed: "Не удалось создать ссылку, попробуйте позже",
    copied: "Скопировано",
    selectToCopy: "Выделено — нажмите Ctrl+C",
    title: "Ссылка на расклад",
    lead: "Откроется с теми же свечами и картами. Когда будущее наступит, ссылка покажет проверку пророчества.",
  },
  paywall: {
    meditating: "Платёжный модуль ещё медитирует",
    title: "Карты дальше молчат",
    lead: "Бесплатный доступ покрывает два дня вперёд. Третий день и более дальний горизонт открывает статус посвящённого.",
    back: "Вернуться к раскладу",
    tiers: [
      {
        name: "Посвящённый",
        price: "$4.99",
        period: "/мес",
        features: ["до 7 дней вперёд", "история раскладов", "без рекламы (её и так нет)"],
        cta: "Выбрать",
      },
      {
        name: "Старший аркан",
        price: "$19.99",
        period: "/мес",
        features: ["всё из «Посвящённого»", "премиум-колоды", "второе мнение другой колодой", "фейерверк при открытии"],
        cta: "Выбрать",
      },
      {
        name: "Институциональный",
        price: "$999",
        period: "/мес",
        features: ["API-доступ", "PDF-отчёт с печатью", "персональный менеджер"],
        cta: "Запросить",
      },
    ],
  },
  fan: { hint: "Вытяните три карты", close: "закрыть" },
  reader: {
    unscored: "Пока без оценки",
    rated: (stars: number, of: number): string => `оценка ${String(stars)} из ${String(of)}`,
    wins: (pct: number): string => `Ближе всех из пяти в ${String(pct)} % раскладов`,
    others: "Все за столом",
    current: "Считает ваши свечи",
    choose: (name: string): string => `Пусть гадает ${name}`,
  },
  reading: {
    notFound: "Расклад не найден",
    loadFailed: "Не удалось загрузить расклад",
    ownReading: "Свой расклад",
    loading: "Загружаем расклад…",
    meta: (createdAt: string): string => `создан ${createdAt}`,
    replaying: "Вытяните три карты за каждый день",
    replay: "Воспроизвести расклад",
    own: "Свой расклад по этому инструменту",
  },
  prophecy: {
    checking: "Проверяем пророчество по свечам биржи…",
    notYet: (closesAt: string): string => `Будущее ещё не наступило: первая свеча проверки закроется в ${closesAt}`,
    checkFailed: "Биржа не отвечает, проверка пророчества отложена",
    noCandles: "Биржа не отдала свечей за это время",
    hit: (pct: number): string => `Пророчество сбылось на ${String(pct)} %`,
    miss: (pct: number): string => `Рынок отверг пророчество: ${String(pct)} %`,
    final: "итог",
    interim: "промежуточно",
    praise: {
      close: (name: string): string => `${name}: почти по рынку`,
      near: (name: string): string => `${name}: рядом с рынком`,
      far: (name: string): string => `${name}: мимо рынка`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `день ${String(day)}: ещё не наступил` : `день ${String(day)}: ${String(pct)} %`,
  },
  summaryTitle: "Итог дня.",
  how: "Как это считается",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_RU[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_RU[id].name,
  readerBlurb: (id: ReaderId): string => READERS_RU[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " в перевёрнутом положении" : "";
    const when = ["часы 0–8", "часы 8–16", "часы 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `Днём правит ${f.rulingName}${rev}, ${when}: ${ruling(f.rulingEffect)}.`
      : `Старших арканов нет, день за младшими; тон задаёт ${f.rulingName}${rev}, ${when}: ${ruling(f.rulingEffect)}.`;
    const path = `Утром — ${short(f.effects[0])}, днём — ${short(f.effects[1])}, вечером — ${short(f.effects[2])}.`;
    const number = `К закрытию суток карты видят ${f.netPct} %, по дороге ${f.highPct} % сверху и ${f.lowPct} % снизу.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

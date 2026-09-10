/** Russian UI strings the code needs at runtime. Content, not code: the language rule does not apply here. */
export const copy = {
  disclaimer: "не является финансовой рекомендацией; карты тоже так считают",
  positions: ["часы 0–8", "часы 8–16", "часы 16–24"] as const,
  reversed: "перевёрнутая",
  day: (n: number): string => `день ${String(n)}`,
  now: "сейчас",
  drawStep: (n: number): string => `Открыть расклад · день ${String(n)}`,
  enterAsset: "Введите инструмент и загрузите график",
  badAsset: "Инструмент — 2–20 символов: латиница и цифры",
  loading: "Загружаем свечи…",
  atrNote: (atr: string): string => `ATR(14) = ${atr} · горизонт шага 24 свечи`,
  source: (name: string): string => `источник: ${name}`,
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Повторить",
  exchange: {
    unknown_asset: "Такого инструмента нет на бирже",
    unavailable: "Биржа не отвечает из вашей сети",
    too_old: "Биржа отдала неполную историю",
  } as const,
  asked: (n: number): string => `Сегодня спросили о рынке ${n.toLocaleString("ru")} раз`,
  share: {
    snapshotFailed: "Не удалось снять снапшот, повторите",
    tooMany: "Слишком много запросов",
    failed: "Не удалось создать ссылку, попробуйте позже",
    copied: "Скопировано",
    selectToCopy: "Выделено — нажмите Ctrl+C",
    telegramText: (asset: string, steps: number): string => `${asset} — расклад на ${String(steps)} дн.`,
  },
  paywall: { meditating: "Платёжный модуль ещё медитирует" },
  reading: {
    notFound: "Расклад не найден",
    loadFailed: "Не удалось загрузить расклад",
    ownReading: "Свой расклад",
    unknownEngine: (version: string): string => `Расклад создан движком ${version}, которого здесь нет`,
    loading: "Загружаем расклад…",
    meta: (id: string, createdAt: string, views: number, engine: string): string =>
      `расклад ${id} · создан ${createdAt} · просмотров ${String(views)} · движок ${engine}`,
    replaying: "Воспроизводим…",
  },
  prophecy: {
    checking: "Проверяем пророчество по свечам биржи…",
    notYet: (closesAt: string): string => `Будущее ещё не наступило: первая свеча проверки закроется в ${closesAt} UTC`,
    checkFailed: "Биржа не отвечает, проверка пророчества отложена",
    hit: (pct: number): string => `Пророчество сбылось на ${String(pct)} %`,
    miss: (pct: number): string => `Рынок отверг пророчество: ${String(pct)} %`,
    compared: (n: number, total: number): string => `по ${String(n)} из ${String(total)} свечей`,
    final: "итог",
    interim: "промежуточно",
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `день ${String(day)}: ещё не наступил`
        : `день ${String(day)}: ${String(pct)} % (${String(hits)}/${String(compared)})`,
  },
} as const;

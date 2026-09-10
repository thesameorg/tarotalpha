/**
 * The sentence the prototype shows under a card, verbatim from its `readingText`. It lives in the engine because it
 * names the formula's numbers (gap in ATR, pull strength) and must change together with them. Russian is content.
 */
import type { Card } from "./deck";

export function interpret(card: Card, reversed: boolean): string {
  if (card.arcana === "major") {
    const i = card.index;
    if (i === 16) {
      return reversed
        ? "Обвал отменяется, но не сразу — гэп вверх и нервный откат"
        : "Гэп вниз на 3 ATR, далее стабильное сползание";
    }
    if (i === 19) {
      return reversed
        ? "Свет гаснет: разрыв вниз, слабая попытка вернуться"
        : "Гэп вверх на 2 ATR и уверенный ход выше";
    }
    if (i === 10) return "Разворот текущего тренда с этого часа";
    if (i === 12) return "Флэт. Рынок думает.";
    if (i === 18) return "Волатильность удвоена, направление неясно";
    if (i === 13) return "Смена режима: тренд меняет знак";
    if (i === 0) return "Хаотичное движение без ориентира";
    const up = i > 10.5 !== reversed;
    return `Умеренный дрейф ${up ? "вверх" : "вниз"}, волатильность средняя`;
  }
  const m = card.rank / 14;
  switch (card.suit) {
    case "wands":
      return `Импульс ${reversed ? "вниз" : "вверх"} ~${(m * 0.5 * 8).toFixed(1)} ATR за отрезок`;
    case "cups":
      return reversed ? "Сжатие волатильности, узкие свечи" : "Расширение диапазона, длинные свечи";
    case "swords":
      return "Шипы и ложные пробои, тени длинные";
    case "pentacles":
      return `Возврат к MA(24) с силой ${String(Math.round(m * 30))} %`;
  }
}

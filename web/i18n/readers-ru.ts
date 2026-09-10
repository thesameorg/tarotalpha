/**
 * The five readers in Russian: how each is called and the paragraph in her profile card. The name is adapted to
 * the language, not transliterated — the reading stores the id from engine/readers.ts, the name is only how she
 * is introduced. Content, not code. The blurbs are still placeholder copy: nobody has written these yet.
 */
import type { ReaderId } from "../../engine/readers";

export interface ReaderText {
  name: string;
  blurb: string;
}

export const READERS_RU: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Мадам Вера",
    blurb:
      "Читает рынок без затей: какой у дня обычный размах, внутри такого карты и водят цену. Никаких теорий и никаких обещаний — самая старая рука за столом.",
  },
  reversion: {
    name: "Сестра Анемона",
    blurb:
      "Верит, что всё возвращается. Её цену тянет туда, где она сидела в последнее время, а карта решает только, насколько крепка верёвка и как далеко позволено отойти.",
  },
  analogy: {
    name: "Старик Кофи",
    blurb:
      "Эту неделю он уже видел. Находит в прошедшей неделе кусок, больше всего похожий на последние часы, и даёт ему повториться — повернув туда, куда скажут карты.",
  },
  garch: {
    name: "Мама Ифе",
    blurb:
      "Говорит, что беда ходит с компанией. Один буйный час под её руками делает буйными и следующие, а тихий отрезок остаётся тихим, пока его что-нибудь не сломает.",
  },
  fractal: {
    name: "Ткачиха",
    blurb:
      "Работает одной нитью и одним числом. Выше середины движения соглашаются друг с другом и цена уходит далеко; ниже — спорят, и сутки выходят мелкой пилой.",
  },
};

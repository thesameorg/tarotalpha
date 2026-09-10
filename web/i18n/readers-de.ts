/** The five readers in German, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_DE: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Frau Wera",
    blurb:
      "Liest den Markt ohne Umschweife: Wie groß der übliche Ausschlag des Tages ist, in dem Rahmen schieben die Karten den Preis herum. Keine Theorien, keine Versprechen, die älteste Hand am Tisch.",
  },
  reversion: {
    name: "Schwester Anemone",
    blurb:
      "Glaubt, dass alles zurückkommt. Ihren Preis zieht es dorthin, wo er zuletzt gesessen hat, und eine Karte entscheidet nur, wie fest das Seil zieht und wie weit er sich entfernen darf.",
  },
  analogy: {
    name: "Alter Kofi",
    blurb:
      "Diese Woche hat er schon gesehen. Er findet in der vergangenen Woche das Stück, das den letzten Stunden am ähnlichsten sieht, und lässt es noch einmal ablaufen, gedreht, wie die Karten es sagen.",
  },
  garch: {
    name: "Mama Ife",
    blurb:
      "Sagt, das Unglück kommt in Gesellschaft. Eine wilde Stunde unter ihren Händen macht auch die nächsten Stunden wild, und eine ruhige Strecke bleibt ruhig, bis etwas sie zerbricht.",
  },
  fractal: {
    name: "Die Weberin",
    blurb:
      "Arbeitet mit einem Faden und einer Zahl. Über der Mitte sind sich die Bewegungen einig und der Preis kommt weit; darunter streiten sie, und der Tag wird zu einer feinen Säge.",
  },
};

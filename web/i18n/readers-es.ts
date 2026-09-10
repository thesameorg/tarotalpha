/** The five readers in Spanish, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_ES: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Doña Verónica",
    blurb:
      "Lee el mercado sin adornos: sea cual sea el vaivén habitual del día, dentro de él las cartas pasean el precio. Sin teorías y sin promesas: la mano más vieja de la mesa.",
  },
  reversion: {
    name: "Hermana Anémona",
    blurb:
      "Cree que todo vuelve. Su precio es arrastrado hacia donde ha estado asentado últimamente, y la carta solo decide con qué fuerza tira la cuerda y hasta dónde se permite el desvío.",
  },
  analogy: {
    name: "Don Kofi",
    blurb:
      "Esta semana ya la ha visto. Busca en la semana pasada el tramo que más se parece a las últimas horas y deja que se repita, girado hacia donde digan las cartas.",
  },
  garch: {
    name: "Mamá Ife",
    blurb:
      "Dice que la desgracia viaja acompañada. Una hora violenta bajo sus manos vuelve violentas también las siguientes, y un tramo tranquilo sigue tranquilo hasta que algo lo rompe.",
  },
  fractal: {
    name: "La Tejedora",
    blurb:
      "Trabaja con un solo hilo y un solo número. Por encima del medio los movimientos se ponen de acuerdo y el precio llega lejos; por debajo discuten, y el día sale como una sierra fina.",
  },
};

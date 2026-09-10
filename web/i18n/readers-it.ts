/** The five readers in Italian, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_IT: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Nonna Vera",
    blurb:
      "Legge il mercato senza fronzoli: qualunque sia l'oscillazione abituale della giornata, dentro quella le carte spingono il prezzo. Nessuna teoria, nessuna promessa, la mano più anziana al tavolo.",
  },
  reversion: {
    name: "Suor Anemone",
    blurb:
      "Crede che tutto torni indietro. Il suo prezzo è tirato dove è stato seduto negli ultimi tempi, e una carta decide soltanto quanto forte tira la corda e quanto lontano è concesso allontanarsi.",
  },
  analogy: {
    name: "Vecchio Kofi",
    blurb:
      "Questa settimana l'ha già vista. Trova nella settimana passata il tratto che somiglia di più alle ultime ore e lo lascia ripetere, girato dalla parte che dicono le carte.",
  },
  garch: {
    name: "Mamma Ife",
    blurb:
      "Dice che i guai vanno in compagnia. Un'ora violenta tra le sue mani rende violente anche le ore seguenti, e un tratto tranquillo resta tranquillo finché qualcosa non lo rompe.",
  },
  fractal: {
    name: "La Tessitrice",
    blurb:
      "Lavora con un filo e un numero. Sopra la metà i movimenti vanno d'accordo e il prezzo va lontano; sotto litigano, e la giornata esce come una sega fine.",
  },
};

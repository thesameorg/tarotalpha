/** The five readers in French, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_FR: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Madame Véra",
    blurb:
      "Lit le marché sans détour : quel que soit le balancement habituel de la journée, c'est à l'intérieur que les cartes promènent le prix. Ni théories ni promesses — la plus vieille main de la table.",
  },
  reversion: {
    name: "Sœur Anémone",
    blurb:
      "Croit que tout revient. Son prix est tiré là où il se tient depuis quelque temps, et la carte décide seulement avec quelle force la corde tire et jusqu'où il est permis de s'éloigner.",
  },
  analogy: {
    name: "Vieux Kofi",
    blurb:
      "Cette semaine, il l'a déjà vue. Il cherche dans la semaine écoulée le passage qui ressemble le plus aux dernières heures et le laisse se rejouer, tourné du côté que disent les cartes.",
  },
  garch: {
    name: "Maman Ifé",
    blurb:
      "Dit que le malheur voyage en compagnie. Une heure violente sous ses mains rend violentes les heures suivantes, et un passage calme reste calme jusqu'à ce que quelque chose le brise.",
  },
  fractal: {
    name: "La Tisseuse",
    blurb:
      "Travaille avec un seul fil et un seul nombre. Au-dessus du milieu, les mouvements s'accordent et le prix va loin ; en dessous, ils se disputent, et la journée ressort en scie fine.",
  },
};

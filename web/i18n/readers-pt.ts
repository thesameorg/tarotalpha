/** The five readers in Brazilian Portuguese, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_PT: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Dona Vera",
    blurb:
      "Lê o mercado sem firulas: seja qual for o balanço de costume do dia, é dentro dele que as cartas passeiam o preço. Sem teorias e sem promessas — a mão mais velha da mesa.",
  },
  reversion: {
    name: "Irmã Anêmona",
    blurb:
      "Acredita que tudo volta. O preço dela é puxado para onde vem se acomodando ultimamente, e a carta só decide com que força a corda puxa e até onde é permitido se afastar.",
  },
  analogy: {
    name: "Velho Kofi",
    blurb:
      "Esta semana ele já viu. Procura na semana que passou o trecho mais parecido com as últimas horas e deixa que se repita, virado para onde as cartas mandarem.",
  },
  garch: {
    name: "Mãe Ifé",
    blurb:
      "Diz que desgraça anda acompanhada. Uma hora violenta sob as mãos dela deixa violentas também as seguintes, e um trecho calmo continua calmo até que algo o quebre.",
  },
  fractal: {
    name: "A Tecelã",
    blurb:
      "Trabalha com um só fio e um só número. Acima do meio os movimentos concordam entre si e o preço vai longe; abaixo dele discutem, e o dia sai como uma serra fina.",
  },
};

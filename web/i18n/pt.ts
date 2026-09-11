/** Brazilian Portuguese interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import type { Dictionary } from "./index";
import { MEANINGS_PT } from "./meanings-pt";
import { READERS_PT } from "./readers-pt";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "O Louco",
  "O Mago",
  "A Sacerdotisa",
  "A Imperatriz",
  "O Imperador",
  "O Hierofante",
  "Os Enamorados",
  "O Carro",
  "A Força",
  "O Eremita",
  "A Roda da Fortuna",
  "A Justiça",
  "O Enforcado",
  "A Morte",
  "A Temperança",
  "O Diabo",
  "A Torre",
  "A Estrela",
  "A Lua",
  "O Sol",
  "O Julgamento",
  "O Mundo",
] as const;

const RANKS = [
  "Ás",
  "Dois",
  "Três",
  "Quatro",
  "Cinco",
  "Seis",
  "Sete",
  "Oito",
  "Nove",
  "Dez",
  "Valete",
  "Cavaleiro",
  "Rainha",
  "Rei",
] as const;

const SUITS = { wands: "de Paus", cups: "de Copas", swords: "de Espadas", pentacles: "de Ouros" } as const;

if (MEANINGS_PT.length !== DECK.length)
  throw new Error(`Portuguese meanings cover ${String(MEANINGS_PT.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "para cima" : "para baixo");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "o desabamento é cancelado, o preço é lançado para cima e segue subindo"
        : "o mercado cai no primeiro candle e procura o fundo o dia inteiro";
    case "sun":
      return e.up
        ? "a luz inunda o gráfico, o preço salta e segura a altura"
        : "a luz se apaga, o preço despenca e desliza";
    case "wheel":
      return "a roda vira a tendência, o resto do dia corre contra a manhã";
    case "hanged":
      return "o mercado fica pendurado na média e não tem pressa";
    case "moon":
      return "névoa, pavios duas vezes mais longos, direção difícil de ler";
    case "death":
      return "a velha tendência morre, uma nova nasce com o sinal oposto";
    case "fool":
      return "movimento sem rumo, amplitude maior que o normal";
    case "drift":
      return `uma deriva regular ${upDown(e.up)} sem solavancos`;
    case "wands":
      return `os paus ${e.up ? "empurram o preço para cima" : "pressionam o preço para baixo"}`;
    case "cups":
      return e.wide ? "as copas esticam a amplitude dos candles" : "as copas comprimem a amplitude dos candles";
    case "swords":
      return "as espadas cortam com pavios e rompimentos falsos";
    case "pentacles":
      return "os ouros puxam o preço para a média do dia";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "um salto para cima" : "um desabamento";
    case "sun":
      return e.up ? "um salto" : "uma queda";
    case "wheel":
      return "uma virada";
    case "hanged":
      return "lateral";
    case "moon":
      return "uma tempestade";
    case "death":
      return "uma mudança de regime";
    case "fool":
      return "caos";
    case "drift":
      return `uma deriva ${upDown(e.up)}`;
    case "wands":
      return `um impulso ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "candles longos" : "candles estreitos";
    case "swords":
      return "picos";
    case "pentacles":
      return "um retorno à média";
  }
}

const CLOSING = {
  reversal: [
    "Quem entrou de manhã discute com as cartas à noite.",
    "A tendência troca de sinal no meio do dia; as cartas avisaram.",
  ],
  flat: [
    "O dia termina perto de zero: o mercado pensa, as cartas também.",
    "O dia vai de lado; as cartas não insistem.",
  ],
  up: [
    "Mais alto no fechamento. As cartas não dão razões, só a direção.",
    "Os touros recebem a bênção; os pavios continuam longos.",
  ],
  down: [
    "Mais baixo no fechamento. As cartas não explicam nada, as cartas mostram.",
    "Os ursos recebem o que é deles; as cartas registram, não se compadecem.",
  ],
} as const;

export const pt: Dictionary = {
  code: "pt",
  locale: "pt-BR",
  title: "TarotAlpha — previsão do mercado por leitura de tarô",
  tagline: "leitura por candles · ",
  theme: { label: "Tema", light: "Tema claro", dark: "Tema escuro", system: "Tema do sistema" },
  language: { label: "Idioma" },
  disclaimer: "não é aconselhamento financeiro; as cartas concordam",
  reversed: "invertida",
  day: (n: number): string => `dia ${String(n)}`,
  now: "agora",
  drawStep: (n: number): string => `Abrir a leitura · dia ${String(n)}`,
  mana: "Mana",
  close: "Fechar",
  picker: { choose: "Escolher instrumento", placeholder: "Ticker ou nome" },
  badAsset: "Um instrumento tem de 2 a 20 caracteres: letras latinas e dígitos",
  loading: "Carregando candles…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Tentar de novo",
  exchange: {
    unknown_asset: "Esse instrumento não existe na corretora",
    unavailable: "A corretora não responde a partir da sua rede",
    too_old: "A corretora devolveu um histórico incompleto",
  },
  share: {
    button: "Compartilhar",
    copy: "Copiar o link",
    snapshotFailed: "Não foi possível tirar o snapshot, tente de novo",
    tooMany: "Solicitações demais",
    failed: "Não foi possível criar o link, tente mais tarde",
    copied: "Copiado",
    selectToCopy: "Selecionado — pressione Ctrl+C",
    title: "Link para a leitura",
    lead: "Abre com os mesmos candles e as mesmas cartas. Quando o futuro chegar, o link mostrará a verificação da profecia.",
  },
  paywall: {
    meditating: "O módulo de pagamento ainda medita",
    title: "A mana acabou",
    lead: "Cada dia da leitura custa mana, e quanto mais distante, mais caro: o futuro é mais difícil de ver. A mana volta aos poucos a cada hora e se enche por completo com um novo dia.",
    buy: "Comprar",
    back: "Voltar à leitura",
  },
  fan: { hint: "Puxe três cartas", close: "fechar" },
  reader: {
    unscored: "Ainda sem nota",
    rated: (stars: number, of: number): string => `nota ${String(stars)} de ${String(of)}`,
    wins: (pct: number): string => `A previsão mais próxima das cinco em ${String(pct)} % das leituras`,
    others: "Todos à mesa",
    current: "Agora lê seus candles",
    choose: (name: string): string => `Que ${name} leia`,
  },
  reading: {
    notFound: "Leitura não encontrada",
    loadFailed: "Não foi possível carregar a leitura",
    ownReading: "Sua própria leitura",
    loading: "Carregando a leitura…",
    meta: (createdAt: string): string => `criada em ${createdAt}`,
    replaying: "Puxe três cartas para cada dia",
    replay: "Repetir a leitura",
    own: "Sua própria leitura para este instrumento",
  },
  mine: {
    button: "Minhas leituras",
    ripe: "pronta",
    ripensIn: (hours: number): string => `pronta em ${String(hours)} h`,
  },
  prophecy: {
    checking: "Verificando a profecia com os candles da corretora…",
    notYet: (closesAt: string): string =>
      `O futuro ainda não chegou: o primeiro candle a verificar fecha às ${closesAt}`,
    checkFailed: "A corretora não responde, a verificação da profecia foi adiada",
    noCandles: "A corretora não devolveu velas desse período",
    hit: (pct: number): string => `A profecia se cumpriu em ${String(pct)} %`,
    miss: (pct: number): string => `O mercado rejeitou a profecia: ${String(pct)} %`,
    final: "final",
    interim: "parcial",
    praise: {
      close: (name: string): string => `${name}: bem no mercado`,
      near: (name: string): string => `${name}: perto do mercado`,
      far: (name: string): string => `${name}: longe do mercado`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `dia ${String(day)}: ainda não` : `dia ${String(day)}: ${String(pct)} %`,
  },
  summaryTitle: "O dia em uma linha.",
  how: "Como é calculado",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_PT[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_PT[id].name,
  readerBlurb: (id: ReaderId): string => READERS_PT[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " em posição invertida" : "";
    const when = ["horas 0–8", "horas 8–16", "horas 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} rege o dia a partir das ${when}: ${ruling(f.rulingEffect)}.`
      : `Sem arcanos maiores hoje, o dia é dos menores; ${f.rulingName}${rev} dá o tom nas ${when}: ${ruling(f.rulingEffect)}.`;
    const path = `De manhã — ${short(f.effects[0])}, ao meio-dia — ${short(f.effects[1])}, à noite — ${short(f.effects[2])}.`;
    const number = `No fechamento do dia as cartas veem ${f.netPct} %, com ${f.highPct} % acima e ${f.lowPct} % abaixo pelo caminho.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

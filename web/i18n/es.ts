/** Spanish interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_ES } from "./meanings-es";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "El Loco",
  "El Mago",
  "La Sacerdotisa",
  "La Emperatriz",
  "El Emperador",
  "El Sumo Sacerdote",
  "Los Enamorados",
  "El Carro",
  "La Fuerza",
  "El Ermitaño",
  "La Rueda de la Fortuna",
  "La Justicia",
  "El Colgado",
  "La Muerte",
  "La Templanza",
  "El Diablo",
  "La Torre",
  "La Estrella",
  "La Luna",
  "El Sol",
  "El Juicio",
  "El Mundo",
] as const;

const RANKS = [
  "As",
  "Dos",
  "Tres",
  "Cuatro",
  "Cinco",
  "Seis",
  "Siete",
  "Ocho",
  "Nueve",
  "Diez",
  "Sota",
  "Caballero",
  "Reina",
  "Rey",
] as const;

const SUITS = { wands: "de Bastos", cups: "de Copas", swords: "de Espadas", pentacles: "de Oros" } as const;

if (MEANINGS_ES.length !== DECK.length)
  throw new Error(`Spanish meanings cover ${String(MEANINGS_ES.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "al alza" : "a la baja");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "el derrumbe queda cancelado, el precio sale disparado y sigue subiendo"
        : "el mercado cae en la primera vela y busca suelo todo el día";
    case "sun":
      return e.up
        ? "la luz inunda el gráfico, el precio salta y mantiene la altura"
        : "la luz se apaga, el precio se hunde y se desliza";
    case "wheel":
      return "la rueda gira la tendencia, el resto del día va contra la mañana";
    case "hanged":
      return "el mercado cuelga junto a la media y no tiene prisa";
    case "moon":
      return "niebla, mechas el doble de largas, la dirección se lee con dificultad";
    case "death":
      return "la vieja tendencia muere, nace una nueva con el signo opuesto";
    case "fool":
      return "movimiento sin rumbo, rango más amplio de lo habitual";
    case "drift":
      return `una deriva pareja ${upDown(e.up)} sin movimientos bruscos`;
    case "wands":
      return `los bastos ${e.up ? "empujan el precio al alza" : "presionan el precio a la baja"}`;
    case "cups":
      return e.wide ? "las copas estiran el rango de las velas" : "las copas comprimen el rango de las velas";
    case "swords":
      return "las espadas cortan con mechas y rupturas falsas";
    case "pentacles":
      return "los oros tiran del precio hacia la media del día";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "un salto al alza" : "un derrumbe";
    case "sun":
      return e.up ? "un salto" : "una caída";
    case "wheel":
      return "un giro";
    case "hanged":
      return "lateral";
    case "moon":
      return "una tormenta";
    case "death":
      return "un cambio de régimen";
    case "fool":
      return "caos";
    case "drift":
      return `una deriva ${upDown(e.up)}`;
    case "wands":
      return `un impulso ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "velas largas" : "velas estrechas";
    case "swords":
      return "picos";
    case "pentacles":
      return "un retorno a la media";
  }
}

const CLOSING = {
  reversal: [
    "Quien entró por la mañana discute con las cartas al anochecer.",
    "La tendencia cambia de signo a mediodía; las cartas avisaron.",
  ],
  flat: [
    "El día termina cerca de cero: el mercado piensa, las cartas también.",
    "El día se va en lateral; las cartas no insisten.",
  ],
  up: [
    "Más alto al cierre. Las cartas no dan razones, solo la dirección.",
    "Los toros reciben su bendición; las mechas siguen largas.",
  ],
  down: [
    "Más bajo al cierre. Las cartas no explican nada, las cartas muestran.",
    "Los osos reciben lo suyo; las cartas registran, no compadecen.",
  ],
} as const;

export const es: Dictionary = {
  code: "es",
  locale: "es-ES",
  title: "TarotAlpha — pronóstico del mercado por tirada de tarot",
  tagline: "tirada por velas · ",
  theme: { label: "Tema", light: "Tema claro", dark: "Tema oscuro", system: "Tema del sistema" },
  language: { label: "Idioma" },
  disclaimer: "no es asesoramiento financiero; las cartas opinan lo mismo",
  reversed: "invertida",
  day: (n: number): string => `día ${String(n)}`,
  now: "ahora",
  drawStep: (n: number): string => `Abrir la tirada · día ${String(n)}`,
  lockedStep: "dos días gratis, el tercero tras el muro de pago",
  close: "Cerrar",
  picker: { choose: "Elegir instrumento", placeholder: "Ticker o nombre" },
  badAsset: "El instrumento son 2–20 caracteres: letras latinas y dígitos",
  loading: "Cargando velas…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Reintentar",
  exchange: {
    unknown_asset: "No existe ese instrumento en el exchange",
    unavailable: "El exchange no responde desde tu red",
    too_old: "El exchange devolvió un historial incompleto",
  },
  share: {
    button: "Compartir",
    copy: "Copiar el enlace",
    snapshotFailed: "No se pudo tomar la instantánea, inténtalo de nuevo",
    tooMany: "Demasiadas solicitudes",
    failed: "No se pudo crear el enlace, inténtalo más tarde",
    copied: "Copiado",
    selectToCopy: "Seleccionado — pulsa Ctrl+C",
    title: "Enlace a la tirada",
    lead: "Se abre con las mismas velas y cartas. Cuando el futuro llegue, el enlace mostrará la verificación de la profecía.",
  },
  paywall: {
    meditating: "El módulo de pago aún medita",
    title: "Las cartas callan a partir de aquí",
    lead: "El acceso gratuito cubre dos días. El tercer día y el horizonte más lejano se abren con el estatus de iniciado.",
    back: "Volver a la tirada",
    tiers: [
      {
        name: "Iniciado",
        price: "$4.99",
        period: "/mes",
        features: ["hasta 7 días adelante", "historial de tiradas", "sin anuncios (de todos modos no hay)"],
        cta: "Elegir",
      },
      {
        name: "Arcano Mayor",
        price: "$19.99",
        period: "/mes",
        features: [
          "todo lo de Iniciado",
          "barajas premium",
          "una segunda opinión de otra baraja",
          "fuegos artificiales al revelar",
        ],
        cta: "Elegir",
      },
      {
        name: "Institucional",
        price: "$999",
        period: "/mes",
        features: ["acceso API", "informe PDF con sello", "gestor personal"],
        cta: "Solicitar",
      },
    ],
  },
  fan: { hint: "Saca tres cartas", close: "cerrar" },
  reading: {
    notFound: "Tirada no encontrada",
    loadFailed: "No se pudo cargar la tirada",
    ownReading: "Tu propia tirada",
    loading: "Cargando la tirada…",
    meta: (createdAt: string): string => `creada ${createdAt}`,
    replaying: "Saca tres cartas por cada día",
    replay: "Repetir la tirada",
    own: "Tu propia tirada para este instrumento",
  },
  prophecy: {
    checking: "Verificando la profecía con las velas del exchange…",
    notYet: (closesAt: string): string =>
      `El futuro aún no ha llegado: la primera vela a verificar cierra a las ${closesAt}`,
    checkFailed: "El exchange no responde, la verificación de la profecía se pospone",
    hit: (pct: number): string => `La profecía se cumplió al ${String(pct)} %`,
    miss: (pct: number): string => `El mercado rechazó la profecía: ${String(pct)} %`,
    compared: (n: number, total: number): string => `en ${String(n)} de ${String(total)} velas`,
    final: "final",
    interim: "provisional",
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `día ${String(day)}: aún no`
        : `día ${String(day)}: ${String(pct)} % (${String(hits)}/${String(compared)})`,
  },
  summaryTitle: "El día en una línea.",
  how: "Cómo se calcula",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_ES[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " en posición invertida" : "";
    const when = ["horas 0–8", "horas 8–16", "horas 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} rige el día en las ${when}: ${ruling(f.rulingEffect)}.`
      : `Sin arcanos mayores hoy, el día es de los menores; ${f.rulingName}${rev} marca el tono en las ${when}: ${ruling(f.rulingEffect)}.`;
    const path = `Por la mañana — ${short(f.effects[0])}, al mediodía — ${short(f.effects[1])}, por la tarde — ${short(f.effects[2])}.`;
    const number = `Al cierre del día las cartas ven ${f.netPct} % (${f.netAtr} ATR), con ${f.highPct} % por arriba y ${f.lowPct} % por abajo en el camino.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

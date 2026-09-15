/** French interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import type { Dictionary } from "./index";
import { MEANINGS_FR } from "./meanings-fr";
import { READERS_FR } from "./readers-fr";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "Le Fou",
  "Le Magicien",
  "La Grande Prêtresse",
  "L'Impératrice",
  "L'Empereur",
  "Le Hiérophante",
  "Les Amoureux",
  "Le Chariot",
  "La Force",
  "L'Ermite",
  "La Roue de la Fortune",
  "La Justice",
  "Le Pendu",
  "La Mort",
  "La Tempérance",
  "Le Diable",
  "La Tour",
  "L'Étoile",
  "La Lune",
  "Le Soleil",
  "Le Jugement",
  "Le Monde",
] as const;

const RANKS = [
  "As",
  "Deux",
  "Trois",
  "Quatre",
  "Cinq",
  "Six",
  "Sept",
  "Huit",
  "Neuf",
  "Dix",
  "Valet",
  "Cavalier",
  "Reine",
  "Roi",
] as const;

const SUITS = { wands: "de Bâtons", cups: "de Coupes", swords: "d'Épées", pentacles: "de Pentacles" } as const;

if (MEANINGS_FR.length !== DECK.length)
  throw new Error(`French meanings cover ${String(MEANINGS_FR.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "vers le haut" : "vers le bas");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "l'effondrement est annulé, le prix est propulsé et continue de monter"
        : "le marché chute dès la première bougie et cherche un plancher toute la journée";
    case "sun":
      return e.up
        ? "la lumière inonde le graphique, le prix bondit et tient la hauteur"
        : "la lumière s'éteint, le prix décroche et glisse";
    case "wheel":
      return "la roue retourne la tendance, le reste de la journée va contre le matin";
    case "hanged":
      return "le marché reste suspendu près de la moyenne et n'est pas pressé";
    case "moon":
      return "brouillard, mèches deux fois plus longues, direction difficile à lire";
    case "death":
      return "l'ancienne tendance meurt, une nouvelle naît avec le signe opposé";
    case "fool":
      return "mouvement sans repère, amplitude plus large que d'habitude";
    case "drift":
      return `une dérive régulière ${upDown(e.up)} sans à-coups`;
    case "wands":
      return `les bâtons ${e.up ? "poussent le prix vers le haut" : "pèsent sur le prix"}`;
    case "cups":
      return e.wide ? "les coupes étirent l'amplitude des bougies" : "les coupes compriment l'amplitude des bougies";
    case "swords":
      return "les épées tranchent par les mèches et les fausses cassures";
    case "pentacles":
      return "les pentacles ramènent le prix vers la moyenne du jour";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "un bond" : "un effondrement";
    case "sun":
      return e.up ? "un saut" : "une chute";
    case "wheel":
      return "un retournement";
    case "hanged":
      return "du plat";
    case "moon":
      return "une tempête";
    case "death":
      return "un changement de régime";
    case "fool":
      return "du chaos";
    case "drift":
      return `une dérive ${upDown(e.up)}`;
    case "wands":
      return `une impulsion ${upDown(e.up)}`;
    case "cups":
      return e.wide ? "de longues bougies" : "des bougies étroites";
    case "swords":
      return "des pics";
    case "pentacles":
      return "un retour à la moyenne";
  }
}

const CLOSING = {
  reversal: [
    "Qui est entré le matin dispute avec les cartes le soir.",
    "La tendance change de signe à midi ; les cartes avaient prévenu.",
  ],
  flat: [
    "La journée finit près de zéro : le marché réfléchit, les cartes aussi.",
    "La journée part en latéral ; les cartes n'insistent pas.",
  ],
  up: [
    "Plus haut à la clôture. Les cartes ne donnent pas de raisons, seulement la direction.",
    "Les taureaux reçoivent leur bénédiction ; les mèches restent longues.",
  ],
  down: [
    "Plus bas à la clôture. Les cartes n'expliquent rien, les cartes montrent.",
    "Les ours ont leur dû ; les cartes constatent, elles ne compatissent pas.",
  ],
} as const;

export const fr: Dictionary = {
  code: "fr",
  locale: "fr-FR",
  title: "TarotAlpha — prévision du marché par tirage de tarot",
  tagline: "tirage par bougies",
  theme: { label: "Thème", light: "Thème clair", dark: "Thème sombre", system: "Thème du système" },
  language: { label: "Langue" },
  disclaimer: "ceci n'est pas un conseil financier ; les cartes sont du même avis",
  reversed: "renversée",
  day: (n: number): string => `jour ${String(n)}`,
  castHere: "tirage fait",
  now: "maintenant",
  drawStep: (n: number): string => `Ouvrir le tirage · jour ${String(n)}`,
  mana: "Mana",
  close: "Fermer",
  picker: { choose: "Choisir un instrument", placeholder: "Ticker ou nom" },
  badAsset: "Un instrument fait 2 à 20 caractères : lettres latines et chiffres",
  loading: "Chargement des bougies…",
  per24h: "/ 24h",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Réessayer",
  exchange: {
    unknown_asset: "Cet instrument n'existe pas sur la bourse",
    unavailable: "La bourse ne répond pas depuis votre réseau",
    too_old: "La bourse a renvoyé un historique incomplet",
  },
  share: {
    inTelegram: "Envoyer sur Telegram",
    orWeb: "Ou copier le lien",
    button: "Partager",
    copy: "Copier le lien",
    snapshotFailed: "Impossible de prendre l'instantané, réessayez",
    tooMany: "Trop de requêtes",
    failed: "Impossible de créer le lien, réessayez plus tard",
    copied: "Copié",
    selectToCopy: "Sélectionné — appuyez sur Ctrl+C",
    title: "Lien vers le tirage",
    lead: "S'ouvre avec les mêmes bougies et les mêmes cartes. Quand le futur sera arrivé, le lien montrera la vérification de la prophétie.",
  },
  manaPanel: {
    refill: "Se recharge d'un point par heure et entièrement à minuit.",
    full: "Le réservoir est plein",
    fullAt: (time: string): string => `Plein à ${time}`,
  },
  paid: {
    title: "Mana supplémentaire",
    order: "Dépensée après la mana ordinaire",
    what: "S'achète avec de l'argent réel. Elle ne se recharge pas et n'expire pas : elle attend d'être dépensée.",
    invite: (mana: number): string => `Inviter un initié · +${String(mana)} pour chacun`,
    welcomed: (mana: number): string => `On vous a amené : +${String(mana)} de mana`,
  },
  paywall: {
    slow: "Payé. La mana arrive",
    scan: "Visez avec la caméra du portefeuille",
    backToReading: "Retour au tirage",
    exact: "Montant exact",
    wasTon: "anciennement TON",
    pick: "Avec quoi payez-vous ?",
    payWith: "Payer depuis le portefeuille",
    byHand: "Envoyer à la main",
    address: "Portefeuille",
    comment: "Commentaire",
    commentWarn:
      "Sans le commentaire le paiement reste introuvable. Les portefeuilles nomment ce champ comment, memo ou note.",
    openWallet: "Ouvrir le portefeuille",
    waiting: "En attente du paiement",
    credited: (mana: number): string => `Dans la bourse : ${String(mana)}`,
    endless: "Votre bourse ne se vide plus",
    failed: "Cela n'a pas marché. Réessayez",
    meditating: "Le module de paiement médite encore",
    titleShort: "Mana insuffisant",
    titleTopUp: "Acheter du mana",
    house: "choix de la maison",
    endlessLot: "Une bourse qui ne se vide jamais",
    paid: "Crédité",
    lead: "Chaque jour du tirage coûte du mana, et plus il est lointain, plus il coûte : l'avenir se voit moins bien. Le mana revient peu à peu chaque heure et se remplit entièrement avec un nouveau jour.",
    buy: "Acheter",
    back: "Retour au tirage",
  },
  fan: { hint: "Tirez trois cartes", close: "fermer" },
  cloth: "Ouvrez un tirage de tarot — découvrez le destin des bougies",
  reader: {
    unscored: "Pas encore notée",
    rated: (stars: number, of: number): string => `note ${String(stars)} sur ${String(of)}`,
    wins: (pct: number): string => `La prédiction la plus proche des cinq dans ${String(pct)} % des tirages`,
    others: "Tout le monde à la table",
    current: "Tire les cartes pour vous",
    locked: (name: string): string => `${name} mène ce tirage jusqu'au dernier jour`,
    choose: (name: string): string => `Que ${name} tire les cartes`,
    ask: (name: string, cost: number): string => `Demander à une autre · ${name} · ${String(cost)}`,
    asked: "A déjà parlé",
    askMore: "Demander à une autre",
    askNote: (cost: number): string =>
      `${String(cost)} manas une seule fois : elle lit tous les jours de ce tirage, ceux ouverts et ceux à venir.`,
    candles: "Les bougies de la prévision sont les siennes",
    line: "La sienne, c’est la ligne de sa couleur",
    move: (change: string, day: number): string => `${change} à la fin du jour ${String(day)}`,
    closest: "La plus proche",
  },
  reading: {
    notFound: "Tirage introuvable",
    loadFailed: "Impossible de charger le tirage",
    ownReading: "Votre propre tirage",
    loading: "Chargement du tirage…",
    meta: (createdAt: string): string => `créé le ${createdAt}`,
    replaying: "Tirez trois cartes pour chaque jour",
    replay: "Rejouer le tirage",
    own: "Votre propre tirage pour cet instrument",
  },
  scroll: {
    open: "Obtenir le parchemin",
    title: "Parchemin",
    certify: (id: string, asset: string, pct: number): string =>
      `Il est certifié que le tirage ${id} a prédit le mouvement de ${asset} à ${String(pct)} %`,
    instrument: "Instrument",
    anchor: "Ancre",
    reader: "Cartomancienne",
    accuracy: "Précision",
    print: "Imprimer",
    reading: "Vers le tirage",
    notRipe: "Le parchemin est délivré à la clôture de la dernière bougie de la prévision",
    made: "parchemin",
  },
  mine: {
    button: "Mes tirages",
    ripe: "prêt",
    days: (n: number): string => `jours : ${String(n)}`,
    opinions: (n: number): string => `seconds avis : ${String(n)}`,
    ripensIn: (hours: number): string => `prêt dans ${String(hours)} h`,
  },
  prophecy: {
    legend: "Les bougies creuses cyan et roses sont le tirage ; les pleines vertes et rouges sont le marché",
    checking: "Vérification de la prophétie sur les bougies de la bourse…",
    notYet: (closesAt: string): string =>
      `Le futur n'est pas encore arrivé : la première bougie à vérifier clôture à ${closesAt}`,
    checkFailed: "La bourse ne répond pas, la vérification de la prophétie est reportée",
    noCandles: "La bourse n'a renvoyé aucune bougie pour cette période",
    hit: (pct: number): string => `La prophétie s'est réalisée à ${String(pct)} %`,
    miss: (pct: number): string => `Le marché a rejeté la prophétie : ${String(pct)} %`,
    final: "final",
    interim: "provisoire",
    praise: {
      close: (name: string): string => `${name}: en plein dans le marché`,
      near: (name: string): string => `${name}: près du marché`,
      far: (name: string): string => `${name}: loin du marché`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `jour ${String(day)} : pas encore` : `jour ${String(day)} : ${String(pct)} %`,
  },
  summaryTitle: "La journée en une ligne.",
  how: "Méthode",
  contact: "Contact",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${RANKS[card.rank - 1] ?? ""} ${SUITS[card.suit]}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_FR[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_FR[id].name,
  readerBlurb: (id: ReaderId): string => READERS_FR[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " en position renversée" : "";
    const when = ["heures 0–8", "heures 8–16", "heures 16–24"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev} règne sur la journée dès les ${when} : ${ruling(f.rulingEffect)}.`
      : `Pas d'arcane majeur aujourd'hui, la journée est aux mineurs ; ${f.rulingName}${rev} donne le ton dans les ${when} : ${ruling(f.rulingEffect)}.`;
    const path = `Le matin — ${short(f.effects[0])}, à midi — ${short(f.effects[1])}, le soir — ${short(f.effects[2])}.`;
    const number = `À la clôture de la journée, les cartes voient ${f.netPct} %, avec ${f.highPct} % au-dessus et ${f.lowPct} % en dessous en chemin.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

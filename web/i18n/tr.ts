/** Turkish interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_TR } from "./meanings-tr";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "Deli",
  "Büyücü",
  "Azize",
  "İmparatoriçe",
  "İmparator",
  "Aziz",
  "Âşıklar",
  "Savaş Arabası",
  "Güç",
  "Ermiş",
  "Kader Çarkı",
  "Adalet",
  "Asılan Adam",
  "Ölüm",
  "Denge",
  "Şeytan",
  "Kule",
  "Yıldız",
  "Ay",
  "Güneş",
  "Mahkeme",
  "Dünya",
] as const;

// Possessive forms: "Değnek Ası", "Kupa Kraliçesi".
const RANKS = [
  "Ası",
  "İkilisi",
  "Üçlüsü",
  "Dörtlüsü",
  "Beşlisi",
  "Altılısı",
  "Yedilisi",
  "Sekizlisi",
  "Dokuzlusu",
  "Onlusu",
  "Uşağı",
  "Şövalyesi",
  "Kraliçesi",
  "Kralı",
] as const;

const SUITS = { wands: "Değnek", cups: "Kupa", swords: "Kılıç", pentacles: "Tılsım" } as const;

if (MEANINGS_TR.length !== DECK.length)
  throw new Error(`Turkish meanings cover ${String(MEANINGS_TR.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "yukarı" : "aşağı");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "çöküş iptal, fiyat yukarı fırlatılıyor ve çekilmeye devam ediyor"
        : "piyasa ilk mumda düşüyor ve bütün gün dip arıyor";
    case "sun":
      return e.up ? "ışık grafiği dolduruyor, fiyat sıçrayıp yüksekte tutunuyor" : "ışık sönüyor, fiyat düşüp kayıyor";
    case "wheel":
      return "çark trendi çeviriyor, günün kalanı sabaha karşı akıyor";
    case "hanged":
      return "piyasa ortalamanın yanında asılı, acelesi yok";
    case "moon":
      return "sis, fitiller iki kat uzun, yön zor okunuyor";
    case "death":
      return "eski trend ölüyor, yenisi ters işaretle doğuyor";
    case "fool":
      return "pusulasız hareket, aralık her zamankinden geniş";
    case "drift":
      return `sert hareketsiz, düzenli bir ${upDown(e.up)} kayma`;
    case "wands":
      return `değnekler fiyatı ${e.up ? "yukarı itiyor" : "aşağı bastırıyor"}`;
    case "cups":
      return e.wide ? "kupalar mumların aralığını geriyor" : "kupalar mumların aralığını sıkıyor";
    case "swords":
      return "kılıçlar fitillerle ve sahte kırılmalarla kesiyor";
    case "pentacles":
      return "tılsımlar fiyatı günün ortalamasına çekiyor";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "yukarı sıçrama" : "çöküş";
    case "sun":
      return e.up ? "sıçrama" : "düşüş";
    case "wheel":
      return "dönüş";
    case "hanged":
      return "yatay";
    case "moon":
      return "fırtına";
    case "death":
      return "rejim değişimi";
    case "fool":
      return "kaos";
    case "drift":
      return `${upDown(e.up)} kayma`;
    case "wands":
      return `${upDown(e.up)} ivme`;
    case "cups":
      return e.wide ? "uzun mumlar" : "kısa mumlar";
    case "swords":
      return "sivri uçlar";
    case "pentacles":
      return "ortalamaya dönüş";
  }
}

const CLOSING = {
  reversal: ["Sabah girenler akşam kartlarla tartışır.", "Trend öğlen işaret değiştiriyor; kartlar uyarmıştı."],
  flat: ["Gün sıfıra yakın bitiyor: piyasa düşünüyor, kartlar da.", "Gün yatay geçiyor; kartlar ısrar etmiyor."],
  up: ["Kapanış daha yüksek. Kartlar sebep söylemez, yalnızca yön.", "Boğalar kutsanıyor; fitiller uzun kalıyor."],
  down: ["Kapanış daha düşük. Kartlar açıklamaz, kartlar gösterir.", "Ayılar payını alıyor; kartlar kaydeder, acımaz."],
} as const;

export const tr: Dictionary = {
  code: "tr",
  locale: "tr-TR",
  title: "TarotAlpha — tarot açılımıyla piyasa tahmini",
  tagline: "mumlarla açılım · ",
  theme: { label: "Tema", light: "Açık tema", dark: "Koyu tema", system: "Sistem teması" },
  language: { label: "Dil" },
  disclaimer: "yatırım tavsiyesi değildir; kartlar da aynı fikirde",
  reversed: "ters",
  day: (n: number): string => `${String(n)}. gün`,
  now: "şimdi",
  drawStep: (n: number): string => `Açılımı aç · ${String(n)}. gün`,
  lockedStep: "iki gün ücretsiz, üçüncüsü ödeme duvarının ardında",
  close: "Kapat",
  picker: { choose: "Enstrüman seç", placeholder: "Sembol veya ad" },
  badAsset: "Enstrüman 2–20 karakter: Latin harfleri ve rakamlar",
  loading: "Mumlar yükleniyor…",
  per24h: "/ 24s",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "Yeniden dene",
  exchange: {
    unknown_asset: "Borsada böyle bir enstrüman yok",
    unavailable: "Borsa sizin ağınızdan yanıt vermiyor",
    too_old: "Borsa eksik bir geçmiş döndürdü",
  },
  share: {
    button: "Paylaş",
    copy: "Bağlantıyı kopyala",
    snapshotFailed: "Anlık görüntü alınamadı, yeniden deneyin",
    tooMany: "Çok fazla istek",
    failed: "Bağlantı oluşturulamadı, daha sonra deneyin",
    copied: "Kopyalandı",
    selectToCopy: "Seçildi — Ctrl+C'ye basın",
    title: "Açılım bağlantısı",
    lead: "Aynı mumlar ve aynı kartlarla açılır. Gelecek geldiğinde bağlantı kehanet kontrolünü gösterir.",
  },
  paywall: {
    meditating: "Ödeme modülü hâlâ meditasyonda",
    title: "Bundan sonra kartlar susuyor",
    lead: "Ücretsiz erişim iki günü kapsar. Üçüncü gün ve daha uzak ufuk, müptedi statüsüyle açılır.",
    back: "Açılıma dön",
    tiers: [
      {
        name: "Müptedi",
        price: "$4.99",
        period: "/ay",
        features: ["7 güne kadar ileri", "açılım geçmişi", "reklamsız (zaten yok)"],
        cta: "Seç",
      },
      {
        name: "Büyük Arkana",
        price: "$19.99",
        period: "/ay",
        features: [
          "Müptedi'nin her şeyi",
          "premium desteler",
          "başka bir desteden ikinci görüş",
          "açılışta havai fişek",
        ],
        cta: "Seç",
      },
      {
        name: "Kurumsal",
        price: "$999",
        period: "/ay",
        features: ["API erişimi", "mühürlü PDF raporu", "kişisel yönetici"],
        cta: "Talep et",
      },
    ],
  },
  fan: { hint: "Üç kart çekin", close: "kapat" },
  reading: {
    notFound: "Açılım bulunamadı",
    loadFailed: "Açılım yüklenemedi",
    ownReading: "Kendi açılımın",
    loading: "Açılım yükleniyor…",
    meta: (createdAt: string): string => `oluşturuldu ${createdAt}`,
    replaying: "Her gün için üç kart çekin",
    replay: "Açılımı yeniden oynat",
    own: "Bu enstrüman için kendi açılımın",
  },
  prophecy: {
    checking: "Kehanet borsanın mumlarıyla kontrol ediliyor…",
    notYet: (closesAt: string): string =>
      `Gelecek henüz gelmedi: kontrol edilecek ilk mum saat ${closesAt} itibarıyla kapanır`,
    checkFailed: "Borsa yanıt vermiyor, kehanet kontrolü ertelendi",
    hit: (pct: number): string => `Kehanet %${String(pct)} tuttu`,
    miss: (pct: number): string => `Piyasa kehaneti reddetti: %${String(pct)}`,
    compared: (n: number, total: number): string => `${String(total)} mumdan ${String(n)} tanesinde`,
    final: "nihai",
    interim: "geçici",
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `${String(day)}. gün: henüz değil`
        : `${String(day)}. gün: %${String(pct)} (${String(hits)}/${String(compared)})`,
  },
  summaryTitle: "Gün tek satırda.",
  how: "Nasıl hesaplanıyor",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${SUITS[card.suit]} ${RANKS[card.rank - 1] ?? ""}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_TR[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " (ters)" : "";
    const when = ["0–8 saatleri", "8–16 saatleri", "16–24 saatleri"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${when} itibarıyla güne ${f.rulingName}${rev} hükmediyor: ${ruling(f.rulingEffect)}.`
      : `Bugün büyük arkana yok, gün küçüklerin; ${when}nde tonu ${f.rulingName}${rev} veriyor: ${ruling(f.rulingEffect)}.`;
    const path = `Sabah — ${short(f.effects[0])}, öğlen — ${short(f.effects[1])}, akşam — ${short(f.effects[2])}.`;
    const number = `Gün kapanışında kartlar %${f.netPct} (${f.netAtr} ATR) görüyor; yolda yukarıda %${f.highPct}, aşağıda %${f.lowPct}.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

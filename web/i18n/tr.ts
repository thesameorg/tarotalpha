/** Turkish interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { ReaderId } from "../../engine/readers";
import type { Dictionary } from "./index";
import { MEANINGS_TR } from "./meanings-tr";
import { READERS_TR } from "./readers-tr";
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
  tagline: "mumlarla açılım",
  theme: { label: "Tema", light: "Açık tema", dark: "Koyu tema", system: "Sistem teması" },
  language: { label: "Dil" },
  disclaimer: "yatırım tavsiyesi değildir; kartlar da aynı fikirde",
  reversed: "ters",
  day: (n: number): string => `${String(n)}. gün`,
  castHere: "açılım yapıldı",
  now: "şimdi",
  drawStep: (n: number): string => `Açılımı aç · ${String(n)}. gün`,
  mana: "Mana",
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
    inTelegram: "Telegram'da gönder",
    orWeb: "Ya da site bağlantısıyla, Telegram dışındakiler için",
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
  manaPanel: {
    refill: "Saatte bir puan, gece yarısında ise tamamen dolar.",
    full: "Depo dolu",
    fullAt: (time: string): string => `${time} itibarıyla dolu`,
  },
  paid: {
    title: "Ekstra mana",
    order: "Normal manadan sonra harcanır",
    what: "Gerçek parayla alınır. Kendiliğinden dolmaz ve yanmaz: harcayana kadar durur.",
    invite: (mana: number): string => `Bir mürit çağır · ikinize de +${String(mana)}`,
    welcomed: (mana: number): string => `Sizi getirdiler: +${String(mana)} mana`,
  },
  paywall: {
    slow: "Ödendi. Mana birazdan gelecek",
    scan: "Cüzdan kameranızla okutun",
    backToReading: "Açılıma dön",
    exact: "Tam tutar",
    wasTon: "eski adıyla TON",
    pick: "Neyle ödüyorsunuz?",
    payWith: "Cüzdandan öde",
    byHand: "Elle gönder",
    address: "Cüzdan",
    comment: "Açıklama",
    commentWarn: "Açıklama olmadan ödeme bulunamaz. Cüzdanlar bu alana comment, memo ya da note der.",
    openWallet: "Cüzdanı aç",
    waiting: "Ödeme bekleniyor",
    credited: (mana: number): string => `Yüklendi. Satın alınan mana: ${String(mana)}`,
    endless: "Yüklendi. Keseniz artık tükenmiyor",
    failed: "Olmadı. Tekrar deneyin",
    meditating: "Ödeme modülü hâlâ meditasyonda",
    title: "Mana tükendi",
    lead: "Açılımın her günü mana ister ve gün ne kadar uzaksa o kadar pahalıdır: gelecek zor görünür. Mana her saat biraz geri gelir, yeni bir günle tamamen dolar.",
    buy: "Satın al",
    back: "Açılıma dön",
  },
  fan: { hint: "Üç kart çekin", close: "kapat" },
  cloth: "Bir tarot açılımı yapın, mumların kaderini öğrenin",
  reader: {
    unscored: "Henüz puanlanmadı",
    rated: (stars: number, of: number): string => `${String(of)} üzerinden ${String(stars)} puan`,
    wins: (pct: number): string => `Beş falcı arasında açılımların %${String(pct)} oranında en yakın olan`,
    others: "Masadaki herkes",
    current: "Size fal bakıyor",
    locked: (name: string): string => `Bu açılımı son güne kadar ${name} yürütüyor`,
    choose: (name: string): string => `${name} baksın`,
    ask: (name: string, cost: number): string => `Bir kişiye daha sor · ${name} · ${String(cost)}`,
    asked: "Zaten konuştu",
    closest: "En yakını",
  },
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
  mine: {
    button: "Açılımlarım",
    ripe: "hazır",
    ripensIn: (hours: number): string => `${String(hours)} s sonra hazır`,
  },
  prophecy: {
    legend: "İçi boş camgöbeği ve pembe mumlar açılımın tahmini; dolu yeşil ve kırmızı mumlar piyasanın kendisi",
    checking: "Kehanet borsanın mumlarıyla kontrol ediliyor…",
    notYet: (closesAt: string): string =>
      `Gelecek henüz gelmedi: kontrol edilecek ilk mum saat ${closesAt} itibarıyla kapanır`,
    checkFailed: "Borsa yanıt vermiyor, kehanet kontrolü ertelendi",
    noCandles: "Borsa bu aralık için mum vermedi",
    hit: (pct: number): string => `Kehanet %${String(pct)} tuttu`,
    miss: (pct: number): string => `Piyasa kehaneti reddetti: %${String(pct)}`,
    final: "nihai",
    interim: "geçici",
    praise: {
      close: (name: string): string => `${name}: tam piyasanın üstünde`,
      near: (name: string): string => `${name}: piyasaya yakın`,
      far: (name: string): string => `${name}: piyasadan uzak`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `gün ${String(day)}: henüz değil` : `gün ${String(day)}: %${String(pct)}`,
  },
  summaryTitle: "Gün tek satırda.",
  how: "Yöntem",
  contact: "İletişim",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${SUITS[card.suit]} ${RANKS[card.rank - 1] ?? ""}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_TR[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  readerName: (id: ReaderId): string => READERS_TR[id].name,
  readerBlurb: (id: ReaderId): string => READERS_TR[id].blurb,
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " (ters)" : "";
    const when = ["0–8 saatleri", "8–16 saatleri", "16–24 saatleri"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${when} itibarıyla güne ${f.rulingName}${rev} hükmediyor: ${ruling(f.rulingEffect)}.`
      : `Bugün büyük arkana yok, gün küçüklerin; ${when}nde tonu ${f.rulingName}${rev} veriyor: ${ruling(f.rulingEffect)}.`;
    const path = `Sabah — ${short(f.effects[0])}, öğlen — ${short(f.effects[1])}, akşam — ${short(f.effects[2])}.`;
    const number = `Gün kapanışında kartlar %${f.netPct} görüyor; yolda yukarıda %${f.highPct}, aşağıda %${f.lowPct}.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

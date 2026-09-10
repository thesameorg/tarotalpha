/** Japanese interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_JA } from "./meanings-ja";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "愚者",
  "魔術師",
  "女教皇",
  "女帝",
  "皇帝",
  "教皇",
  "恋人",
  "戦車",
  "力",
  "隠者",
  "運命の輪",
  "正義",
  "吊るされた男",
  "死神",
  "節制",
  "悪魔",
  "塔",
  "星",
  "月",
  "太陽",
  "審判",
  "世界",
] as const;

const RANKS = [
  "エース",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "ペイジ",
  "ナイト",
  "クイーン",
  "キング",
] as const;

const SUITS = { wands: "ワンド", cups: "カップ", swords: "ソード", pentacles: "ペンタクル" } as const;

if (MEANINGS_JA.length !== DECK.length)
  throw new Error(`Japanese meanings cover ${String(MEANINGS_JA.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "上" : "下");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "暴落は取り消され、価格は跳ね上げられてさらに上へ引かれる"
        : "相場は最初のローソク足で崩れ、一日中底を探す";
    case "sun":
      return e.up ? "光がチャートを満たし、価格は跳ねて高値を保つ" : "光が消え、価格は落ちてずり下がる";
    case "wheel":
      return "輪がトレンドをひっくり返し、残りの一日は朝と逆に進む";
    case "hanged":
      return "相場は平均線のそばにぶら下がり、急がない";
    case "moon":
      return "霧、ヒゲは2倍の長さ、方向は読みにくい";
    case "death":
      return "古いトレンドが死に、逆符号の新しいトレンドが生まれる";
    case "fool":
      return "指針のない動き、値幅はいつもより広い";
    case "drift":
      return `急な動きのない、なだらかな${upDown(e.up)}向きのドリフト`;
    case "wands":
      return `ワンドが価格を${e.up ? "押し上げる" : "押し下げる"}`;
    case "cups":
      return e.wide ? "カップがローソク足の値幅を引き伸ばす" : "カップがローソク足の値幅を締め付ける";
    case "swords":
      return "ソードがヒゲとダマシで切りつける";
    case "pentacles":
      return "ペンタクルが価格を当日の平均へ引き寄せる";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "跳ね上げ" : "暴落";
    case "sun":
      return e.up ? "跳躍" : "下落";
    case "wheel":
      return "反転";
    case "hanged":
      return "横ばい";
    case "moon":
      return "嵐";
    case "death":
      return "レジーム転換";
    case "fool":
      return "混沌";
    case "drift":
      return `${upDown(e.up)}向きのドリフト`;
    case "wands":
      return `${upDown(e.up)}向きの勢い`;
    case "cups":
      return e.wide ? "長いローソク足" : "短いローソク足";
    case "swords":
      return "スパイク";
    case "pentacles":
      return "平均への回帰";
  }
}

const CLOSING = {
  reversal: ["朝に入った者は、夕方にはカードと言い争う。", "トレンドは昼に符号を変える。カードは警告していた。"],
  flat: ["一日はほぼゼロで終わる。相場は考え中、カードも同じ。", "一日は横ばいに流れる。カードは固執しない。"],
  up: ["引けは高い。カードは理由を言わず、方向だけを言う。", "強気は祝福を受ける。ヒゲは長いまま。"],
  down: [
    "引けは安い。カードは説明しない、カードは示す。",
    "弱気は取り分を得る。カードは記録するだけで、同情はしない。",
  ],
} as const;

export const ja: Dictionary = {
  code: "ja",
  locale: "ja-JP",
  title: "TarotAlpha — タロットで読む相場予測",
  tagline: "ローソク足のリーディング · ",
  theme: { label: "テーマ", light: "ライトテーマ", dark: "ダークテーマ", system: "システムに合わせる" },
  language: { label: "言語" },
  disclaimer: "投資助言ではありません。カードもそう言っています",
  reversed: "逆位置",
  day: (n: number): string => `${String(n)}日目`,
  now: "現在",
  drawStep: (n: number): string => `リーディングを開く · ${String(n)}日目`,
  lockedStep: "2日目まで無料、3日目はペイウォールの先",
  close: "閉じる",
  picker: { choose: "銘柄を選ぶ", placeholder: "ティッカーまたは名前" },
  badAsset: "銘柄は2〜20文字：ラテン文字と数字",
  loading: "ローソク足を読み込み中…",
  per24h: "/ 24時間",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "再試行",
  exchange: {
    unknown_asset: "その銘柄は取引所にありません",
    unavailable: "取引所があなたのネットワークから応答しません",
    too_old: "取引所が返した履歴が不完全です",
  },
  share: {
    button: "共有",
    copy: "リンクをコピー",
    snapshotFailed: "スナップショットに失敗しました。もう一度お試しください",
    tooMany: "リクエストが多すぎます",
    failed: "リンクを作成できません。後でもう一度お試しください",
    copied: "コピーしました",
    selectToCopy: "選択しました — Ctrl+C を押してください",
    title: "リーディングへのリンク",
    lead: "同じローソク足と同じカードで開きます。未来が訪れたら、リンクは予言の検証を表示します。",
  },
  paywall: {
    meditating: "決済モジュールはまだ瞑想中です",
    title: "この先、カードは沈黙します",
    lead: "無料アクセスは2日先まで。3日目とその先は入門者のステータスで開きます。",
    back: "リーディングに戻る",
    tiers: [
      {
        name: "入門者",
        price: "$4.99",
        period: "/月",
        features: ["最大7日先まで", "リーディング履歴", "広告なし（もともとありません）"],
        cta: "選ぶ",
      },
      {
        name: "大アルカナ",
        price: "$19.99",
        period: "/月",
        features: ["入門者の全て", "プレミアムデッキ", "別のデッキによるセカンドオピニオン", "開示時の花火"],
        cta: "選ぶ",
      },
      {
        name: "機関投資家",
        price: "$999",
        period: "/月",
        features: ["APIアクセス", "押印付きPDFレポート", "専属マネージャー"],
        cta: "申し込む",
      },
    ],
  },
  fan: { hint: "3枚引いてください", close: "閉じる" },
  reading: {
    notFound: "リーディングが見つかりません",
    loadFailed: "リーディングを読み込めません",
    ownReading: "自分のリーディング",
    loading: "リーディングを読み込み中…",
    meta: (createdAt: string): string => `作成 ${createdAt}`,
    replaying: "各日について3枚引いてください",
    replay: "リーディングを再生",
    own: "この銘柄で自分のリーディング",
  },
  prophecy: {
    checking: "取引所のローソク足で予言を検証中…",
    notYet: (closesAt: string): string => `未来はまだ来ていません：検証する最初のローソク足は ${closesAt} に確定します`,
    checkFailed: "取引所が応答しないため、予言の検証は延期されました",
    hit: (pct: number): string => `予言は ${String(pct)} % 的中しました`,
    miss: (pct: number): string => `相場は予言を退けました：${String(pct)} %`,
    compared: (n: number, total: number): string => `${String(total)}本中${String(n)}本で`,
    final: "確定",
    interim: "暫定",
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `${String(day)}日目：まだ`
        : `${String(day)}日目：${String(pct)} %（${String(hits)}/${String(compared)}）`,
  },
  summaryTitle: "今日を一行で。",
  how: "計算方法",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${SUITS[card.suit]}の${RANKS[card.rank - 1] ?? ""}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_JA[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? "（逆位置）" : "";
    const when = ["0–8時", "8–16時", "16–24時"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev}が${when}から今日を支配する：${ruling(f.rulingEffect)}。`
      : `今日は大アルカナがなく、日は小アルカナのもの。${f.rulingName}${rev}が${when}に基調を定める：${ruling(f.rulingEffect)}。`;
    const path = `朝は${short(f.effects[0])}、昼は${short(f.effects[1])}、夜は${short(f.effects[2])}。`;
    const number = `当日の引けまでにカードが見るのは ${f.netPct} %（${f.netAtr} ATR）、途中で上に ${f.highPct} %、下に ${f.lowPct} %。`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening}${path}${number}${closing}`;
  },
};

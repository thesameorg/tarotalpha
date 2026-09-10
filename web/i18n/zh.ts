/** Simplified Chinese interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_ZH } from "./meanings-zh";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "愚者",
  "魔术师",
  "女祭司",
  "皇后",
  "皇帝",
  "教皇",
  "恋人",
  "战车",
  "力量",
  "隐士",
  "命运之轮",
  "正义",
  "倒吊人",
  "死神",
  "节制",
  "恶魔",
  "高塔",
  "星星",
  "月亮",
  "太阳",
  "审判",
  "世界",
] as const;

const RANKS = ["王牌", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"] as const;

const SUITS = { wands: "权杖", cups: "圣杯", swords: "宝剑", pentacles: "星币" } as const;

if (MEANINGS_ZH.length !== DECK.length)
  throw new Error(`Chinese meanings cover ${String(MEANINGS_ZH.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "向上" : "向下");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "崩盘取消，价格被抛起并继续上拉" : "市场在第一根蜡烛就下跌，整天寻底";
    case "sun":
      return e.up ? "光芒洒满图表，价格跃起并守住高位" : "光芒熄灭，价格跌落并下滑";
    case "wheel":
      return "命运之轮扭转趋势，余下的一天与早晨相反";
    case "hanged":
      return "市场悬在均线附近，并不着急";
    case "moon":
      return "迷雾，影线长一倍，方向难辨";
    case "death":
      return "旧趋势死去，新趋势以相反的符号诞生";
    case "fool":
      return "漫无方向，振幅大于往常";
    case "drift":
      return `平稳地${upDown(e.up)}漂移，没有急动作`;
    case "wands":
      return `权杖${e.up ? "把价格推高" : "把价格压低"}`;
    case "cups":
      return e.wide ? "圣杯拉长蜡烛的振幅" : "圣杯压缩蜡烛的振幅";
    case "swords":
      return "宝剑以影线和假突破切割";
    case "pentacles":
      return "星币把价格拉向当日均值";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "向上跳" : "崩跌";
    case "sun":
      return e.up ? "跃升" : "下跌";
    case "wheel":
      return "反转";
    case "hanged":
      return "横盘";
    case "moon":
      return "风暴";
    case "death":
      return "体制更替";
    case "fool":
      return "混乱";
    case "drift":
      return `${upDown(e.up)}漂移`;
    case "wands":
      return `${upDown(e.up)}冲击`;
    case "cups":
      return e.wide ? "长蜡烛" : "短蜡烛";
    case "swords":
      return "尖刺";
    case "pentacles":
      return "回归均值";
  }
}

const CLOSING = {
  reversal: ["早上入场的人，到晚上会和牌争辩。", "趋势在午间变号；牌早有提醒。"],
  flat: ["全天收在零附近：市场在思考，牌也在思考。", "一天走成横盘；牌不坚持。"],
  up: ["收盘更高。牌不给理由，只给方向。", "多头得到祝福；影线依旧很长。"],
  down: ["收盘更低。牌不解释，牌只展示。", "空头得到应得的；牌记录，不同情。"],
} as const;

export const zh: Dictionary = {
  code: "zh",
  locale: "zh-CN",
  title: "TarotAlpha — 塔罗牌阵市场预测",
  tagline: "以蜡烛图占卜 · ",
  theme: { label: "主题", light: "浅色主题", dark: "深色主题", system: "跟随系统" },
  language: { label: "语言" },
  disclaimer: "不构成投资建议；牌也这么认为",
  reversed: "逆位",
  day: (n: number): string => `第 ${String(n)} 天`,
  now: "现在",
  drawStep: (n: number): string => `开启牌阵 · 第 ${String(n)} 天`,
  lockedStep: "前两天免费，第三天需付费",
  close: "关闭",
  picker: { choose: "选择标的", placeholder: "代码或名称" },
  badAsset: "标的为 2–20 个字符：拉丁字母和数字",
  loading: "正在加载蜡烛图…",
  per24h: "/ 24小时",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "重试",
  exchange: {
    unknown_asset: "交易所没有这个标的",
    unavailable: "交易所在你的网络无响应",
    too_old: "交易所返回的历史不完整",
  },
  share: {
    button: "分享",
    copy: "复制链接",
    snapshotFailed: "快照失败，请重试",
    tooMany: "请求过多",
    failed: "无法创建链接，请稍后再试",
    copied: "已复制",
    selectToCopy: "已选中 — 请按 Ctrl+C",
    title: "牌阵链接",
    lead: "打开后显示相同的蜡烛图和牌。当未来到来，链接会显示预言验证。",
  },
  paywall: {
    meditating: "支付模块仍在冥想",
    title: "再往后，牌沉默了",
    lead: "免费访问覆盖未来两天。第三天及更远的视野需要入门者身份。",
    back: "返回牌阵",
    tiers: [
      {
        name: "入门者",
        price: "$4.99",
        period: "/月",
        features: ["最多提前 7 天", "牌阵历史", "无广告（本来也没有）"],
        cta: "选择",
      },
      {
        name: "大阿卡纳",
        price: "$19.99",
        period: "/月",
        features: ["入门者的全部", "高级牌组", "另一副牌的第二意见", "揭牌时放烟花"],
        cta: "选择",
      },
      {
        name: "机构版",
        price: "$999",
        period: "/月",
        features: ["API 访问", "带印章的 PDF 报告", "专属经理"],
        cta: "申请",
      },
    ],
  },
  fan: { hint: "抽三张牌", close: "关闭" },
  reading: {
    notFound: "找不到牌阵",
    loadFailed: "无法加载牌阵",
    ownReading: "自己的牌阵",
    loading: "正在加载牌阵…",
    meta: (createdAt: string): string => `创建于 ${createdAt}`,
    replaying: "为每一天抽三张牌",
    replay: "重演牌阵",
    own: "为这个标的开启自己的牌阵",
  },
  prophecy: {
    checking: "正在用交易所的蜡烛图验证预言…",
    notYet: (closesAt: string): string => `未来尚未到来：第一根待验证的蜡烛将于 ${closesAt} 收盘`,
    checkFailed: "交易所无响应，预言验证推迟",
    hit: (pct: number): string => `预言应验了 ${String(pct)} %`,
    miss: (pct: number): string => `市场拒绝了预言：${String(pct)} %`,
    compared: (n: number, total: number): string => `基于 ${String(total)} 根蜡烛中的 ${String(n)} 根`,
    final: "最终",
    interim: "暂时",
    deviation: (value: string): string => `偏差 ${value} ATR`,
    stepLine: (day: number, pct: number | null, hits: number, compared: number): string =>
      pct === null
        ? `第 ${String(day)} 天：尚未到来`
        : `第 ${String(day)} 天：${String(pct)} %（${String(hits)}/${String(compared)}）`,
  },
  summaryTitle: "一句话看今天。",
  how: "计算方法",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${SUITS[card.suit]}${RANKS[card.rank - 1] ?? ""}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_ZH[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? "（逆位）" : "";
    const when = ["0–8 时", "8–16 时", "16–24 时"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${f.rulingName}${rev}从${when}起主宰今天：${ruling(f.rulingEffect)}。`
      : `今天没有大阿卡纳，日子属于小阿卡纳；${f.rulingName}${rev}在${when}定下基调：${ruling(f.rulingEffect)}。`;
    const path = `早上——${short(f.effects[0])}，中午——${short(f.effects[1])}，晚上——${short(f.effects[2])}。`;
    const number = `到当日收盘，牌看到 ${f.netPct} %，途中上探 ${f.highPct} %、下探 ${f.lowPct} %。`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening}${path}${number}${closing}`;
  },
};

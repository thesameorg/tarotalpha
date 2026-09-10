/** Korean interface text, the same shape as ru.ts. Content, not code. */
import type { CardEffect } from "../../engine/card-effect";
import { DECK, type Card } from "../../engine/deck";
import type { Dictionary } from "./index";
import { MEANINGS_KO } from "./meanings-ko";
import { pick, type SummaryFacts } from "./summary-facts";

const MAJORS = [
  "바보",
  "마법사",
  "여사제",
  "여황제",
  "황제",
  "교황",
  "연인",
  "전차",
  "힘",
  "은둔자",
  "운명의 수레바퀴",
  "정의",
  "매달린 남자",
  "죽음",
  "절제",
  "악마",
  "탑",
  "별",
  "달",
  "태양",
  "심판",
  "세계",
] as const;

const RANKS = ["에이스", "2", "3", "4", "5", "6", "7", "8", "9", "10", "페이지", "나이트", "퀸", "킹"] as const;

const SUITS = { wands: "완드", cups: "컵", swords: "소드", pentacles: "펜타클" } as const;

if (MEANINGS_KO.length !== DECK.length)
  throw new Error(`Korean meanings cover ${String(MEANINGS_KO.length)} of ${String(DECK.length)} cards`);

const upDown = (up: boolean): string => (up ? "상승" : "하락");

function ruling(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up
        ? "붕괴는 취소되고, 가격은 위로 던져져 계속 끌어올려진다"
        : "시장은 첫 캔들에서 무너지고 하루 종일 바닥을 찾는다";
    case "sun":
      return e.up ? "빛이 차트를 채우고, 가격은 뛰어올라 높이를 지킨다" : "빛이 꺼지고, 가격은 떨어져 미끄러진다";
    case "wheel":
      return "수레바퀴가 추세를 뒤집고, 남은 하루는 아침과 반대로 간다";
    case "hanged":
      return "시장은 평균선 근처에 매달려 서두르지 않는다";
    case "moon":
      return "안개, 꼬리는 두 배로 길고, 방향은 읽기 어렵다";
    case "death":
      return "옛 추세는 죽고, 반대 부호의 새 추세가 태어난다";
    case "fool":
      return "기준 없는 움직임, 평소보다 넓은 진폭";
    case "drift":
      return `급한 움직임 없는 고른 ${upDown(e.up)} 드리프트`;
    case "wands":
      return `완드가 가격을 ${e.up ? "밀어 올린다" : "눌러 내린다"}`;
    case "cups":
      return e.wide ? "컵이 캔들의 진폭을 늘린다" : "컵이 캔들의 진폭을 조인다";
    case "swords":
      return "소드가 꼬리와 가짜 돌파로 벤다";
    case "pentacles":
      return "펜타클이 가격을 하루 평균으로 끌어당긴다";
  }
}

function short(e: CardEffect): string {
  switch (e.kind) {
    case "tower":
      return e.up ? "위로 튐" : "붕괴";
    case "sun":
      return e.up ? "도약" : "하락";
    case "wheel":
      return "반전";
    case "hanged":
      return "횡보";
    case "moon":
      return "폭풍";
    case "death":
      return "체제 전환";
    case "fool":
      return "혼돈";
    case "drift":
      return `${upDown(e.up)} 드리프트`;
    case "wands":
      return `${upDown(e.up)} 임펄스`;
    case "cups":
      return e.wide ? "긴 캔들" : "짧은 캔들";
    case "swords":
      return "스파이크";
    case "pentacles":
      return "평균 회귀";
  }
}

const CLOSING = {
  reversal: ["아침에 들어온 사람은 저녁에 카드와 다툰다.", "추세는 한낮에 부호를 바꾼다. 카드는 경고했다."],
  flat: [
    "하루는 0 근처에서 끝난다. 시장은 생각 중이고, 카드도 그렇다.",
    "하루는 옆으로 흐른다. 카드는 고집하지 않는다.",
  ],
  up: ["마감은 더 높다. 카드는 이유를 말하지 않고 방향만 말한다.", "황소는 축복을 받는다. 꼬리는 여전히 길다."],
  down: [
    "마감은 더 낮다. 카드는 설명하지 않는다, 카드는 보여준다.",
    "곰은 제 몫을 받는다. 카드는 기록할 뿐, 동정하지 않는다.",
  ],
} as const;

export const ko: Dictionary = {
  code: "ko",
  locale: "ko-KR",
  title: "TarotAlpha — 타로로 읽는 시장 예측",
  tagline: "캔들로 보는 리딩 · ",
  theme: { label: "테마", light: "라이트 테마", dark: "다크 테마", system: "시스템 테마" },
  language: { label: "언어" },
  disclaimer: "투자 조언이 아닙니다. 카드도 그렇게 생각합니다",
  reversed: "역방향",
  day: (n: number): string => `${String(n)}일차`,
  now: "지금",
  drawStep: (n: number): string => `리딩 열기 · ${String(n)}일차`,
  lockedStep: "이틀은 무료, 셋째 날은 페이월 너머",
  close: "닫기",
  picker: { choose: "종목 선택", placeholder: "티커 또는 이름" },
  badAsset: "종목은 2–20자: 라틴 문자와 숫자",
  loading: "캔들을 불러오는 중…",
  per24h: "/ 24시간",
  sources: { binance: "Binance", bybit: "Bybit" } as const,
  retry: "다시 시도",
  exchange: {
    unknown_asset: "거래소에 그런 종목이 없습니다",
    unavailable: "거래소가 당신의 네트워크에서 응답하지 않습니다",
    too_old: "거래소가 불완전한 기록을 반환했습니다",
  },
  share: {
    button: "공유",
    copy: "링크 복사",
    snapshotFailed: "스냅샷을 찍지 못했습니다. 다시 시도하세요",
    tooMany: "요청이 너무 많습니다",
    failed: "링크를 만들지 못했습니다. 나중에 다시 시도하세요",
    copied: "복사됨",
    selectToCopy: "선택됨 — Ctrl+C를 누르세요",
    title: "리딩 링크",
    lead: "같은 캔들과 같은 카드로 열립니다. 미래가 도착하면 링크는 예언 검증을 보여줍니다.",
  },
  paywall: {
    meditating: "결제 모듈은 아직 명상 중입니다",
    title: "여기서부터 카드는 침묵합니다",
    lead: "무료 이용은 이틀 앞까지입니다. 셋째 날과 더 먼 지평은 입문자 등급으로 열립니다.",
    back: "리딩으로 돌아가기",
    tiers: [
      {
        name: "입문자",
        price: "$4.99",
        period: "/월",
        features: ["최대 7일 앞까지", "리딩 기록", "광고 없음 (원래 없습니다)"],
        cta: "선택",
      },
      {
        name: "메이저 아르카나",
        price: "$19.99",
        period: "/월",
        features: ["입문자의 모든 것", "프리미엄 덱", "다른 덱의 두 번째 의견", "공개 시 불꽃놀이"],
        cta: "선택",
      },
      {
        name: "기관용",
        price: "$999",
        period: "/월",
        features: ["API 접근", "인장이 찍힌 PDF 보고서", "전담 매니저"],
        cta: "문의",
      },
    ],
  },
  fan: { hint: "카드 세 장을 뽑으세요", close: "닫기" },
  reading: {
    notFound: "리딩을 찾을 수 없습니다",
    loadFailed: "리딩을 불러오지 못했습니다",
    ownReading: "나만의 리딩",
    loading: "리딩을 불러오는 중…",
    meta: (createdAt: string): string => `생성 ${createdAt}`,
    replaying: "매일 카드 세 장을 뽑으세요",
    replay: "리딩 다시 보기",
    own: "이 종목으로 나만의 리딩",
  },
  prophecy: {
    checking: "거래소 캔들로 예언을 검증하는 중…",
    notYet: (closesAt: string): string => `미래는 아직 오지 않았습니다: 검증할 첫 캔들은 ${closesAt}에 마감됩니다`,
    checkFailed: "거래소가 응답하지 않아 예언 검증이 미뤄졌습니다",
    noCandles: "거래소가 이 구간의 캔들을 주지 않았습니다",
    hit: (pct: number): string => `예언이 ${String(pct)} % 적중했습니다`,
    miss: (pct: number): string => `시장이 예언을 거부했습니다: ${String(pct)} %`,
    final: "최종",
    interim: "중간",
    praise: {
      close: (name: string): string => `${name}: 시장 한복판`,
      near: (name: string): string => `${name}: 시장 가까이`,
      far: (name: string): string => `${name}: 시장에서 멀리`,
    },
    stepLine: (day: number, pct: number | null): string =>
      pct === null ? `${String(day)}일차: 아직` : `${String(day)}일차: ${String(pct)} %`,
  },
  summaryTitle: "한 줄로 보는 오늘.",
  how: "계산 방식",
  cardName: (card: Card): string =>
    card.arcana === "major" ? (MAJORS[card.index] ?? "") : `${SUITS[card.suit]} ${RANKS[card.rank - 1] ?? ""}`,
  meaning: (cardId: number, reversed: boolean): string => {
    const meaning = MEANINGS_KO[cardId];
    if (meaning === undefined) throw new RangeError(`card id ${String(cardId)} has no meaning`);
    return reversed ? meaning[1] : meaning[0];
  },
  summary: (f: SummaryFacts): string => {
    const rev = f.rulingReversed ? " (역방향)" : "";
    const when = ["0–8시", "8–16시", "16–24시"][f.rulingPosition] ?? "";
    const opening = f.rulingMajor
      ? `${when}부터 오늘의 주인은 ${f.rulingName}${rev}: ${ruling(f.rulingEffect)}.`
      : `오늘은 메이저 아르카나 없이 마이너의 날. ${when}의 기조는 ${f.rulingName}${rev}: ${ruling(f.rulingEffect)}.`;
    const path = `아침은 ${short(f.effects[0])}, 낮은 ${short(f.effects[1])}, 저녁은 ${short(f.effects[2])}.`;
    const number = `당일 마감까지 카드가 보는 것은 ${f.netPct} %, 도중에 위로 ${f.highPct} %, 아래로 ${f.lowPct} %.`;
    const closing = pick(CLOSING[f.reversal ? "reversal" : f.direction], f.variant);
    return `${opening} ${path} ${number} ${closing}`;
  },
};

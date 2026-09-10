/** The five readers in Simplified Chinese, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_ZH: Record<ReaderId, ReaderText> = {
  atr: {
    name: "维拉夫人",
    blurb:
      "读盘不绕弯子：这一天惯常的波动幅度有多大，牌就在这个幅度里推着价格走。不讲理论，也不许诺什么——牌桌上最老的一双手。",
  },
  reversion: {
    name: "银莲修女",
    blurb: "相信一切都会回来。她手里的价格被拉向它近来待着的地方，而牌只决定绳子拉得多紧、允许它走开多远。",
  },
  analogy: {
    name: "科菲长老",
    blurb: "这一周他早就见过。他在过去的一周里找出最像最近几个小时的那一段，让它再演一遍——朝着牌指的方向转过去。",
  },
  garch: {
    name: "伊菲妈妈",
    blurb:
      "她说，祸事从不独行。在她手下，一个狂暴的小时会把后面的小时也变得狂暴；而安静的一段会一直安静下去，直到有什么把它打破。",
  },
  fractal: {
    name: "织女",
    blurb:
      "只用一根线和一个数字。数字在中间之上，各段走势彼此附和，价格走得很远；在中间之下，它们互相争辩，一天就走成一把细齿的锯。",
  },
};

/** The five readers in Japanese, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_JA: Record<ReaderId, ReaderText> = {
  atr: {
    name: "ヴェラ夫人",
    blurb:
      "相場を素直に読む。その日のいつもの振れ幅がどれだけあるか、その内側でカードが値を押して回る。理屈もなければ約束もない、この卓でいちばん古い手。",
  },
  reversion: {
    name: "シスター・アネモネ",
    blurb:
      "すべては戻ってくると信じている。彼女の値は、最近ずっと座っていた場所へ引き戻される。カードが決めるのは、綱をどれだけ強く引くか、どこまで離れるのを許すか、それだけ。",
  },
  analogy: {
    name: "コフィ長老",
    blurb:
      "この一週間なら前にも見た。過ぎた一週間の中から、ここ数時間にいちばん似た一続きを探し出し、もう一度なぞらせる。カードの言うほうへ向きを変えて。",
  },
  garch: {
    name: "マザー・イフェ",
    blurb:
      "災いは連れ立って来ると言う。彼女の手にかかれば、荒れた一時間は次の時間まで荒らす。静かな区間は、何かが壊すまで静かなままでいる。",
  },
  fractal: {
    name: "織姫",
    blurb:
      "糸は一本、数はひとつ。真ん中より上なら動きは互いに頷き合い、値は遠くまで行く。下なら言い争い、一日は細かい鋸の刃になる。",
  },
};

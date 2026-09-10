/** The five readers in Korean, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_KO: Record<ReaderId, ReaderText> = {
  atr: {
    name: "베라 부인",
    blurb:
      "시장을 에두르지 않고 읽는다. 그날의 평소 진폭이 얼마나 되든, 카드는 그 안에서 가격을 밀고 다닌다. 이론도 없고 약속도 없는, 이 탁자에서 가장 오래된 손.",
  },
  reversion: {
    name: "아네모네 수녀",
    blurb:
      "모든 것은 되돌아온다고 믿는다. 그녀의 가격은 요즘 머물러 있던 자리로 당겨지고, 카드는 밧줄을 얼마나 세게 당길지, 얼마나 멀리 벗어나도 되는지만 정한다.",
  },
  analogy: {
    name: "콰메 장로",
    blurb:
      "이번 주는 전에도 본 적이 있다. 지난 한 주에서 최근 몇 시간과 가장 닮은 구간을 찾아내 다시 한번 흘러가게 한다 — 카드가 가리키는 쪽으로 방향을 돌려서.",
  },
  garch: {
    name: "이페 어머니",
    blurb:
      "화는 혼자 오지 않는다고 말한다. 그녀의 손에서는 사나운 한 시간이 다음 시간들까지 사납게 만들고, 조용한 구간은 무언가가 깨뜨리기 전까지 조용히 이어진다.",
  },
  fractal: {
    name: "직녀",
    blurb:
      "실 한 오라기와 숫자 하나로 일한다. 가운데보다 위면 움직임들이 서로 맞장구를 치며 가격이 멀리까지 가고, 아래면 서로 다투어 하루가 잔 톱니처럼 나온다.",
  },
};

/** The five readers in Turkish, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_TR: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Vera Hanım",
    blurb:
      "Piyasayı süssüz okur: günün olağan salınımı neyse, kartlar fiyatı onun içinde gezdirir. Ne teori ne söz; masadaki en eski el.",
  },
  reversion: {
    name: "Anemon Abla",
    blurb:
      "Her şeyin geri döndüğüne inanır. Fiyatını son zamanlarda oturduğu yere doğru çeker; kart ise yalnızca ipin ne kadar sıkı çektiğine ve ne kadar uzaklaşmaya izin verildiğine karar verir.",
  },
  analogy: {
    name: "Kofi Dede",
    blurb:
      "Bu haftayı daha önce gördü. Geçen hafta içinde son saatlere en çok benzeyen parçayı bulur ve onu yeniden oynatır, kartlar hangi yöne derse o yöne çevirerek.",
  },
  garch: {
    name: "İfe Ana",
    blurb:
      "Derdin yalnız gelmediğini söyler. Elinin altındaki çalkantılı bir saat, sonraki saatleri de çalkantılı yapar; sakin bir bölüm ise bir şey onu kırana kadar sakin kalır.",
  },
  fractal: {
    name: "Dokumacı",
    blurb:
      "Tek iplik ve tek sayıyla çalışır. Ortanın üstünde hareketler birbiriyle anlaşır ve fiyat uzağa gider; altında tartışırlar ve gün ince bir testere gibi çıkar.",
  },
};

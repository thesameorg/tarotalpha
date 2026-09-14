/**
 * `/r/:id` and its scroll `/s/:id` are the SPA's own index.html with the reading written into `<title>`,
 * `<html lang>` and the `og:*` meta tags, because link-preview crawlers do not run JavaScript; the page then loads
 * the reading through the API like any other view. The two differ only in the title and the canonical link.
 * The language is the share link's `lang` (the author's), else the first Accept-Language entry we
 * have, else English. An unknown id gets index.html untouched and the SPA shows its own "not found" state.
 */
import { isLang, matchLang, type Lang } from "../web/i18n/langs";
import { readingMeta } from "./readings";

interface Meta {
  title: (asset: string, id: string) => string;
  /** The same reading, certified: the scroll's own link deserves its own word in the preview. */
  scroll: (asset: string, id: string) => string;
  description: (steps: number, stamp: string) => string;
}

// Content, not code: the language rule does not apply to these strings.
const META: Record<Lang, Meta> = {
  en: {
    title: (asset, id) => `TarotAlpha · ${asset} · reading ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · scroll ${id}`,
    description: (steps, stamp) => `A ${String(steps)}-day reading from ${stamp} UTC. Not financial advice.`,
  },
  zh: {
    title: (asset, id) => `TarotAlpha · ${asset} · 牌阵 ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · 卷轴 ${id}`,
    description: (steps, stamp) => `自 ${stamp} UTC 起向前 ${String(steps)} 天的塔罗牌阵。不构成投资建议。`,
  },
  es: {
    title: (asset, id) => `TarotAlpha · ${asset} · tirada ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · pergamino ${id}`,
    description: (steps, stamp) =>
      `Tirada a ${String(steps)} ${steps === 1 ? "día" : "días"} desde ${stamp} UTC. No es asesoramiento financiero.`,
  },
  fr: {
    title: (asset, id) => `TarotAlpha · ${asset} · tirage ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · parchemin ${id}`,
    description: (steps, stamp) =>
      `Tirage à ${String(steps)} ${steps === 1 ? "jour" : "jours"} à partir de ${stamp} UTC. Ceci n'est pas un conseil financier.`,
  },
  it: {
    title: (asset, id) => `TarotAlpha · ${asset} · lettura ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · pergamena ${id}`,
    description: (steps, stamp) =>
      `Lettura a ${String(steps)} ${steps === 1 ? "giorno" : "giorni"} da ${stamp} UTC. Non è un consiglio finanziario.`,
  },
  de: {
    title: (asset, id) => `TarotAlpha · ${asset} · Legung ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · Schriftrolle ${id}`,
    description: (steps, stamp) =>
      `Legung ${String(steps)} ${steps === 1 ? "Tag" : "Tage"} voraus ab ${stamp} UTC. Keine Finanzberatung.`,
  },
  tr: {
    title: (asset, id) => `TarotAlpha · ${asset} · açılım ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · tomar ${id}`,
    description: (steps, stamp) =>
      `${stamp} UTC itibarıyla ${String(steps)} gün ilerisi için tarot açılımı. Yatırım tavsiyesi değildir.`,
  },
  pt: {
    title: (asset, id) => `TarotAlpha · ${asset} · leitura ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · pergaminho ${id}`,
    description: (steps, stamp) =>
      `Leitura de ${String(steps)} ${steps === 1 ? "dia" : "dias"} a partir de ${stamp} UTC. Não é aconselhamento financeiro.`,
  },
  ru: {
    title: (asset, id) => `TarotAlpha · ${asset} · расклад ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · свиток ${id}`,
    description: (steps, stamp) =>
      `Расклад на ${String(steps)} дн. вперёд от ${stamp} UTC. Не является финансовой рекомендацией.`,
  },
  ja: {
    title: (asset, id) => `TarotAlpha · ${asset} · リーディング ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · 巻物 ${id}`,
    description: (steps, stamp) =>
      `${stamp} UTC から ${String(steps)} 日先のタロットリーディング。投資助言ではありません。`,
  },
  ko: {
    title: (asset, id) => `TarotAlpha · ${asset} · 리딩 ${id}`,
    scroll: (asset, id) => `TarotAlpha · ${asset} · 두루마리 ${id}`,
    description: (steps, stamp) => `${stamp} UTC부터 ${String(steps)}일 앞을 보는 타로 리딩. 투자 조언이 아닙니다.`,
  },
};

export function readingPage(id: string, request: Request, env: Env): Promise<Response> {
  return page(id, request, env, "r");
}

/** `/s/:id`, the scroll of the same reading: its own title and its own canonical link, the rest is the reading's. */
export function scrollPage(id: string, request: Request, env: Env): Promise<Response> {
  return page(id, request, env, "s");
}

async function page(id: string, request: Request, env: Env, prefix: "r" | "s"): Promise<Response> {
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
  const meta = await readingMeta(env.DB, id);
  if (meta === null) return shell;
  const lang = pickLang(request);
  const words = META[lang];
  const title = prefix === "s" ? words.scroll(meta.asset, id) : words.title(meta.asset, id);
  const description = words.description(meta.steps, utcStamp(meta.anchorTs));
  const url = new URL(`/${prefix}/${id}`, request.url).toString();
  return new HTMLRewriter()
    .on("html", { element: (element) => void element.setAttribute("lang", lang) })
    .on("title", { element: (element) => void element.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: (element) => void element.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (element) => void element.setAttribute("content", description) })
    .on('meta[property="og:url"]', { element: (element) => void element.setAttribute("content", url) })
    .transform(shell);
}

function pickLang(request: Request): Lang {
  const param = new URL(request.url).searchParams.get("lang");
  if (isLang(param)) return param;
  return matchLang((request.headers.get("accept-language") ?? "").split(",")) ?? "en";
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

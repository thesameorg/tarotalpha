/**
 * `/r/:id` is the SPA's own index.html with the reading written into `<title>`, `<html lang>` and the `og:*` meta
 * tags, because link-preview crawlers do not run JavaScript; the page then loads the reading through the API like
 * any other view. The language is the share link's `lang` (the author's), else the first Accept-Language entry we
 * have, else English. An unknown id gets index.html untouched and the SPA shows its own "not found" state.
 */
import { isLang, matchLang, type Lang } from "../web/i18n/langs";
import { readingMeta } from "./readings";

interface Meta {
  title: (asset: string, id: string) => string;
  description: (steps: number, stamp: string) => string;
}

// Content, not code: the language rule does not apply to these strings.
const META: Record<Lang, Meta> = {
  en: {
    title: (asset, id) => `TarotAlpha · ${asset} · reading ${id}`,
    description: (steps, stamp) => `A ${String(steps)}-day reading from ${stamp} UTC. Not financial advice.`,
  },
  zh: {
    title: (asset, id) => `TarotAlpha · ${asset} · 牌阵 ${id}`,
    description: (steps, stamp) => `自 ${stamp} UTC 起向前 ${String(steps)} 天的塔罗牌阵。不构成投资建议。`,
  },
  es: {
    title: (asset, id) => `TarotAlpha · ${asset} · tirada ${id}`,
    description: (steps, stamp) =>
      `Tirada a ${String(steps)} ${steps === 1 ? "día" : "días"} desde ${stamp} UTC. No es asesoramiento financiero.`,
  },
  fr: {
    title: (asset, id) => `TarotAlpha · ${asset} · tirage ${id}`,
    description: (steps, stamp) =>
      `Tirage à ${String(steps)} ${steps === 1 ? "jour" : "jours"} à partir de ${stamp} UTC. Ceci n'est pas un conseil financier.`,
  },
  it: {
    title: (asset, id) => `TarotAlpha · ${asset} · lettura ${id}`,
    description: (steps, stamp) =>
      `Lettura a ${String(steps)} ${steps === 1 ? "giorno" : "giorni"} da ${stamp} UTC. Non è un consiglio finanziario.`,
  },
  de: {
    title: (asset, id) => `TarotAlpha · ${asset} · Legung ${id}`,
    description: (steps, stamp) =>
      `Legung ${String(steps)} ${steps === 1 ? "Tag" : "Tage"} voraus ab ${stamp} UTC. Keine Finanzberatung.`,
  },
  pt: {
    title: (asset, id) => `TarotAlpha · ${asset} · leitura ${id}`,
    description: (steps, stamp) =>
      `Leitura de ${String(steps)} ${steps === 1 ? "dia" : "dias"} a partir de ${stamp} UTC. Não é aconselhamento financeiro.`,
  },
  ru: {
    title: (asset, id) => `TarotAlpha · ${asset} · расклад ${id}`,
    description: (steps, stamp) =>
      `Расклад на ${String(steps)} дн. вперёд от ${stamp} UTC. Не является финансовой рекомендацией.`,
  },
  ja: {
    title: (asset, id) => `TarotAlpha · ${asset} · リーディング ${id}`,
    description: (steps, stamp) =>
      `${stamp} UTC から ${String(steps)} 日先のタロットリーディング。投資助言ではありません。`,
  },
  ko: {
    title: (asset, id) => `TarotAlpha · ${asset} · 리딩 ${id}`,
    description: (steps, stamp) => `${stamp} UTC부터 ${String(steps)}일 앞을 보는 타로 리딩. 투자 조언이 아닙니다.`,
  },
};

export async function readingPage(id: string, request: Request, env: Env): Promise<Response> {
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
  const meta = await readingMeta(env.DB, id);
  if (meta === null) return shell;
  const lang = pickLang(request);
  const title = META[lang].title(meta.asset, id);
  const description = META[lang].description(meta.steps, utcStamp(meta.anchorTs));
  const url = new URL(`/r/${id}`, request.url).toString();
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

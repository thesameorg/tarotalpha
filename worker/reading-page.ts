/**
 * `/r/:id` is the SPA's own index.html with the reading written into `<title>`, `<html lang>` and the `og:*` meta
 * tags, because link-preview crawlers do not run JavaScript; the page then loads the reading through the API like
 * any other view. The language is the share link's `lang` (the author's), else the request's Accept-Language,
 * else English. An unknown id gets index.html untouched and the SPA shows its own "not found" state.
 */
import { readingMeta } from "./readings";

type Lang = "ru" | "en";

const META = {
  ru: {
    title: (asset: string, id: string): string => `TarotAlpha · ${asset} · расклад ${id}`,
    description: (steps: number, stamp: string): string =>
      `Расклад на ${String(steps)} дн. вперёд от ${stamp} UTC. Не является финансовой рекомендацией.`,
  },
  en: {
    title: (asset: string, id: string): string => `TarotAlpha · ${asset} · reading ${id}`,
    description: (steps: number, stamp: string): string =>
      `A ${String(steps)}-day reading from ${stamp} UTC. Not financial advice.`,
  },
} as const;

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
  if (param === "ru" || param === "en") return param;
  const first = (request.headers.get("accept-language") ?? "").split(",")[0] ?? "";
  return first.trim().toLowerCase().startsWith("ru") ? "ru" : "en";
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

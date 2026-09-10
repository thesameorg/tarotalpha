/**
 * `/r/:id` is the SPA's own index.html with the reading written into `<title>` and the `og:*` meta tags, because
 * link-preview crawlers do not run JavaScript; the page then loads the reading through the API like any other view.
 * An unknown id gets index.html untouched and the SPA shows its own "not found" state.
 */
import { readingMeta } from "./readings";

export async function readingPage(id: string, request: Request, env: Env): Promise<Response> {
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
  const meta = await readingMeta(env.DB, id);
  if (meta === null) return shell;
  const title = `TarotAlpha · ${meta.asset} · расклад ${id}`;
  const description = `Расклад на ${String(meta.steps)} дн. вперёд от ${utcStamp(meta.anchorTs)} UTC. Не является финансовой рекомендацией.`;
  const url = new URL(`/r/${id}`, request.url).toString();
  return new HTMLRewriter()
    .on("title", { element: (element) => void element.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: (element) => void element.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (element) => void element.setAttribute("content", description) })
    .on('meta[property="og:url"]', { element: (element) => void element.setAttribute("content", url) })
    .transform(shell);
}

function utcStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

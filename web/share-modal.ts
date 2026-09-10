/** The share dialog: the reading link, copy, and a Telegram share URL. Markup lives in index.html. */
import { copy } from "./copy";
import { toast } from "./toast";

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`share modal: #${id} is missing`);
  return el;
}

function linkField(): HTMLInputElement {
  return byId("sharelink") as HTMLInputElement;
}

export function openShareModal(link: string, asset: string, steps: number): void {
  linkField().value = link;
  const telegram = byId("telegram") as HTMLAnchorElement;
  const text = copy.share.telegramText(asset, steps);
  telegram.href = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  byId("sharemodal").classList.add("on");
}

export function initShareModal(): void {
  const modal = byId("sharemodal");
  const close = (): void => {
    modal.classList.remove("on");
  };
  byId("closeShare").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  byId("copy").addEventListener("click", () => {
    const field = linkField();
    navigator.clipboard
      .writeText(field.value)
      .then(() => {
        toast(copy.share.copied);
      })
      .catch(() => {
        field.select();
        toast(copy.share.selectToCopy);
      });
  });
}

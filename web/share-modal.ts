/**
 * The share dialog: the reading link and one copy button; closes on the corner cross, a click outside or Escape.
 * Inside Telegram the link goes to the client's own "send to" dialog instead, and this one never opens.
 */
import { onLangChange, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { miniAppLink, telegram, telegramShare } from "./telegram";
import { toast } from "./toast";

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`share modal: #${id} is missing`);
  return el;
}

function linkField(): HTMLInputElement {
  return byId("sharelink") as HTMLInputElement;
}

/** Inside Telegram the reading goes as the Mini App itself — a website link takes the reader out of the client —
 * and the website link stays in the same box for everyone who is not there. */
export function shareLink(link: string, readingId?: string): void {
  linkField().value = link;
  const send = byId("share-tg");
  const or = byId("share-or");
  send.hidden = true;
  or.hidden = true;
  byId("sharemodal").classList.add("on");
  // Outside Telegram the button would open nothing, and asking the Worker for a bot name nobody can use is noise.
  if (readingId === undefined || telegram() === null) return;
  void miniAppLink(readingId).then((deepLink) => {
    if (deepLink === null) return;
    send.onclick = () => {
      telegramShare(deepLink);
    };
    send.hidden = false;
    or.hidden = false;
  });
}

export function initShareModal(): void {
  const modal = byId("sharemodal");
  const closeButton = byId("closeShare");
  const copyButton = byId("copy");
  const label = (): void => {
    setIcon(closeButton, icons.close, t().close);
    setIcon(copyButton, icons.copy, t().share.copy);
  };
  label();
  onLangChange(label);
  const close = (): void => {
    modal.classList.remove("on");
  };
  closeButton.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
  copyButton.addEventListener("click", () => {
    const field = linkField();
    navigator.clipboard
      .writeText(field.value)
      .then(() => {
        toast(t().share.copied);
      })
      .catch(() => {
        field.select();
        toast(t().share.selectToCopy);
      });
  });
}

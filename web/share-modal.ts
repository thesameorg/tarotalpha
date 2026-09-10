/** The share dialog: the reading link and one copy button; closes on the corner cross, a click outside or Escape. */
import { copy } from "./copy";
import { icons, setIcon } from "./icons";
import { toast } from "./toast";

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`share modal: #${id} is missing`);
  return el;
}

function linkField(): HTMLInputElement {
  return byId("sharelink") as HTMLInputElement;
}

export function openShareModal(link: string): void {
  linkField().value = link;
  byId("sharemodal").classList.add("on");
}

export function initShareModal(): void {
  const modal = byId("sharemodal");
  const closeButton = byId("closeShare");
  const copyButton = byId("copy");
  setIcon(closeButton, icons.close, copy.close);
  setIcon(copyButton, icons.copy, copy.share.copy);
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
        toast(copy.share.copied);
      })
      .catch(() => {
        field.select();
        toast(copy.share.selectToCopy);
      });
  });
}

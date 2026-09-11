/**
 * The reader at the head of the day tabs: one portrait, her name and who she reads for, and a click opens the
 * profile card, where the paragraph about her, the stars and the other readers live. Once a day of the forecast is
 * open she wears a lock: the forecast is hers to the end. The row repaints on a language switch and on a new choice.
 */
import { icons } from "./icons";
import { t, onLangChange } from "./i18n/index";
import { onReaderChange, reader, readerAvatarUrl, readerLocked } from "./reader-choice";
import { openReaderProfile } from "./reader-profile";

export function initReaderPicker(root: HTMLElement): void {
  const paint = (): void => {
    const id = reader();
    const name = t().readerName(id);
    const locked = readerLocked();
    const title = locked ? t().reader.locked(name) : name;
    root.innerHTML = `<button class="reader${locked ? " locked" : ""}" type="button" aria-haspopup="dialog" title="${title}"><img src="${readerAvatarUrl(id)}" alt=""><span class="reader-text"><b>${name}</b><span>${t().reader.current}</span></span>${locked ? icons.lock : ""}</button>`;
  };
  root.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".reader") !== null) openReaderProfile();
  });
  onReaderChange(paint);
  onLangChange(paint);
  paint();
}

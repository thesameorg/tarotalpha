/**
 * The reader under the chart: one portrait and one name, and a click opens the profile card, where the paragraph
 * about her, the stars and the other readers live. Her name follows the interface language, so the row repaints
 * on a language switch as well as on a new choice.
 */
import { t, onLangChange } from "./i18n/index";
import { onReaderChange, reader, readerAvatarUrl } from "./reader-choice";
import { openReaderProfile } from "./reader-profile";

export function initReaderPicker(root: HTMLElement): void {
  const paint = (): void => {
    const id = reader();
    const name = t().readerName(id);
    root.innerHTML = `<button class="reader" type="button" aria-haspopup="dialog" title="${name}"><img src="${readerAvatarUrl(id)}" alt=""><span class="reader-text"><b>${name}</b></span></button>`;
  };
  root.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".reader") !== null) openReaderProfile();
  });
  onReaderChange(paint);
  onLangChange(paint);
  paint();
}

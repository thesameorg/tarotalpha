/**
 * The reader under the chart: one portrait and one name, and a click opens the profile card, where the mechanic,
 * the stars and the other readers live. Names stay English in every interface language, like the tech panel.
 */
import { onReaderChange, reader, readerAvatarUrl, readerFace } from "./reader-choice";
import { openReaderProfile } from "./reader-profile";

export function initReaderPicker(root: HTMLElement): void {
  const paint = (): void => {
    const face = readerFace(reader());
    root.innerHTML = `<button class="reader" type="button" aria-haspopup="dialog" title="${face.name}"><img src="${readerAvatarUrl(face.id)}" alt=""><span class="reader-text"><b>${face.name}</b></span></button>`;
  };
  root.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".reader") !== null) openReaderProfile();
  });
  onReaderChange(paint);
  paint();
}

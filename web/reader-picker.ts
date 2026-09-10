/**
 * The row of reader portraits next to the draw button: pick one and the same cards are recomputed by its formulas.
 * Names and methods stay English in every interface language, like the tech panel — they name a formula.
 */
import { isReaderId } from "../engine/readers";
import { READER_FACES, reader, readerAvatarUrl, setReader } from "./reader-choice";

export function initReaderPicker(root: HTMLElement): void {
  root.innerHTML = READER_FACES.map(
    (face) =>
      `<button class="reader" type="button" data-reader-pick="${face.id}" aria-pressed="false" title="${face.name} · ${face.method}"><img src="${readerAvatarUrl(face.id)}" alt=""><span class="reader-text"><b>${face.name}</b><i>${face.method}</i></span></button>`,
  ).join("");
  const press = (): void => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-reader-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.readerPick === reader()));
    }
  };
  root.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-reader-pick]") : null;
    if (button !== null && isReaderId(button.dataset.readerPick)) {
      setReader(button.dataset.readerPick);
      press();
    }
  });
  press();
}

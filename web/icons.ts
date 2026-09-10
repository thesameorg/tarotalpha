/** Inline SVG for the standard buttons: 20 px strokes in currentColor. No icon font, no emoji, no glyph arrows. */
const svg = (paths: string, size: number): string =>
  `<svg viewBox="0 0 24 24" width="${String(size)}" height="${String(size)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const icons = {
  share: svg('<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/>', 20),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 20),
  close: svg('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>', 20),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 14),
} as const;

/** Turns a plain button into an icon button: the label goes to assistive tech and to the tooltip. */
export function setIcon(button: HTMLElement, icon: string, label: string): void {
  button.innerHTML = icon;
  button.setAttribute("aria-label", label);
  button.title = label;
}

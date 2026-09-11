/** Inline SVG for the standard buttons: 20 px strokes in currentColor. No icon font, no emoji, no glyph arrows. */
const svg = (paths: string, size: number): string =>
  `<svg viewBox="0 0 24 24" width="${String(size)}" height="${String(size)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const icons = {
  share: svg('<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/>', 20),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 20),
  close: svg('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>', 20),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 14),
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    15,
  ),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', 15),
  monitor: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 15),
  external: svg('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>', 12),
  star: svg('<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>', 14),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', 12),
  history: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V9H9"/><path d="M12 7.5V12l3 2"/>', 15),
} as const;

/** Turns a plain button into an icon button: the label goes to assistive tech and to the tooltip. */
export function setIcon(button: HTMLElement, icon: string, label: string): void {
  button.innerHTML = icon;
  button.setAttribute("aria-label", label);
  button.title = label;
}

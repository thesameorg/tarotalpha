/**
 * The switches in the header: the theme as one button that flips light and dark, and, unless the page is
 * English-only, the language as its code that opens the list of native names. The list closes on a pick, a click
 * outside or Escape; arrows and Enter work too. The system's theme is the default until the first flip, and the
 * three icons of light, dark and system stay on the settings screen inside Telegram.
 */
import { required } from "./dom-lookup";
import { applyStatic, isLang, lang, LANGS, onLangChange, setLang, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { isTheme, onThemeChange, resolvedTheme, setTheme, theme, type Theme } from "./theme";

const THEMES: readonly Theme[] = ["light", "dark", "system"];
const THEME_ICON: Record<Theme, string> = { light: icons.sun, dark: icons.moon, system: icons.monitor };

function themeMarkup(): string {
  const buttons = THEMES.map(
    (name) =>
      `<button type="button" data-theme-pick="${name}" data-i18n="theme.${name}@title;theme.${name}@aria-label" aria-pressed="false">${THEME_ICON[name]}</button>`,
  ).join("");
  return `<div class="seg" role="group" data-i18n="theme.label@aria-label">${buttons}</div>`;
}

function languageMarkup(): string {
  const options = LANGS.map(
    ({ code, name }) =>
      `<li role="option" data-lang-pick="${code}" aria-selected="false"><span class="ticker">${code.toUpperCase()}</span><span class="name">${name}</span></li>`,
  ).join("");
  return `<div class="lang"><button class="lang-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" data-i18n="language.label@aria-label;language.label@title"><span class="lang-code"></span>${icons.chevron}</button><ul class="picker-list lang-list" role="listbox" tabindex="-1" hidden>${options}</ul></div>`;
}

/** The three theme icons appended to `root`, pressed state following every switch wherever it was made. */
export function mountThemeSwitch(root: HTMLElement): void {
  root.insertAdjacentHTML("beforeend", themeMarkup());
  applyStatic(root);
  const press = (): void => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-theme-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.themePick === theme()));
    }
  };
  root.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-theme-pick]") : null;
    if (button !== null && isTheme(button.dataset.themePick)) setTheme(button.dataset.themePick);
  });
  onThemeChange(press);
  press();
}

/** One button: its icon is the theme on screen, a click flips to the other one. */
function mountThemeToggle(root: HTMLElement): void {
  root.insertAdjacentHTML("beforeend", '<button class="theme-toggle" type="button"></button>');
  const button = required(root, ".theme-toggle", HTMLButtonElement);
  const paint = (): void => {
    const shown = resolvedTheme();
    setIcon(button, THEME_ICON[shown], t().theme[shown]);
  };
  button.addEventListener("click", () => {
    setTheme(resolvedTheme() === "dark" ? "light" : "dark");
  });
  onThemeChange(paint);
  onLangChange(paint);
  paint();
}

export function initHeaderControls({ language }: { language: boolean } = { language: true }): void {
  const root = document.getElementById("header-controls");
  if (root === null) return;
  mountThemeToggle(root);
  if (!language) return;
  root.insertAdjacentHTML("beforeend", languageMarkup());
  applyStatic(root);
  initLanguageList(root);
}

function initLanguageList(root: HTMLElement): void {
  const trigger = root.querySelector(".lang-trigger");
  const code = root.querySelector(".lang-code");
  const list = root.querySelector(".lang-list");
  if (!(trigger instanceof HTMLButtonElement) || !(code instanceof HTMLElement) || !(list instanceof HTMLElement))
    return;
  const options = [...list.querySelectorAll<HTMLElement>("[data-lang-pick]")];

  const press = (): void => {
    code.textContent = lang().toUpperCase();
    for (const option of options) option.setAttribute("aria-selected", String(option.dataset.langPick === lang()));
  };
  const open = (): void => {
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    list.focus({ preventScroll: true });
  };
  const close = (): void => {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const pick = (value: unknown): void => {
    if (isLang(value)) setLang(value);
    close();
    press();
  };

  trigger.addEventListener("click", () => {
    if (list.hidden) open();
    else close();
  });
  list.addEventListener("click", (event) => {
    const option = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-lang-pick]") : null;
    if (option !== null) pick(option.dataset.langPick);
  });
  list.addEventListener("keydown", (event) => {
    const index = options.findIndex((option) => option.dataset.langPick === lang());
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length];
      if (next !== undefined) pick(next.dataset.langPick);
      open();
    } else if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
      event.preventDefault();
      close();
      trigger.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!list.hidden && event.target instanceof Node && !root.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !list.hidden) close();
  });
  onLangChange(press);
  press();
}

/** The two switches in the header: theme (light, dark, system) as three icons and language as two labels. */
import { icons } from "./icons";
import { applyStatic, isLang, lang, setLang, type Lang } from "./i18n/index";
import { isTheme, setTheme, theme, type Theme } from "./theme";

const THEMES: readonly Theme[] = ["light", "dark", "system"];
const LANGS: readonly Lang[] = ["ru", "en"];
const THEME_ICON: Record<Theme, string> = { light: icons.sun, dark: icons.moon, system: icons.monitor };

function markup(): string {
  const themes = THEMES.map(
    (name) =>
      `<button type="button" data-theme-pick="${name}" data-i18n="theme.${name}@title;theme.${name}@aria-label" aria-pressed="false">${THEME_ICON[name]}</button>`,
  ).join("");
  const langs = LANGS.map(
    (code) => `<button type="button" data-lang-pick="${code}" aria-pressed="false">${code.toUpperCase()}</button>`,
  ).join("");
  return `<div class="seg" role="group" data-i18n="theme.label@aria-label">${themes}</div><div class="seg" role="group" data-i18n="language.label@aria-label">${langs}</div>`;
}

export function initHeaderControls(): void {
  const root = document.getElementById("header-controls");
  if (root === null) return;
  root.innerHTML = markup();
  applyStatic(root);
  const press = (): void => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-theme-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.themePick === theme()));
    }
    for (const button of root.querySelectorAll<HTMLElement>("[data-lang-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.langPick === lang()));
    }
  };
  root.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button") : null;
    if (button === null) return;
    const pickedTheme = button.dataset.themePick;
    const pickedLang = button.dataset.langPick;
    if (isTheme(pickedTheme)) setTheme(pickedTheme);
    if (isLang(pickedLang)) setLang(pickedLang);
    press();
  });
  press();
}

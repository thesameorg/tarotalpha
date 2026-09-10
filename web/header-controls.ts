/**
 * The two switches in the header: theme (light, dark, system) as three icons, and language as its code that opens
 * the list of ten native names. The list closes on a pick, a click outside or Escape; arrows and Enter work too.
 */
import { required } from "./dom-lookup";
import { applyStatic, isLang, lang, LANGS, onLangChange, setLang } from "./i18n/index";
import { icons } from "./icons";
import { isTheme, setTheme, theme, type Theme } from "./theme";

const THEMES: readonly Theme[] = ["light", "dark", "system"];
const THEME_ICON: Record<Theme, string> = { light: icons.sun, dark: icons.moon, system: icons.monitor };

function markup(): string {
  const themes = THEMES.map(
    (name) =>
      `<button type="button" data-theme-pick="${name}" data-i18n="theme.${name}@title;theme.${name}@aria-label" aria-pressed="false">${THEME_ICON[name]}</button>`,
  ).join("");
  const options = LANGS.map(
    ({ code, name }) =>
      `<li role="option" data-lang-pick="${code}" aria-selected="false"><span class="ticker">${code.toUpperCase()}</span><span class="name">${name}</span></li>`,
  ).join("");
  return `<div class="seg" role="group" data-i18n="theme.label@aria-label">${themes}</div><div class="lang"><button class="lang-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" data-i18n="language.label@aria-label;language.label@title"><span class="lang-code"></span>${icons.chevron}</button><ul class="picker-list lang-list" role="listbox" tabindex="-1" hidden>${options}</ul></div>`;
}

export function initHeaderControls(): void {
  const root = document.getElementById("header-controls");
  if (root === null) return;
  root.innerHTML = markup();
  applyStatic(root);
  const trigger = required(root, ".lang-trigger", HTMLButtonElement);
  const code = required(root, ".lang-code", HTMLElement);
  const list = required(root, ".lang-list", HTMLUListElement);
  const options = [...list.querySelectorAll<HTMLElement>("[data-lang-pick]")];

  const press = (): void => {
    for (const button of root.querySelectorAll<HTMLElement>("[data-theme-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.themePick === theme()));
    }
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

  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const themeButton = target?.closest<HTMLElement>("[data-theme-pick]");
    if (themeButton !== null && themeButton !== undefined && isTheme(themeButton.dataset.themePick)) {
      setTheme(themeButton.dataset.themePick);
      press();
      return;
    }
    if (target?.closest(".lang-trigger") !== null && target?.closest(".lang-trigger") !== undefined) {
      if (list.hidden) open();
      else close();
      return;
    }
    const option = target?.closest<HTMLElement>("[data-lang-pick]");
    if (option !== null && option !== undefined) pick(option.dataset.langPick);
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

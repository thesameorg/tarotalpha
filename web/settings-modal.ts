/**
 * The settings screen inside Telegram, behind the client's own Settings item: the header's theme switch and the
 * languages as a flat list, because the header switches are hidden there. Outside Telegram nothing mounts.
 */
import { mountThemeSwitch } from "./header-controls";
import { isLang, lang, LANGS, onLangChange, setLang, t } from "./i18n/index";
import { icons, setIcon } from "./icons";
import { telegram, telegramSettings } from "./telegram";

function langsMarkup(): string {
  return LANGS.map(
    ({ code, name }) =>
      `<li><button type="button" data-lang-pick="${code}" aria-pressed="false"><span class="ticker">${code.toUpperCase()}</span><span class="name">${name}</span></button></li>`,
  ).join("");
}

export function initSettingsModal(): void {
  if (telegram() === null) return;
  const modal = document.getElementById("settings");
  const corner = document.getElementById("closeSettings");
  const themeRoot = document.getElementById("settings-theme");
  const langs = document.getElementById("settings-langs");
  if (modal === null || corner === null || themeRoot === null || langs === null) return;

  const close = (): void => {
    modal.classList.remove("on");
  };
  const label = (): void => {
    setIcon(corner, icons.close, t().close);
  };
  label();
  onLangChange(label);
  corner.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) close();
  });
  telegramSettings(() => {
    modal.classList.add("on");
  });

  mountThemeSwitch(themeRoot);
  langs.innerHTML = langsMarkup();
  const press = (): void => {
    for (const button of langs.querySelectorAll<HTMLElement>("[data-lang-pick]")) {
      button.setAttribute("aria-pressed", String(button.dataset.langPick === lang()));
    }
  };
  langs.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-lang-pick]") : null;
    if (button !== null && isLang(button.dataset.langPick)) setLang(button.dataset.langPick);
  });
  onLangChange(press);
  press();
}

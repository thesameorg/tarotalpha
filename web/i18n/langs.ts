/**
 * The eleven interface languages: where tarot is popular and divination is not a crime, by the owner's rule of
 * 2026-09-10 — English as the lingua franca, the Latin and Romance markets, German, Turkish (fortune-telling is
 * everyday culture there), Russian, and the three East Asian ones with a living tarot culture. Shared with the
 * Worker for the meta tags of a reading link, so nothing here touches the DOM.
 */
export const LANGS = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
  { code: "tr", name: "Türkçe" },
  { code: "ru", name: "Русский" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

export function isLang(value: unknown): value is Lang {
  return LANGS.some((entry) => entry.code === value);
}

/** The first supported language in a list of BCP 47 tags (Accept-Language entries, navigator.languages), by primary subtag. */
export function matchLang(tags: readonly string[]): Lang | null {
  for (const tag of tags) {
    const primary = (tag.split(";")[0] ?? "").trim().split("-")[0]?.toLowerCase();
    if (isLang(primary)) return primary;
  }
  return null;
}

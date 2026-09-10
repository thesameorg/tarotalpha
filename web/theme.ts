/**
 * Light, dark or the system's, chosen in the header and kept in localStorage. The choice lands as `data-theme` on
 * <html> before the first paint (the inline script in index.html) and again here on every switch; CSS does the
 * rest, and the chart re-reads its colours on `onThemeChange`.
 */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ta.theme";
const listeners = new Set<() => void>();
const dark = window.matchMedia("(prefers-color-scheme: dark)");
let choice: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function theme(): Theme {
  return choice;
}

export function resolvedTheme(): ResolvedTheme {
  if (choice === "system") return dark.matches ? "dark" : "light";
  return choice;
}

export function initTheme(): void {
  const stored = read();
  choice = isTheme(stored) ? stored : "system";
  apply();
  dark.addEventListener("change", () => {
    if (choice === "system") apply();
  });
}

export function setTheme(next: Theme): void {
  choice = next;
  store(next);
  apply();
}

export function onThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(): void {
  document.documentElement.dataset.theme = resolvedTheme();
  for (const listener of listeners) listener();
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(value: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or a full quota: the choice lives until the tab closes.
  }
}

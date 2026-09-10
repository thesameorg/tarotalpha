/** One toast element for the whole page, as in the prototype: the newest message replaces the previous one. */
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(message: string): void {
  const el = document.getElementById("toast");
  if (el === null) return;
  el.textContent = message;
  el.classList.add("on");
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove("on");
  }, 1800);
}

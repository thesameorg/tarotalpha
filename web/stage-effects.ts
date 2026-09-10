/** The loot-box theatre from the prototype: gold ring, flash, stage shake. All of it is CSS; this only retriggers it. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function retrigger(el: HTMLElement | null, className: string): void {
  if (el === null) return;
  el.classList.remove(className);
  el.getBoundingClientRect();
  el.classList.add(className);
}

export function ring(): void {
  retrigger(document.getElementById("ring"), "on");
}

export function flash(): void {
  retrigger(document.getElementById("flash"), "on");
}

export function shake(stage: HTMLElement): void {
  retrigger(stage, "shake");
}

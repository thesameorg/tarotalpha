/** UTC labels for the tech panel only: everything the page itself shows is local, see local-time-format.ts. */
export function utcClock(ms: number): string {
  return `${new Date(ms).toISOString().slice(11, 19)} UTC`;
}

export function utcDateTime(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

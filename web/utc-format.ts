/** Time labels are always UTC: the terminal never shows local time. */
export function utcClock(ms: number): string {
  return `${new Date(ms).toISOString().slice(11, 19)} UTC`;
}

export function utcDateTime(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function utcTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

export function utcMonthDay(ms: number): string {
  return new Date(ms).toISOString().slice(5, 10);
}

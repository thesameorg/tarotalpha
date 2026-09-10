/**
 * Time labels in the viewer's own timezone, in the terminal's fixed-width shape (`2026-09-10 14:05`, `14:05`).
 * Everything the page shows is local; UTC survives only inside the tech panel (`utc-format.ts`).
 */
const pad = (n: number): string => String(n).padStart(2, "0");

export function localTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDateTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${localTime(ms)}`;
}

/** Offset of the viewer's zone at `ms`, in ms: add it to a UTC timestamp to get the same wall clock as "UTC". */
export function localOffsetMs(ms: number): number {
  return -new Date(ms).getTimezoneOffset() * 60_000;
}

/** `UTC+3`, `UTC-5:30`: how the header names the zone the axis is drawn in. */
export function zoneLabel(ms: number): string {
  const minutes = -new Date(ms).getTimezoneOffset();
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const rest = abs % 60;
  return `UTC${sign}${String(Math.floor(abs / 60))}${rest === 0 ? "" : `:${pad(rest)}`}`;
}

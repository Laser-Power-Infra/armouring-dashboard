// Display formats. Business time is IST (md); date-only values are stored at UTC midnight.

const TZ = "Asia/Kolkata";

/** km: 1 decimal on tiles, 2 in tables. */
export const km = (v: number, digits = 1) =>
  v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const int = (v: number) => v.toLocaleString("en-IN");

export const days = (v: number) => (v < 10 ? km(v, 1) : int(Math.round(v)));

/** "Wed 18 Nov" from a YYYY-MM-DD shift day or a date-only Date. */
export function shortDay(d: string | Date) {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "18 Nov" for chart axes. */
export function axisDay(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "18 Nov, 07:30" in IST. */
export function dateTime(d: Date) {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

export function time(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
}

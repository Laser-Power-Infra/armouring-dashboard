// Dates on the cards. A day is yyyy-mm-dd; all arithmetic is in UTC so a server's time zone cannot move a day.
import type { Day } from "./sheet.ts";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const utc = (day: Day) => new Date(`${day}T00:00:00Z`);
export const addDays = (day: Day, n: number): Day => new Date(utc(day).getTime() + n * 86_400_000).toISOString().slice(0, 10);
export const dayIndex = (day: Day, d0: Day) => Math.round((utc(day).getTime() - utc(d0).getTime()) / 86_400_000);

/** "17 Nov" */
export const dMon = (day: Day) => `${utc(day).getUTCDate()} ${MON[utc(day).getUTCMonth()]}`;
/** "Wed 18 Nov" */
export const dddDMon = (day: Day) => `${WEEKDAY[utc(day).getUTCDay()].slice(0, 3)} ${dMon(day)}`;
/** "Tuesday 17 November" */
export const longDay = (day: Day) => `${WEEKDAY[utc(day).getUTCDay()]} ${utc(day).getUTCDate()} ${MONTH[utc(day).getUTCMonth()]}`;
/** "17-Nov-26" */
export const ddMonYy = (day: Day) => `${String(utc(day).getUTCDate()).padStart(2, "0")}-${MON[utc(day).getUTCMonth()]}-${day.slice(2, 4)}`;
/** "17 Nov to 1 Dec 2026" */
export const span = (d0: Day, win: number) => `${dMon(d0)} to ${dMon(addDays(d0, win - 1))} ${addDays(d0, win - 1).slice(0, 4)}`;

export type CalCell = { day: Day; label: string; /** Day number within the card, null outside it. */ index: number | null };

/** Monday-to-Sunday weeks covering the card (build spec 2.3). The month is named on the 1st: "1 Dec". */
export function weeks(d0: Day, win: number): CalCell[][] {
  const first = addDays(d0, -((utc(d0).getUTCDay() + 6) % 7));
  const lastDay = addDays(d0, win - 1);
  const last = addDays(lastDay, (7 - utc(lastDay).getUTCDay()) % 7);
  const out: CalCell[][] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (utc(day).getUTCDay() === 1) out.push([]);
    const i = dayIndex(day, d0);
    const date = utc(day).getUTCDate();
    // Inside the card the 1st carries its month; outside it only the number shows.
    out[out.length - 1].push({ day, label: date === 1 && i >= 0 && i < win ? dMon(day) : String(date), index: i >= 0 && i < win ? i : null });
  }
  return out;
}

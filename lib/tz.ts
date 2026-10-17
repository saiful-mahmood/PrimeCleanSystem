import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";

/**
 * The business runs in one timezone. DECISIONS.md: treated as a constant; the
 * unique index on jobs hardcodes it too. BUSINESS_TZ in env must match.
 */
export const BUSINESS_TZ = "America/New_York";

/** "YYYY-MM-DD" of an instant, in business local time. */
export function localDate(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TZ, "yyyy-MM-dd");
}

/** "HH:mm" of an instant, in business local time. */
export function localTime(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TZ, "HH:mm");
}

/**
 * Combine a local date ("2026-03-08") and local time ("09:00") into the UTC
 * instant for that wall-clock time in the business timezone. DST-safe: 09:00
 * local stays 09:00 local across the March and November changes.
 */
export function localToInstant(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const hh = String(h).padStart(2, "0");
  const mm = String(m ?? 0).padStart(2, "0");
  return fromZonedTime(`${date}T${hh}:${mm}:00`, BUSINESS_TZ);
}

/** The instant at which the given local calendar day starts. */
export function startOfLocalDay(instant: Date): Date {
  const zoned = toZonedTime(instant, BUSINESS_TZ);
  return fromZonedTime(startOfDay(zoned), BUSINESS_TZ);
}

/** [start, end) instants covering the local day that contains `instant`. */
export function localDayRange(instant: Date): { start: Date; end: Date } {
  const start = startOfLocalDay(instant);
  const zonedNext = addDays(toZonedTime(start, BUSINESS_TZ), 1);
  return { start, end: fromZonedTime(zonedNext, BUSINESS_TZ) };
}

/** Today's local date "YYYY-MM-DD". */
export function todayLocal(now: Date = new Date()): string {
  return localDate(now);
}

/** Human display, e.g. "Tue, Mar 10 · 9:00 AM". */
export function formatLocal(instant: Date): string {
  return formatInTimeZone(instant, BUSINESS_TZ, "EEE, MMM d · h:mm a");
}

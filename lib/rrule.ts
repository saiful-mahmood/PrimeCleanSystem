import { RRule, Weekday, type Options } from "rrule";
import { addDays, format, parseISO } from "date-fns";
import { BUSINESS_TZ, localDate, localToInstant } from "@/lib/tz";

/**
 * Recurrence helpers around the `rrule` package.
 *
 * `rrule` has no real timezone support: it iterates in UTC. The trick used
 * throughout is "floating time": we feed it dates whose UTC fields hold the
 * business-local wall clock (09:00 local → 09:00Z), let it do the calendar
 * math, then convert each occurrence's wall clock back to a real instant in
 * BUSINESS_TZ with localToInstant. That keeps a 09:00 series at 09:00 local
 * across both DST changes.
 */

export type SeriesLike = {
  rrule: string;
  start_date: string; // "YYYY-MM-DD" local
  end_date: string | null; // inclusive, local
  start_time: string; // "HH:mm" or "HH:mm:ss" local
};

/** Local calendar date + the series' start time, as a real instant. */
export function seriesInstant(localDay: string, startTime: string): Date {
  return localToInstant(localDay, startTime.slice(0, 5));
}

/** Floating-time Date (UTC fields carry local wall clock) for a local date. */
function floating(localDay: string): Date {
  const d = parseISO(localDay);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
}

/** Back from a floating-time Date to "YYYY-MM-DD". */
function floatingToLocalDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function parseRule(series: SeriesLike): RRule {
  const opts = RRule.parseString(series.rrule);
  opts.dtstart = floating(series.start_date);
  if (series.end_date) {
    // UNTIL in floating time at end of the local day so the end date is inclusive.
    opts.until = new Date(floating(series.end_date).getTime() + 24 * 3600 * 1000 - 1);
  }
  return new RRule(opts);
}

/**
 * Local calendar dates ("YYYY-MM-DD") on which the series occurs, within
 * [fromLocalDate, toLocalDate] inclusive.
 */
export function occurrenceDates(series: SeriesLike, fromLocalDate: string, toLocalDate: string): string[] {
  const rule = parseRule(series);
  const after = new Date(floating(fromLocalDate).getTime() - 1);
  const before = new Date(floating(toLocalDate).getTime() + 24 * 3600 * 1000 - 1);
  return rule.between(after, before, true).map(floatingToLocalDate);
}

/** Instants (UTC Dates) for each occurrence, at the series' local start time. */
export function occurrenceInstants(series: SeriesLike, fromLocalDate: string, toLocalDate: string): Date[] {
  return occurrenceDates(series, fromLocalDate, toLocalDate).map((d) => seriesInstant(d, series.start_time));
}

/** The default generation window: today through 8 weeks out, in local dates. */
export function generationWindow(now: Date = new Date(), weeks = 8): { from: string; to: string } {
  const from = localDate(now);
  const to = format(addDays(parseISO(from), weeks * 7), "yyyy-MM-dd");
  return { from, to };
}

// ---------------------------------------------------------------------------
// Building rules from the form (the UI offers a small, sane subset of RFC 5545)
// ---------------------------------------------------------------------------

export type Frequency = "weekly" | "biweekly" | "every4weeks" | "monthly_day" | "monthly_weekday";
export type WeekdayCode = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export const WEEKDAYS: { code: WeekdayCode; label: string; short: string }[] = [
  { code: "MO", label: "Monday", short: "Mon" },
  { code: "TU", label: "Tuesday", short: "Tue" },
  { code: "WE", label: "Wednesday", short: "Wed" },
  { code: "TH", label: "Thursday", short: "Thu" },
  { code: "FR", label: "Friday", short: "Fri" },
  { code: "SA", label: "Saturday", short: "Sat" },
  { code: "SU", label: "Sunday", short: "Sun" },
];

const WD: Record<WeekdayCode, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

/**
 * Build an RRULE string. `startDate` is used for monthly rules (day of month,
 * or "the Nth weekday") and as a fallback weekday.
 */
export function buildRule(frequency: Frequency, weekdays: WeekdayCode[], startDate: string): string {
  const start = parseISO(startDate);
  const startWd = WEEKDAYS[(start.getDay() + 6) % 7].code; // JS Sunday=0 → our Monday-first list
  const days = (weekdays.length ? weekdays : [startWd]).map((c) => WD[c]);
  let opts: Partial<Options>;
  switch (frequency) {
    case "weekly":
      opts = { freq: RRule.WEEKLY, interval: 1, byweekday: days };
      break;
    case "biweekly":
      opts = { freq: RRule.WEEKLY, interval: 2, byweekday: days };
      break;
    case "every4weeks":
      opts = { freq: RRule.WEEKLY, interval: 4, byweekday: days };
      break;
    case "monthly_day":
      opts = { freq: RRule.MONTHLY, interval: 1, bymonthday: [start.getDate()] };
      break;
    case "monthly_weekday": {
      const nth = Math.ceil(start.getDate() / 7);
      opts = { freq: RRule.MONTHLY, interval: 1, byweekday: [WD[startWd].nth(nth)] };
      break;
    }
  }
  // RRule.optionsToString emits DTSTART when present; we store the rule alone.
  return RRule.optionsToString(opts).replace(/^RRULE:/, "");
}

/** Plain-English summary, e.g. "Every 2 weeks on Tuesday at 9:00 AM". */
export function describeRule(series: SeriesLike): string {
  try {
    const text = parseRule(series).toText();
    const [h, m] = series.start_time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${text.charAt(0).toUpperCase()}${text.slice(1)} at ${hh}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return series.rrule;
  }
}

export { BUSINESS_TZ };

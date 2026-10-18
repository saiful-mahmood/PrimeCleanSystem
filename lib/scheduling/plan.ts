import { occurrenceDates, seriesInstant, type SeriesLike } from "@/lib/rrule";

/**
 * Pure planning step for instance generation: given a series, the local
 * dates that already have a job, and a window, return the instants to insert.
 * The DB's unique index on (series_id, local date) is the real safety net;
 * this just avoids trying to insert rows we already know exist.
 */
export function planInstances(
  series: SeriesLike,
  existingLocalDates: Iterable<string>,
  window: { from: string; to: string },
): { localDate: string; scheduledStart: Date }[] {
  const have = new Set(existingLocalDates);
  return occurrenceDates(series, window.from, window.to)
    .filter((d) => !have.has(d))
    .map((d) => ({ localDate: d, scheduledStart: seriesInstant(d, series.start_time) }));
}

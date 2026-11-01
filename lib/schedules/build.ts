import { addMonths, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TZ, localDate } from "@/lib/tz";
import { formatCents } from "@/lib/money";

/**
 * A cleaner's schedule for one month: what we send them (by PDF, text or,
 * in Session 5, SMS). Never includes lockbox codes or what the client pays.
 */

export type ScheduleVisit = {
  jobId: string;
  scheduledStart: string; // ISO instant
  durationMin: number;
  status: "scheduled" | "confirmed" | "in_progress" | "done" | "cancelled" | "skipped";
  assignmentStatus: "offered" | "accepted" | "declined" | "done" | "no_show" | "cancelled_paid";
  payCents: number;
  clientName: string;
  address: string | null; // street + city, no codes
  accessNotes: string | null;
  serviceName: string;
  notes: string | null;
};

export type ScheduleDay = { date: string; label: string; visits: ScheduleVisit[] };

export type MonthlySchedule = {
  providerName: string;
  month: string; // YYYY-MM
  monthLabel: string; // "November 2026"
  days: ScheduleDay[];
  visitCount: number;
  totalMinutes: number;
  totalPayCents: number;
  cancelledCount: number;
};

export function monthBounds(month: string): { start: string; end: string; prev: string; next: string; label: string } {
  const first = parseISO(`${month}-01`);
  return {
    start: format(first, "yyyy-MM-dd"),
    end: format(addMonths(first, 1), "yyyy-MM-dd"), // exclusive
    prev: format(addMonths(first, -1), "yyyy-MM"),
    next: format(addMonths(first, 1), "yyyy-MM"),
    label: format(first, "MMMM yyyy"),
  };
}

/** Group visits by local day, skipping cancelled/skipped from the totals but listing them struck through. */
export function buildMonthlySchedule(providerName: string, month: string, visits: ScheduleVisit[]): MonthlySchedule {
  const byDay = new Map<string, ScheduleVisit[]>();
  for (const v of [...visits].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))) {
    const d = localDate(new Date(v.scheduledStart));
    byDay.set(d, [...(byDay.get(d) ?? []), v]);
  }
  const days: ScheduleDay[] = [...byDay.entries()].map(([date, vs]) => ({
    date,
    label: format(parseISO(date), "EEEE, MMMM d"),
    visits: vs,
  }));
  const active = visits.filter((v) => v.status !== "cancelled" && v.status !== "skipped");
  return {
    providerName,
    month,
    monthLabel: monthBounds(month).label,
    days,
    visitCount: active.length,
    totalMinutes: active.reduce((s, v) => s + v.durationMin, 0),
    totalPayCents: active.reduce((s, v) => s + v.payCents, 0),
    cancelledCount: visits.length - active.length,
  };
}

export function timeRange(v: ScheduleVisit): string {
  const start = new Date(v.scheduledStart);
  const end = new Date(start.getTime() + v.durationMin * 60_000);
  return `${formatInTimeZone(start, BUSINESS_TZ, "h:mm a")}–${formatInTimeZone(end, BUSINESS_TZ, "h:mm a")}`;
}

export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Plain text for pasting into a message. */
export function scheduleAsText(s: MonthlySchedule, opts: { includePay?: boolean } = {}): string {
  const includePay = opts.includePay ?? true;
  const lines: string[] = [];
  lines.push(`${s.providerName} — ${s.monthLabel}`);
  lines.push(
    `${s.visitCount} visit${s.visitCount === 1 ? "" : "s"} · ${hoursLabel(s.totalMinutes)}${includePay ? ` · ${formatCents(s.totalPayCents)}` : ""}`,
  );
  lines.push("");
  for (const day of s.days) {
    lines.push(day.label);
    for (const v of day.visits) {
      const cancelled = v.status === "cancelled" || v.status === "skipped";
      const parts = [
        timeRange(v),
        v.clientName,
        v.address,
        v.serviceName,
        includePay ? formatCents(v.payCents) : null,
      ].filter(Boolean);
      lines.push(`  ${cancelled ? "(cancelled) " : ""}${parts.join(" · ")}`);
      if (v.accessNotes) lines.push(`    Access: ${v.accessNotes}`);
      if (v.notes) lines.push(`    Note: ${v.notes}`);
    }
    lines.push("");
  }
  if (s.days.length === 0) lines.push("No visits this month.");
  return lines.join("\n").trimEnd() + "\n";
}

export type GridCell = { date: string; dayOfMonth: number; inMonth: boolean; visits: ScheduleVisit[] };

/** Weeks (Monday-first) covering the month, each cell with that day's visits. */
export function monthGrid(s: MonthlySchedule): GridCell[][] {
  const { start, end } = monthBounds(s.month);
  const byDate = new Map(s.days.map((d) => [d.date, d.visits]));
  const first = parseISO(start);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // back to Monday
  const weeks: GridCell[][] = [];
  const cursor = new Date(gridStart);
  const endDate = parseISO(end); // exclusive
  while (cursor < endDate || weeks.length === 0 || weeks[weeks.length - 1].length < 7) {
    const date = format(cursor, "yyyy-MM-dd");
    const cell: GridCell = {
      date,
      dayOfMonth: cursor.getDate(),
      inMonth: date >= start && date < end,
      visits: byDate.get(date) ?? [],
    };
    if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
    weeks[weeks.length - 1].push(cell);
    cursor.setDate(cursor.getDate() + 1);
    if (cursor >= endDate && weeks[weeks.length - 1].length === 7) break;
  }
  return weeks;
}

/** "9am" / "2:30pm", for tight calendar cells. */
export function shortTime(iso: string): string {
  const t = formatInTimeZone(new Date(iso), BUSINESS_TZ, "h:mma").toLowerCase();
  return t.replace(":00", "");
}

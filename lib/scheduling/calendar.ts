import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type CalendarView = "week" | "month";

/** Local date range shown for a view anchored on `date` ("YYYY-MM-DD"). Weeks start Monday. */
export function calendarRange(view: CalendarView, date: string): { start: string; end: string; days: string[] } {
  const anchor = parseISO(date);
  let start: Date;
  let end: Date;
  if (view === "week") {
    start = startOfWeek(anchor, { weekStartsOn: 1 });
    end = addDays(start, 6);
  } else {
    start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const last = endOfMonth(anchor);
    end = addDays(startOfWeek(last, { weekStartsOn: 1 }), 6);
  }
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(format(d, "yyyy-MM-dd"));
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), days };
}

export function shiftAnchor(view: CalendarView, date: string, direction: -1 | 1): string {
  const anchor = parseISO(date);
  return format(view === "week" ? addDays(anchor, 7 * direction) : addMonths(anchor, direction), "yyyy-MM-dd");
}

export function rangeTitle(view: CalendarView, date: string, range: { start: string; end: string }): string {
  if (view === "month") return format(parseISO(date), "MMMM yyyy");
  const s = parseISO(range.start);
  const e = parseISO(range.end);
  return s.getMonth() === e.getMonth()
    ? `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
    : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
}

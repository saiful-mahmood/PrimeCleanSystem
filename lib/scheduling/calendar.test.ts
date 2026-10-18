import { describe, expect, it } from "vitest";
import { calendarRange, rangeTitle, shiftAnchor } from "./calendar";

describe("calendarRange", () => {
  it("week runs Monday to Sunday around the anchor", () => {
    const r = calendarRange("week", "2026-03-11"); // a Wednesday
    expect(r.start).toBe("2026-03-09");
    expect(r.end).toBe("2026-03-15");
    expect(r.days).toHaveLength(7);
  });
  it("month pads to full weeks", () => {
    const r = calendarRange("month", "2026-03-15"); // March 2026 starts on a Sunday
    expect(r.start).toBe("2026-02-23");
    expect(r.end).toBe("2026-04-05");
    expect(r.days.length % 7).toBe(0);
  });
  it("shifts by a week or a month", () => {
    expect(shiftAnchor("week", "2026-03-11", 1)).toBe("2026-03-18");
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-28");
  });
  it("titles", () => {
    expect(rangeTitle("month", "2026-03-15", calendarRange("month", "2026-03-15"))).toBe("March 2026");
    expect(rangeTitle("week", "2026-03-11", calendarRange("week", "2026-03-11"))).toBe("Mar 9 – 15, 2026");
    expect(rangeTitle("week", "2026-03-31", calendarRange("week", "2026-03-31"))).toBe("Mar 30 – Apr 5, 2026");
  });
});

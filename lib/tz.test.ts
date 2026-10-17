import { describe, expect, it } from "vitest";
import { localDate, localDayRange, localTime, localToInstant, startOfLocalDay } from "./tz";

describe("localToInstant", () => {
  it("is 09:00 local in winter (EST, UTC-5)", () => {
    expect(localToInstant("2026-01-15", "09:00").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });
  it("is 09:00 local in summer (EDT, UTC-4)", () => {
    expect(localToInstant("2026-07-15", "09:00").toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });
  it("stays 09:00 local across the March DST change", () => {
    // DST starts 2026-03-08 in the US.
    expect(localTime(localToInstant("2026-03-07", "09:00"))).toBe("09:00");
    expect(localTime(localToInstant("2026-03-08", "09:00"))).toBe("09:00");
    expect(localTime(localToInstant("2026-03-09", "09:00"))).toBe("09:00");
  });
  it("stays 09:00 local across the November DST change", () => {
    // DST ends 2026-11-01 in the US.
    expect(localTime(localToInstant("2026-10-31", "09:00"))).toBe("09:00");
    expect(localTime(localToInstant("2026-11-01", "09:00"))).toBe("09:00");
    expect(localTime(localToInstant("2026-11-02", "09:00"))).toBe("09:00");
  });
  it("round-trips through localDate", () => {
    expect(localDate(localToInstant("2026-11-01", "23:30"))).toBe("2026-11-01");
    expect(localDate(localToInstant("2026-11-01", "00:15"))).toBe("2026-11-01");
  });
});

describe("local day boundaries", () => {
  it("late-evening local time is still the same local date, not the next UTC date", () => {
    const instant = localToInstant("2026-06-10", "22:00"); // 02:00Z next day
    expect(instant.toISOString()).toBe("2026-06-11T02:00:00.000Z");
    expect(localDate(instant)).toBe("2026-06-10");
  });
  it("startOfLocalDay and localDayRange", () => {
    const instant = localToInstant("2026-06-10", "22:00");
    expect(startOfLocalDay(instant).toISOString()).toBe("2026-06-10T04:00:00.000Z");
    const { start, end } = localDayRange(instant);
    expect(start.toISOString()).toBe("2026-06-10T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-11T04:00:00.000Z");
  });
  it("the day DST ends is 25 hours long", () => {
    const { start, end } = localDayRange(localToInstant("2026-11-01", "12:00"));
    expect((end.getTime() - start.getTime()) / 3600000).toBe(25);
  });
});

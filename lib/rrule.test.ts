import { describe, expect, it } from "vitest";
import { buildRule, describeRule, generationWindow, occurrenceDates, occurrenceInstants } from "./rrule";
import { localTime } from "./tz";

const weeklyTue = {
  rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
  start_date: "2026-02-24",
  end_date: null,
  start_time: "09:00:00",
};

describe("occurrenceDates", () => {
  it("weekly on Tuesday", () => {
    expect(occurrenceDates(weeklyTue, "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
      "2026-03-24",
      "2026-03-31",
    ]);
  });

  it("biweekly anchors on the start date, not the window", () => {
    const s = { ...weeklyTue, rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", start_date: "2026-02-24" };
    // 2/24, 3/10, 3/24, 4/7 ...
    expect(occurrenceDates(s, "2026-03-01", "2026-04-10")).toEqual(["2026-03-10", "2026-03-24", "2026-04-07"]);
  });

  it("monthly on a day of month", () => {
    const s = { ...weeklyTue, rrule: "FREQ=MONTHLY;BYMONTHDAY=15", start_date: "2026-01-15" };
    expect(occurrenceDates(s, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("monthly on the second Tuesday", () => {
    const s = { ...weeklyTue, rrule: "FREQ=MONTHLY;BYDAY=+2TU", start_date: "2026-01-13" };
    expect(occurrenceDates(s, "2026-01-01", "2026-03-31")).toEqual(["2026-01-13", "2026-02-10", "2026-03-10"]);
  });

  it("respects start_date and an inclusive end_date", () => {
    const s = { ...weeklyTue, start_date: "2026-03-10", end_date: "2026-03-24" };
    expect(occurrenceDates(s, "2026-01-01", "2026-12-31")).toEqual(["2026-03-10", "2026-03-17", "2026-03-24"]);
  });

  it("window bounds are inclusive", () => {
    expect(occurrenceDates(weeklyTue, "2026-03-03", "2026-03-10")).toEqual(["2026-03-03", "2026-03-10"]);
  });
});

describe("occurrenceInstants across DST", () => {
  it("a 09:00 series stays at 09:00 local through the March change", () => {
    const s = { ...weeklyTue, rrule: "FREQ=DAILY", start_date: "2026-03-06" };
    const times = occurrenceInstants(s, "2026-03-06", "2026-03-10").map(localTime);
    expect(times).toEqual(["09:00", "09:00", "09:00", "09:00", "09:00"]);
    const utc = occurrenceInstants(s, "2026-03-07", "2026-03-08").map((d) => d.toISOString());
    expect(utc).toEqual(["2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z"]);
  });

  it("and through the November change", () => {
    const s = { ...weeklyTue, rrule: "FREQ=DAILY", start_date: "2026-10-30" };
    const times = occurrenceInstants(s, "2026-10-30", "2026-11-03").map(localTime);
    expect(times).toEqual(["09:00", "09:00", "09:00", "09:00", "09:00"]);
    const utc = occurrenceInstants(s, "2026-10-31", "2026-11-01").map((d) => d.toISOString());
    expect(utc).toEqual(["2026-10-31T13:00:00.000Z", "2026-11-01T14:00:00.000Z"]);
  });
});

describe("buildRule", () => {
  it("weekly / biweekly with explicit days", () => {
    expect(buildRule("weekly", ["TU", "TH"], "2026-03-03")).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH");
    expect(buildRule("biweekly", ["TU"], "2026-03-03")).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU");
  });
  it("falls back to the start date's weekday", () => {
    expect(buildRule("weekly", [], "2026-03-04")).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE");
  });
  it("monthly variants from the start date", () => {
    expect(buildRule("monthly_day", [], "2026-03-15")).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15");
    expect(buildRule("monthly_weekday", [], "2026-03-10")).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=+2TU");
  });
  it("round-trips through occurrenceDates", () => {
    const rule = buildRule("biweekly", ["TU"], "2026-03-03");
    const s = { rrule: rule, start_date: "2026-03-03", end_date: null, start_time: "09:00" };
    expect(occurrenceDates(s, "2026-03-01", "2026-03-31")).toEqual(["2026-03-03", "2026-03-17", "2026-03-31"]);
  });
});

describe("describeRule and generationWindow", () => {
  it("describes in plain English with the time", () => {
    expect(describeRule({ ...weeklyTue, rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" })).toBe(
      "Every 2 weeks on Tuesday at 9:00 AM",
    );
    expect(describeRule({ ...weeklyTue, start_time: "14:30:00" })).toBe("Every week on Tuesday at 2:30 PM");
  });
  it("window is 8 weeks of local dates", () => {
    // 2026-06-10 22:00 local is 2026-06-11 02:00Z; the window must start on the local date.
    expect(generationWindow(new Date("2026-06-11T02:00:00Z"))).toEqual({ from: "2026-06-10", to: "2026-08-05" });
  });
});

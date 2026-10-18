import { describe, expect, it } from "vitest";
import { planInstances } from "./plan";
import { localDate } from "@/lib/tz";

const biweekly = {
  rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
  start_date: "2026-03-03",
  end_date: null,
  start_time: "09:00:00",
};
const window = { from: "2026-03-01", to: "2026-04-26" }; // 8 weeks

describe("planInstances", () => {
  it("plans every occurrence when nothing exists", () => {
    const plan = planInstances(biweekly, [], window);
    expect(plan.map((p) => p.localDate)).toEqual(["2026-03-03", "2026-03-17", "2026-03-31", "2026-04-14"]);
    expect(plan.every((p) => localDate(p.scheduledStart) === p.localDate)).toBe(true);
  });

  it("regenerating does not duplicate: existing dates are skipped", () => {
    const first = planInstances(biweekly, [], window);
    const second = planInstances(
      biweekly,
      first.map((p) => p.localDate),
      window,
    );
    expect(second).toEqual([]);
  });

  it("a skipped or cancelled instance still holds its slot", () => {
    // The caller passes every job's local date regardless of status.
    const plan = planInstances(biweekly, ["2026-03-17"], window);
    expect(plan.map((p) => p.localDate)).toEqual(["2026-03-03", "2026-03-31", "2026-04-14"]);
  });

  it("a rolling window adds only the new tail", () => {
    const later = { from: "2026-03-20", to: "2026-05-15" };
    const plan = planInstances(biweekly, ["2026-03-03", "2026-03-17", "2026-03-31", "2026-04-14"], later);
    expect(plan.map((p) => p.localDate)).toEqual(["2026-04-28", "2026-05-12"]);
  });
});

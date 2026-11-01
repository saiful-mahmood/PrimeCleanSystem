import { describe, expect, it } from "vitest";
import { buildMonthlySchedule, hoursLabel, monthBounds, scheduleAsText, type ScheduleVisit } from "./build";

const visit = (over: Partial<ScheduleVisit>): ScheduleVisit => ({
  jobId: "j",
  scheduledStart: "2026-11-03T14:00:00.000Z", // 9:00 EST
  durationMin: 120,
  status: "scheduled",
  assignmentStatus: "accepted",
  payCents: 16500,
  clientName: "Sharon ICNE",
  address: "12 Main St, Sharon",
  accessNotes: null,
  serviceName: "Regular Cleaning",
  notes: null,
  ...over,
});

describe("monthBounds", () => {
  it("gives exclusive end, neighbours and a label", () => {
    expect(monthBounds("2026-11")).toEqual({
      start: "2026-11-01",
      end: "2026-12-01",
      prev: "2026-10",
      next: "2026-12",
      label: "November 2026",
    });
  });
});

describe("buildMonthlySchedule", () => {
  it("groups by local day in order and totals active visits only", () => {
    const s = buildMonthlySchedule("Luciane", "2026-11", [
      visit({ jobId: "b", scheduledStart: "2026-11-05T14:00:00.000Z" }),
      visit({ jobId: "a" }),
      visit({ jobId: "c", scheduledStart: "2026-11-05T18:00:00.000Z", durationMin: 60, payCents: 9000 }),
      visit({ jobId: "x", scheduledStart: "2026-11-10T14:00:00.000Z", status: "cancelled" }),
    ]);
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-03", "2026-11-05", "2026-11-10"]);
    expect(s.days[1].visits.map((v) => v.jobId)).toEqual(["b", "c"]);
    expect(s.visitCount).toBe(3);
    expect(s.totalMinutes).toBe(300);
    expect(s.totalPayCents).toBe(42000);
    expect(s.cancelledCount).toBe(1);
    expect(s.monthLabel).toBe("November 2026");
  });
  it("late-evening visits stay on their local day", () => {
    const s = buildMonthlySchedule("L", "2026-11", [visit({ scheduledStart: "2026-11-04T03:30:00.000Z" })]); // 10:30pm Nov 3 EST
    expect(s.days[0].date).toBe("2026-11-03");
  });
});

describe("scheduleAsText", () => {
  it("renders a pasteable summary", () => {
    const s = buildMonthlySchedule("Luciane", "2026-11", [
      visit({ accessNotes: "Key under mat" }),
      visit({ jobId: "x", scheduledStart: "2026-11-10T14:00:00.000Z", status: "cancelled" }),
    ]);
    const text = scheduleAsText(s);
    expect(text).toContain("Luciane — November 2026");
    expect(text).toContain("1 visit · 2h · $165.00");
    expect(text).toContain("Tuesday, November 3");
    expect(text).toContain("9:00 AM–11:00 AM · Sharon ICNE · 12 Main St, Sharon · Regular Cleaning · $165.00");
    expect(text).toContain("Access: Key under mat");
    expect(text).toContain("(cancelled) ");
    expect(scheduleAsText(s, { includePay: false })).not.toContain("$165");
  });
  it("hours label", () => {
    expect(hoursLabel(90)).toBe("1h 30m");
    expect(hoursLabel(120)).toBe("2h");
  });
});

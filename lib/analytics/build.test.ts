import { describe, expect, it } from "vitest";
import { availableYears, buildAnalytics, parsePeriod, periodBounds, type JobInput, type MonthInput } from "./build";

const now = new Date("2026-11-03T15:00:00Z");

const month = (m: string, over: Partial<MonthInput> = {}): MonthInput => ({
  month: `${m}-01`,
  charged_cents: 100000,
  provider_payment_cents: 60000,
  stripe_fee_cents: 1000,
  overhead_expense_cents: 5000,
  ad_expense_cents: 2000,
  total_profit_cents: 32000,
  ...over,
});

const job = (over: Partial<JobInput>): JobInput => ({
  job_id: "j",
  scheduled_start: "2026-10-05T13:00:00Z",
  status: "done",
  charge_cents: 20000,
  fee_cents: 0,
  provider_pay_cents: 15000,
  client_id: "c1",
  client_name: "Maliha House",
  client_type: "residential",
  service_name: "Regular Cleaning",
  ...over,
});

describe("periods", () => {
  it("parses and bounds", () => {
    expect(parsePeriod("2025")).toEqual({ kind: "year", year: 2025 });
    expect(parsePeriod("junk", now)).toEqual({ kind: "year", year: 2026 });
    expect(periodBounds({ kind: "year", year: 2025 })).toMatchObject({ start: "2025-01-01", end: "2026-01-01" });
    expect(periodBounds({ kind: "last12" }, now)).toMatchObject({ start: "2025-12-01", end: "2026-12-01" });
    expect(periodBounds({ kind: "all" }).start).toBeNull();
  });
  it("lists years with data plus the current one", () => {
    expect(availableYears([{ month: "2024-07-01" }, { month: "2025-03-01" }], now)).toEqual([2026, 2025, 2024]);
  });
});

describe("buildAnalytics", () => {
  const input = {
    months: [
      month("2025-12"),
      month("2026-01"),
      month("2026-10", { charged_cents: 50000, total_profit_cents: -18000 }),
    ],
    jobs: [
      job({}),
      job({
        job_id: "j2",
        client_id: "c2",
        client_name: "Epiphany",
        client_type: "commercial",
        service_name: "Commercial",
        charge_cents: 30000,
        provider_pay_cents: 20000,
      }),
      job({ job_id: "j3", status: "cancelled" }),
      job({ job_id: "j4", scheduled_start: "2025-12-20T13:00:00Z" }),
    ],
    expenses: [
      { paid_at: "2026-01-10", category: "software", amount_cents: 3000 },
      { paid_at: "2026-01-12", category: "ads", amount_cents: 2000 },
      { paid_at: "2025-12-12", category: "ads", amount_cents: 9000 },
    ],
    pay: [
      { provider_name: "Claudia", pay_cents: 15000 },
      { provider_name: "Pedro", pay_cents: 20000 },
    ],
  };

  it("fills every month of a year and totals the range", () => {
    const a = buildAnalytics(input, { kind: "year", year: 2026 }, now);
    expect(a.months.length).toBe(12);
    expect(a.months[0]).toMatchObject({ month: "2026-01", label: "Jan 26", revenue: 100000, profit: 32000 });
    expect(a.months[1]).toMatchObject({ month: "2026-02", revenue: 0, profit: 0 });
    expect(a.summary.revenue).toBe(150000);
    expect(a.summary.profit).toBe(14000);
    expect(a.summary.marginPct).toBe(9.3);
    expect(a.summary.visits).toBe(2); // cancelled and 2025 visits excluded
    expect(a.summary.clients).toBe(2);
    expect(a.summary.avgTicket).toBe(75000);
  });

  it("ranks expenses, services, clients and types within the range", () => {
    const a = buildAnalytics(input, { kind: "year", year: 2026 }, now);
    expect(a.expensesByCategory).toEqual([
      { key: "software", name: "Software", value: 3000 },
      { key: "ads", name: "Advertising", value: 2000 },
    ]);
    expect(a.revenueByService.map((s) => [s.name, s.value, s.profit])).toEqual([
      ["Commercial", 30000, 10000],
      ["Regular Cleaning", 20000, 5000],
    ]);
    expect(a.topClients[0]).toMatchObject({ name: "Epiphany", value: 30000, visits: 1 });
    expect(a.byClientType.map((t) => [t.key, t.revenue])).toEqual([
      ["commercial", 30000],
      ["residential", 20000],
    ]);
    expect(a.payByCleaner.map((p) => p.name)).toEqual(["Pedro", "Claudia"]);
  });

  it("all time spans from the first month with data to the last", () => {
    const a = buildAnalytics(input, { kind: "all" }, now);
    expect(a.months[0].month).toBe("2025-12");
    expect(a.months[a.months.length - 1].month).toBe("2026-10");
    expect(a.months.length).toBe(11);
    expect(a.summary.visits).toBe(3);
  });
});

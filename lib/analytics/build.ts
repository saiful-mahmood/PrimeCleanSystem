import { addMonths, format, parseISO } from "date-fns";
import { localDate } from "@/lib/tz";

/**
 * Pure shaping of the numbers behind the Analytics tab. Everything is integer
 * cents; the charts format to dollars at render time. Visits are counted by
 * their cleaning date (like the P&L by job) and include scheduled ones, so
 * the current month shows what is booked, not only what has happened.
 */

export type Period = { kind: "year"; year: number } | { kind: "last12" } | { kind: "all" };

export type MonthInput = {
  month: string; // YYYY-MM-DD (first of month)
  charged_cents: number | null;
  provider_payment_cents: number | null;
  stripe_fee_cents: number | null;
  overhead_expense_cents: number | null;
  ad_expense_cents: number | null;
  total_profit_cents: number | null;
};

export type JobInput = {
  job_id: string;
  scheduled_start: string;
  status: "scheduled" | "confirmed" | "in_progress" | "done" | "cancelled" | "skipped";
  charge_cents: number;
  fee_cents: number;
  provider_pay_cents: number;
  client_id: string;
  client_name: string;
  client_type: "residential" | "commercial";
  service_name: string;
};

export type ExpenseInput = { paid_at: string; category: string; amount_cents: number };

export type PayInput = { provider_name: string; pay_cents: number };

export type MonthPoint = {
  month: string; // YYYY-MM
  label: string; // "Jan 26"
  revenue: number;
  cleanerPay: number;
  fees: number;
  expenses: number; // overhead + ads
  profit: number;
};

export type RankedBar = { key: string; name: string; value: number; visits?: number; profit?: number };

export type Analytics = {
  periodLabel: string;
  months: MonthPoint[];
  summary: {
    revenue: number;
    cleanerPay: number;
    fees: number;
    expenses: number;
    profit: number;
    marginPct: number | null;
    visits: number;
    clients: number;
    avgTicket: number;
  };
  expensesByCategory: RankedBar[];
  revenueByService: RankedBar[];
  topClients: RankedBar[];
  byClientType: { key: string; name: string; revenue: number; profit: number; visits: number }[];
  payByCleaner: RankedBar[];
};

export const CATEGORY_LABEL: Record<string, string> = {
  overhead: "Overhead",
  software: "Software",
  ads: "Advertising",
  supplies: "Supplies",
  insurance: "Insurance",
  other: "Other",
};

export const LIVE_STATUSES = new Set(["scheduled", "confirmed", "in_progress", "done"]);

export function parsePeriod(raw: unknown, now = new Date()): Period {
  const s = typeof raw === "string" ? raw : "";
  if (s === "all") return { kind: "all" };
  if (s === "last12") return { kind: "last12" };
  if (/^\d{4}$/.test(s)) return { kind: "year", year: Number(s) };
  return { kind: "year", year: Number(localDate(now).slice(0, 4)) };
}

export function periodParam(p: Period): string {
  return p.kind === "year" ? String(p.year) : p.kind;
}

/** First month (inclusive) and end month (exclusive) as YYYY-MM-DD, or null bounds for all time. */
export function periodBounds(p: Period, now = new Date()): { start: string | null; end: string | null; label: string } {
  if (p.kind === "year") return { start: `${p.year}-01-01`, end: `${p.year + 1}-01-01`, label: String(p.year) };
  if (p.kind === "last12") {
    const thisMonth = parseISO(`${localDate(now).slice(0, 7)}-01`);
    return {
      start: format(addMonths(thisMonth, -11), "yyyy-MM-dd"),
      end: format(addMonths(thisMonth, 1), "yyyy-MM-dd"),
      label: "Last 12 months",
    };
  }
  return { start: null, end: null, label: "All time" };
}

function monthsBetween(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  let cur = parseISO(start);
  const end = parseISO(endExclusive);
  while (cur < end) {
    out.push(format(cur, "yyyy-MM"));
    cur = addMonths(cur, 1);
  }
  return out;
}

export function buildAnalytics(
  input: { months: MonthInput[]; jobs: JobInput[]; expenses: ExpenseInput[]; pay: PayInput[] },
  period: Period,
  now = new Date(),
): Analytics {
  const b = periodBounds(period, now);
  const inRange = (ymd: string) => (b.start === null || ymd >= b.start) && (b.end === null || ymd < b.end);

  const monthRows = input.months.filter((m) => inRange(m.month));
  let monthKeys: string[];
  if (b.start && b.end) monthKeys = monthsBetween(b.start, b.end);
  else {
    const keys = monthRows.map((m) => m.month.slice(0, 7)).sort();
    monthKeys = keys.length
      ? monthsBetween(`${keys[0]}-01`, format(addMonths(parseISO(`${keys[keys.length - 1]}-01`), 1), "yyyy-MM-dd"))
      : [];
  }
  const byMonth = new Map(monthRows.map((m) => [m.month.slice(0, 7), m]));
  const months: MonthPoint[] = monthKeys.map((k) => {
    const m = byMonth.get(k);
    const revenue = m?.charged_cents ?? 0;
    const cleanerPay = m?.provider_payment_cents ?? 0;
    const fees = m?.stripe_fee_cents ?? 0;
    const expenses = (m?.overhead_expense_cents ?? 0) + (m?.ad_expense_cents ?? 0);
    return {
      month: k,
      label: format(parseISO(`${k}-01`), "MMM yy"),
      revenue,
      cleanerPay,
      fees,
      expenses,
      profit: m?.total_profit_cents ?? revenue - cleanerPay - fees - expenses,
    };
  });

  const jobs = input.jobs.filter((j) => LIVE_STATUSES.has(j.status) && inRange(localDate(new Date(j.scheduled_start))));
  const revenue = months.reduce((s, m) => s + m.revenue, 0);
  const cleanerPay = months.reduce((s, m) => s + m.cleanerPay, 0);
  const fees = months.reduce((s, m) => s + m.fees, 0);
  const expenses = months.reduce((s, m) => s + m.expenses, 0);
  const profit = months.reduce((s, m) => s + m.profit, 0);
  const clientIds = new Set(jobs.map((j) => j.client_id));

  const expensesIn = input.expenses.filter((e) => inRange(e.paid_at));
  const catMap = new Map<string, number>();
  for (const e of expensesIn) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount_cents);
  const expensesByCategory = [...catMap.entries()]
    .map(([key, value]) => ({ key, name: CATEGORY_LABEL[key] ?? key, value }))
    .sort((a, c) => c.value - a.value);

  const svc = new Map<string, RankedBar>();
  const cli = new Map<string, RankedBar>();
  const typ = new Map<string, { key: string; name: string; revenue: number; profit: number; visits: number }>();
  for (const j of jobs) {
    const p = j.charge_cents - j.fee_cents - j.provider_pay_cents;
    const s = svc.get(j.service_name) ?? {
      key: j.service_name,
      name: j.service_name || "Unspecified",
      value: 0,
      visits: 0,
      profit: 0,
    };
    s.value += j.charge_cents;
    s.visits = (s.visits ?? 0) + 1;
    s.profit = (s.profit ?? 0) + p;
    svc.set(j.service_name, s);
    const c = cli.get(j.client_id) ?? { key: j.client_id, name: j.client_name, value: 0, visits: 0, profit: 0 };
    c.value += j.charge_cents;
    c.visits = (c.visits ?? 0) + 1;
    c.profit = (c.profit ?? 0) + p;
    cli.set(j.client_id, c);
    const t = typ.get(j.client_type) ?? {
      key: j.client_type,
      name: j.client_type === "commercial" ? "Commercial" : "Residential",
      revenue: 0,
      profit: 0,
      visits: 0,
    };
    t.revenue += j.charge_cents;
    t.profit += p;
    t.visits += 1;
    typ.set(j.client_type, t);
  }
  const desc = (a: RankedBar, c: RankedBar) => c.value - a.value;

  const payMap = new Map<string, number>();
  for (const p of input.pay) payMap.set(p.provider_name, (payMap.get(p.provider_name) ?? 0) + p.pay_cents);
  const payByCleaner = [...payMap.entries()].map(([name, value]) => ({ key: name, name, value })).sort(desc);

  return {
    periodLabel: b.label,
    months,
    summary: {
      revenue,
      cleanerPay,
      fees,
      expenses,
      profit,
      marginPct: revenue ? Math.round((1000 * profit) / revenue) / 10 : null,
      visits: jobs.length,
      clients: clientIds.size,
      avgTicket: jobs.length ? Math.round(revenue / jobs.length) : 0,
    },
    expensesByCategory,
    revenueByService: [...svc.values()].sort(desc),
    topClients: [...cli.values()].sort(desc).slice(0, 10),
    byClientType: [...typ.values()].sort((a, c) => c.revenue - a.revenue),
    payByCleaner,
  };
}

/** Years that have any data, newest first, for the period picker. */
export function availableYears(months: { month: string }[], now = new Date()): number[] {
  const ys = new Set(months.map((m) => Number(m.month.slice(0, 4))));
  ys.add(Number(localDate(now).slice(0, 4)));
  return [...ys].sort((a, b) => b - a);
}

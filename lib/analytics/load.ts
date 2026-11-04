import "server-only";

import { createClient } from "@/lib/supabase/server";
import { localToInstant } from "@/lib/tz";
import { availableYears, buildAnalytics, periodBounds, type Analytics, type JobInput, type Period } from "./build";

export async function loadAnalytics(period: Period): Promise<{ analytics: Analytics; years: number[] }> {
  const supabase = await createClient();
  const b = periodBounds(period);
  const startIso = b.start ? localToInstant(b.start, "00:00").toISOString() : null;
  const endIso = b.end ? localToInstant(b.end, "00:00").toISOString() : null;

  let jobsQ = supabase
    .from("v_job_economics")
    .select(
      "job_id, scheduled_start, status, charge_cents, fee_cents, provider_pay_cents, client_id, client_name, cleaning_type",
    )
    .in("status", ["scheduled", "confirmed", "in_progress", "done"]);
  if (startIso) jobsQ = jobsQ.gte("scheduled_start", startIso);
  if (endIso) jobsQ = jobsQ.lt("scheduled_start", endIso);

  let expQ = supabase.from("expenses").select("paid_at, category, amount_cents");
  if (b.start) expQ = expQ.gte("paid_at", b.start);
  if (b.end) expQ = expQ.lt("paid_at", b.end);

  let payQ = supabase
    .from("job_assignments")
    .select("pay_cents, providers(name), jobs!inner(scheduled_start, status)")
    .not("status", "in", "(declined,no_show)")
    .in("jobs.status", ["scheduled", "confirmed", "in_progress", "done"]);
  if (startIso) payQ = payQ.gte("jobs.scheduled_start", startIso);
  if (endIso) payQ = payQ.lt("jobs.scheduled_start", endIso);

  const [months, jobs, clients, expenses, pay] = await Promise.all([
    supabase.from("v_monthly_pnl_by_job").select("*").order("month"),
    jobsQ,
    supabase.from("clients").select("id, type"),
    expQ,
    payQ,
  ]);
  for (const r of [months, jobs, clients, expenses, pay]) if (r.error) throw new Error(r.error.message);

  const typeOf = new Map((clients.data ?? []).map((c) => [c.id, c.type]));
  const jobInputs: JobInput[] = (jobs.data ?? [])
    .filter((j) => j.job_id && j.scheduled_start && j.status && j.client_id)
    .map((j) => ({
      job_id: j.job_id!,
      scheduled_start: j.scheduled_start!,
      status: j.status!,
      charge_cents: j.charge_cents ?? 0,
      fee_cents: j.fee_cents ?? 0,
      provider_pay_cents: j.provider_pay_cents ?? 0,
      client_id: j.client_id!,
      client_name: j.client_name ?? "",
      client_type: typeOf.get(j.client_id!) ?? "residential",
      service_name: j.cleaning_type ?? "",
    }));

  const monthInputs = (months.data ?? []).filter((m) => m.month).map((m) => ({ ...m, month: m.month! }));

  const analytics = buildAnalytics(
    {
      months: monthInputs,
      jobs: jobInputs,
      expenses: expenses.data ?? [],
      pay: (pay.data ?? []).map((p) => ({ provider_name: p.providers?.name ?? "Unassigned", pay_cents: p.pay_cents })),
    },
    period,
  );
  return { analytics, years: availableYears(monthInputs) };
}

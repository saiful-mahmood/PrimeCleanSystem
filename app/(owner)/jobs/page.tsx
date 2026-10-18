import type { Metadata } from "next";
import Link from "next/link";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { PageHeader } from "@/components/owner/page-header";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUSES, type JobStatus } from "@/lib/scheduling/shared";
import { formatLocal, localDate, localToInstant } from "@/lib/tz";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams;
  const today = localDate(new Date());
  const from = typeof sp.from === "string" && sp.from ? sp.from : format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
  const to = typeof sp.to === "string" && sp.to ? sp.to : format(endOfMonth(parseISO(today)), "yyyy-MM-dd");
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const provider = typeof sp.provider === "string" ? sp.provider : "";

  const supabase = await createClient();
  let query = supabase
    .from("v_job_economics")
    .select("*")
    .gte("scheduled_start", localToInstant(from, "00:00").toISOString())
    .lt("scheduled_start", new Date(localToInstant(to, "00:00").getTime() + 86_400_000).toISOString())
    .order("scheduled_start", { ascending: false });
  if (status) query = query.eq("status", status as JobStatus);
  if (q) query = query.ilike("client_name", `%${q}%`);
  if (provider) {
    const { data: ids } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("provider_id", provider)
      .neq("status", "declined");
    query = query.in(
      "job_id",
      (ids ?? []).map((r) => r.job_id),
    );
  }

  const [{ data: rows, error }, { data: providers }] = await Promise.all([
    query,
    supabase.from("providers").select("id, name").order("name"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Jobs" description={`${rows?.length ?? 0} visits · ${from} to ${to}`}>
        <Button nativeButton={false} render={<Link href="/jobs/new" />}>
          New job
        </Button>
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/jobs">
        <Input type="date" name="from" defaultValue={from} className="w-40" aria-label="From" />
        <Input type="date" name="to" defaultValue={to} className="w-40" aria-label="To" />
        <Input name="q" defaultValue={q} placeholder="Client" className="w-44" />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="provider"
          defaultValue={provider}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All cleaners</option>
          {(providers ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/jobs" />}>
          Reset
        </Button>
      </form>

      <JobsTable
        today={today}
        rows={(rows ?? []).map((r) => ({
          id: r.job_id!,
          when: formatLocal(new Date(r.scheduled_start!)),
          clientId: r.client_id!,
          clientName: r.client_name ?? "",
          serviceName: r.cleaning_type,
          chargeCents: r.charge_cents ?? 0,
          receivedCents: Number(r.received_cents ?? 0),
          feeCents: Number(r.fee_cents ?? 0),
          providerNames: r.provider_names,
          providerPayCents: Number(r.provider_pay_cents ?? 0),
          providerUnpaid: !!r.provider_unpaid,
          profitCents: Number(r.profit_cents ?? 0),
          marginPct: r.profit_margin_pct == null ? null : Number(r.profit_margin_pct),
          status: r.status!,
          chargeMethod: r.charge_method,
        }))}
      />
    </>
  );
}

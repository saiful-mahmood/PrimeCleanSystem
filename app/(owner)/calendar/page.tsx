import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { Button } from "@/components/ui/button";
import { CalendarView, type CalendarJob } from "@/components/scheduling/calendar-view";
import { createClient } from "@/lib/supabase/server";
import { calendarRange, rangeTitle, shiftAnchor, type CalendarView as View } from "@/lib/scheduling/calendar";
import { JOB_STATUSES, type JobStatus } from "@/lib/scheduling/shared";
import { localDate, localTime, localToInstant } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const view: View = sp.view === "week" ? "week" : "month";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : localDate(new Date());
  const providerFilter = typeof sp.provider === "string" ? sp.provider : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const typeFilter = sp.type === "residential" || sp.type === "commercial" ? sp.type : "";

  const range = calendarRange(view, date);
  const startInstant = localToInstant(range.start, "00:00");
  const endInstant = new Date(localToInstant(range.end, "00:00").getTime() + 24 * 3600 * 1000);

  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(
      "id, series_id, scheduled_start, duration_min, status, charge_cents, charge_method, notes, clients!inner(name, type), service_types(name), locations(city), job_assignments(id, status, pay_cents, payout_id, provider_id, providers(name)), payments(amount_cents)",
    )
    .gte("scheduled_start", startInstant.toISOString())
    .lt("scheduled_start", endInstant.toISOString())
    .order("scheduled_start");
  if (statusFilter) query = query.eq("status", statusFilter as JobStatus);
  if (typeFilter) query = query.eq("clients.type", typeFilter);

  const [{ data: rows, error }, { data: providers }] = await Promise.all([
    query,
    supabase.from("providers").select("id, name, default_pay_cents").eq("active", true).order("name"),
  ]);
  if (error) throw new Error(error.message);

  const jobs: CalendarJob[] = (rows ?? [])
    .filter(
      (j) =>
        !providerFilter || j.job_assignments.some((a) => a.provider_id === providerFilter && a.status !== "declined"),
    )
    .map((j) => {
      const start = new Date(j.scheduled_start);
      return {
        id: j.id,
        seriesId: j.series_id,
        localDate: localDate(start),
        localTime: localTime(start),
        durationMin: j.duration_min,
        status: j.status,
        chargeCents: j.charge_cents,
        receivedCents: j.payments.reduce((sum, p) => sum + p.amount_cents, 0),
        chargeMethod: j.charge_method,
        clientName: j.clients?.name ?? "",
        clientType: j.clients?.type ?? "residential",
        serviceName: j.service_types?.name ?? "",
        city: j.locations?.city ?? null,
        notes: j.notes,
        assignments: j.job_assignments
          .filter((a) => a.status !== "declined")
          .map((a) => ({
            id: a.id,
            status: a.status,
            payCents: a.pay_cents,
            providerName: a.providers?.name ?? "?",
            paid: !!a.payout_id,
          })),
      };
    });

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      view,
      date,
      provider: providerFilter,
      status: statusFilter,
      type: typeFilter,
      ...patch,
    });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/calendar?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Calendar" description={rangeTitle(view, date, range)}>
        <Button nativeButton={false} render={<Link href={`/jobs/new?date=${date}`} />}>
          New job
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={`/series/new?date=${date}`} />}>
          New recurring
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={qs({ date: shiftAnchor(view, date, -1) })} />}
            aria-label="Previous"
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={qs({ date: localDate(new Date()) })} />}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={qs({ date: shiftAnchor(view, date, 1) })} />}
            aria-label="Next"
          >
            ›
          </Button>
        </div>
        <div className="flex rounded-md border p-0.5 text-sm">
          {(["week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ view: v })}
              className={cn(
                "rounded px-3 py-1 capitalize",
                view === v ? "bg-accent font-medium" : "text-muted-foreground",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex flex-wrap gap-2" action="/calendar">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={date} />
          <select
            name="provider"
            defaultValue={providerFilter}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All cleaners</option>
            {(providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={typeFilter}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All clients</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </form>
      </div>

      <CalendarView
        view={view}
        days={range.days}
        anchorMonth={date.slice(0, 7)}
        today={localDate(new Date())}
        jobs={jobs}
        providers={providers ?? []}
      />
    </>
  );
}

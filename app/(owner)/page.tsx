import Link from "next/link";
import { addDays, format, parseISO, subMonths } from "date-fns";
import { PageHeader } from "@/components/owner/page-header";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { formatLocal, localDate, localDayRange, localToInstant } from "@/lib/tz";

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now);
  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const { start: todayStart } = localDayRange(now);
  const dayAfterTomorrow = localToInstant(format(addDays(parseISO(today), 2), "yyyy-MM-dd"), "00:00");
  const weekOut = localToInstant(format(addDays(parseISO(today), 7), "yyyy-MM-dd"), "00:00");
  const thisMonth = `${today.slice(0, 7)}-01`;
  const lastMonth = format(subMonths(parseISO(thisMonth), 1), "yyyy-MM-dd");

  const [
    { data: settings },
    { data: upcoming },
    { data: nextWeek },
    { data: owed },
    { data: ar },
    { data: pnl },
    { data: ending },
  ] = await Promise.all([
    supabase.from("settings").select("key, value").in("key", ["unpaid_provider_nudge_days"]),
    supabase
      .from("jobs")
      .select(
        "id, scheduled_start, status, clients(name), service_types(name), job_assignments(status, providers(name))",
      )
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", dayAfterTomorrow.toISOString())
      .not("status", "in", "(cancelled,skipped)")
      .order("scheduled_start"),
    supabase
      .from("jobs")
      .select("id, scheduled_start, status, clients(name), job_assignments(status)")
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", weekOut.toISOString())
      .in("status", ["scheduled", "confirmed"])
      .order("scheduled_start"),
    supabase.from("v_provider_owed").select("*").order("owed_cents", { ascending: false }),
    supabase.from("v_ar_aging").select("*").order("days_outstanding", { ascending: false }),
    supabase.from("v_monthly_pnl_by_job").select("*").in("month", [thisMonth, lastMonth]),
    supabase
      .from("job_series")
      .select("id, end_date, clients(name), service_types(name)")
      .eq("active", true)
      .not("end_date", "is", null)
      .lte("end_date", format(addDays(parseISO(today), 30), "yyyy-MM-dd"))
      .gte("end_date", today),
  ]);

  const nudgeDays = Number(settings?.find((s) => s.key === "unpaid_provider_nudge_days")?.value ?? 3);
  const nudgeCutoff = new Date(now.getTime() - nudgeDays * 86_400_000);
  const todays = (upcoming ?? []).filter((j) => localDate(new Date(j.scheduled_start)) === today);
  const tomorrows = (upcoming ?? []).filter((j) => localDate(new Date(j.scheduled_start)) === tomorrow);
  const unassigned = (nextWeek ?? []).filter((j) => !j.job_assignments.some((a) => a.status !== "declined"));
  const notAccepted = (nextWeek ?? []).filter(
    (j) =>
      localDate(new Date(j.scheduled_start)) <= format(addDays(parseISO(today), 3), "yyyy-MM-dd") &&
      j.job_assignments.some((a) => a.status === "offered") &&
      !j.job_assignments.some((a) => a.status === "accepted" || a.status === "done"),
  );
  const totalOwed = (owed ?? []).reduce((s, o) => s + Number(o.owed_cents ?? 0), 0);
  // Both "owed" tiles are to date; the month split is shown as a note.
  const arTotal = (ar ?? []).reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);
  const arThisMonthTotal = (ar ?? [])
    .filter((r) => (r.since ?? "") >= thisMonth)
    .reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);
  const arOldest = ar?.[0];
  const overdueAr = (ar ?? []).filter((r) => Number(r.days_outstanding ?? 0) > nudgeDays);
  const thisPnl = pnl?.find((p) => p.month === thisMonth);
  const lastPnl = pnl?.find((p) => p.month === lastMonth);

  return (
    <>
      <PageHeader title="Today" description={format(parseISO(today), "EEEE, MMMM d")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/pay"
          label="Owed to cleaners to date"
          value={formatCents(totalOwed)}
          sub={owed?.length ? `${owed.length} cleaner${owed.length === 1 ? "" : "s"}` : "all paid"}
        />
        <Stat
          href="/jobs?status=done"
          label="Owed by clients to date"
          value={formatCents(arTotal)}
          sub={
            arOldest
              ? `${formatCents(arThisMonthTotal)} from this month · oldest ${arOldest.days_outstanding}d`
              : "nothing outstanding"
          }
        />
        <Stat
          href="/jobs"
          label="Profit this month"
          value={formatCents(Number(thisPnl?.total_profit_cents ?? 0))}
          sub={lastPnl ? `last month ${formatCents(Number(lastPnl.total_profit_cents ?? 0))}` : "by job date"}
        />
        <Stat
          href="/calendar"
          label="Unassigned next 7 days"
          value={String(unassigned.length)}
          sub={unassigned.length ? "needs a cleaner" : "all covered"}
          tone={unassigned.length ? "warn" : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {todays.length ? `${todays.length} visit${todays.length === 1 ? "" : "s"}` : "No visits today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobList jobs={todays} />
            {tomorrows.length > 0 && (
              <>
                <p className="mt-4 mb-1 text-xs font-medium uppercase text-muted-foreground">Tomorrow</p>
                <JobList jobs={tomorrows} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {overdueAr.map((r) => (
                <li key={`${r.kind}-${r.ref_id}`}>
                  <Link
                    href={r.kind === "job" ? `/jobs/${r.ref_id}` : `/clients/${r.client_id}`}
                    className="hover:underline"
                  >
                    {r.client_name}
                  </Link>{" "}
                  owes {formatCents(Number(r.amount_cents ?? 0))}, {r.days_outstanding} days
                </li>
              ))}
              {(owed ?? [])
                .filter((o) => o.oldest_job_at && new Date(o.oldest_job_at) < nudgeCutoff)
                .map((o) => (
                  <li key={o.provider_id}>
                    <Link href="/pay" className="hover:underline">
                      {o.provider_name}
                    </Link>{" "}
                    has been owed {formatCents(Number(o.owed_cents ?? 0))} since{" "}
                    {formatLocal(new Date(o.oldest_job_at!))}
                  </li>
                ))}
              {notAccepted.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="hover:underline">
                    {j.clients?.name}
                  </Link>{" "}
                  on {formatLocal(new Date(j.scheduled_start))}: cleaner has not accepted
                </li>
              ))}
              {(ending ?? []).map((s) => (
                <li key={s.id}>
                  <Link href={`/series/${s.id}`} className="hover:underline">
                    {s.clients?.name} · {s.service_types?.name}
                  </Link>{" "}
                  series ends {s.end_date}
                </li>
              ))}
              {overdueAr.length + notAccepted.length + (ending?.length ?? 0) === 0 &&
                !(owed ?? []).some((o) => o.oldest_job_at && new Date(o.oldest_job_at) < nudgeCutoff) && (
                  <li className="text-muted-foreground">Nothing urgent.</li>
                )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({
  href,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  return (
    <Link href={href}>
      <Card className={`h-full transition-colors hover:bg-accent/40 ${tone === "warn" ? "border-amber-300" : ""}`}>
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </CardHeader>
      </Card>
    </Link>
  );
}

function JobList({
  jobs,
}: {
  jobs: {
    id: string;
    scheduled_start: string;
    status: "scheduled" | "confirmed" | "in_progress" | "done" | "cancelled" | "skipped";
    clients: { name: string } | null;
    service_types: { name: string } | null;
    job_assignments: { status: string; providers: { name: string } | null }[];
  }[];
}) {
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="divide-y text-sm">
      {jobs.map((j) => {
        const who = j.job_assignments
          .filter((a) => a.status !== "declined")
          .map((a) => a.providers?.name)
          .filter(Boolean);
        return (
          <li key={j.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">
                {formatLocal(new Date(j.scheduled_start)).split(" · ")[1]} · {j.clients?.name}
              </Link>
              <div className="truncate text-muted-foreground">
                {j.service_types?.name} ·{" "}
                {who.length ? who.join(", ") : <span className="text-amber-700">unassigned</span>}
              </div>
            </div>
            <StatusBadge status={j.status} />
          </li>
        );
      })}
    </ul>
  );
}

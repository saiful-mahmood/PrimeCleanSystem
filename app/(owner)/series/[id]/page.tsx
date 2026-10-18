import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { DetailList } from "@/components/owner/detail-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { describeRule } from "@/lib/rrule";
import { formatLocal, localDate } from "@/lib/tz";
import { endSeries, regenerateSeries } from "../actions";

export default async function SeriesDetailPage({ params }: PageProps<"/series/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: series }, { data: jobs }] = await Promise.all([
    supabase
      .from("job_series")
      .select("*, clients(name), locations(label, address_line1, city), service_types(name), providers(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id, scheduled_start, status, charge_cents, job_assignments(status, providers(name))")
      .eq("series_id", id)
      .order("scheduled_start"),
  ]);
  if (!series) notFound();

  const today = localDate(new Date());
  const upcoming = (jobs ?? []).filter((j) => localDate(new Date(j.scheduled_start)) >= today);
  const past = (jobs ?? []).filter((j) => localDate(new Date(j.scheduled_start)) < today).reverse();
  const nextDate = upcoming.find((j) => j.status === "scheduled" || j.status === "confirmed");
  const endFrom = nextDate ? localDate(new Date(nextDate.scheduled_start)) : today;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {series.clients?.name} · {series.service_types?.name}
            {!series.active && <Badge variant="outline">ended</Badge>}
          </span>
        }
        description={describeRule(series)}
      >
        {series.active && (
          <>
            <form action={regenerateSeries.bind(null, series.id)}>
              <Button type="submit" variant="outline">
                Generate visits
              </Button>
            </form>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/series/${series.id}/edit?from=${endFrom}`} />}
            >
              Edit from next visit
            </Button>
            <form action={endSeries.bind(null, series.id, endFrom)}>
              <Button type="submit" variant="destructive">
                End series
              </Button>
            </form>
          </>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Series</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                [
                  "Client",
                  <Link key="c" href={`/clients/${series.client_id}`} className="hover:underline">
                    {series.clients?.name}
                  </Link>,
                ],
                [
                  "Location",
                  [series.locations?.label, series.locations?.address_line1 ?? series.locations?.city]
                    .filter(Boolean)
                    .join(" · "),
                ],
                ["Repeats", describeRule(series)],
                ["First visit", series.start_date],
                ["Last visit", series.end_date ?? "open-ended"],
                ["Duration", `${series.duration_min} min`],
                ["Charge", formatCents(series.charge_cents)],
                ["Cleaner", series.providers?.name ?? "unassigned"],
                ["Cleaner pay", formatCents(series.provider_pay_cents)],
                ["Notes", series.notes],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming visits ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None generated. {series.active ? "Click Generate visits." : "The series has ended."}
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {upcoming.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/jobs/${j.id}`} className="hover:underline">
                      {formatLocal(new Date(j.scheduled_start))}
                    </Link>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {j.job_assignments
                        .map((a) => a.providers?.name)
                        .filter(Boolean)
                        .join(", ")}
                      <StatusBadge status={j.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {past.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Past visits ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {past.slice(0, 20).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/jobs/${j.id}`} className="hover:underline">
                    {formatLocal(new Date(j.scheduled_start))}
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {formatCents(j.charge_cents)}
                    <StatusBadge status={j.status} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

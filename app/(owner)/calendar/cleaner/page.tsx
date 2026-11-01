import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { CopyTextButton } from "@/components/schedules/copy-text-button";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { hoursLabel, monthBounds, monthGrid, scheduleAsText, shortTime, timeRange } from "@/lib/schedules/build";
import { loadMonthlySchedule } from "@/lib/schedules/load";
import { localDate } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cleaner schedule" };

export default async function CleanerSchedulePage({ searchParams }: PageProps<"/calendar/cleaner">) {
  const sp = await searchParams;
  const month =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : localDate(new Date()).slice(0, 7);
  const includePay = sp.pay !== "0";
  const supabase = await createClient();
  const { data: providers } = await supabase.from("providers").select("id, name").eq("active", true).order("name");
  const providerId =
    typeof sp.provider === "string" && providers?.some((p) => p.id === sp.provider)
      ? sp.provider
      : (providers?.[0]?.id ?? "");
  const schedule = providerId ? await loadMonthlySchedule(providerId, month) : null;
  const b = monthBounds(month);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ provider: providerId, month, pay: includePay ? "1" : "0", ...patch });
    return `/calendar/cleaner?${p.toString()}`;
  };
  const text = schedule ? scheduleAsText(schedule, { includePay }) : "";

  return (
    <>
      <PageHeader
        title="Cleaner schedule"
        description="One cleaner's month, ready to send. No lockbox codes, no client prices."
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/calendar" />}>
          Back to calendar
        </Button>
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/calendar/cleaner">
        <select
          name="provider"
          defaultValue={providerId}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {(providers ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        />
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="pay" value="1" defaultChecked={includePay} className="accent-primary" /> Include
          pay
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Show
        </Button>
        <span className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={qs({ month: b.prev })} />}>
            ‹ {monthBounds(b.prev).label.split(" ")[0]}
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={qs({ month: b.next })} />}>
            {monthBounds(b.next).label.split(" ")[0]} ›
          </Button>
        </span>
      </form>

      {!schedule ? (
        <p className="text-sm text-muted-foreground">Add a cleaner first.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Cleaner" value={schedule.providerName} />
            <Stat
              label={schedule.monthLabel}
              value={`${schedule.visitCount} visit${schedule.visitCount === 1 ? "" : "s"}`}
              sub={schedule.cancelledCount ? `+ ${schedule.cancelledCount} cancelled` : undefined}
            />
            <Stat label="Hours" value={hoursLabel(schedule.totalMinutes)} />
            {includePay && <Stat label="Pay this month" value={formatCents(schedule.totalPayCents)} />}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={
                <a
                  href={`/api/schedules/pdf?provider=${providerId}&month=${month}&pay=${includePay ? 1 : 0}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Open PDF
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`/api/schedules/pdf?provider=${providerId}&month=${month}&pay=${includePay ? 1 : 0}&download=1`}
                />
              }
            >
              Download PDF
            </Button>
            <CopyTextButton text={text} />
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{schedule.monthLabel} at a glance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="bg-muted px-1 py-1 text-center font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
                {monthGrid(schedule)
                  .flat()
                  .map((cell) => (
                    <div
                      key={cell.date}
                      className={cn("min-h-16 bg-background p-1", !cell.inMonth && "bg-muted/40 text-muted-foreground")}
                    >
                      <div className="mb-0.5 text-[10px] text-muted-foreground">{cell.dayOfMonth}</div>
                      {cell.visits.map((v) => {
                        const off = v.status === "cancelled" || v.status === "skipped";
                        return (
                          <Link
                            key={v.jobId}
                            href={`/jobs/${v.jobId}`}
                            className={cn(
                              "block truncate rounded border px-1 py-0.5 leading-tight",
                              off
                                ? "border-neutral-200 text-muted-foreground line-through"
                                : "border-sky-200 bg-sky-50 text-sky-900",
                            )}
                            title={`${timeRange(v)} · ${v.clientName}`}
                          >
                            {shortTime(v.scheduledStart)} {v.clientName}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{schedule.monthLabel}</CardTitle>
              <CardDescription>
                What {schedule.providerName} will see. Sending by SMS arrives in Session 5; until then copy or send the
                PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedule.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No visits assigned to {schedule.providerName} this month.
                </p>
              ) : (
                <div className="space-y-4">
                  {schedule.days.map((day) => (
                    <div key={day.date}>
                      <p className="mb-1 text-sm font-semibold">{day.label}</p>
                      <ul className="divide-y rounded-md border text-sm">
                        {day.visits.map((v) => {
                          const off = v.status === "cancelled" || v.status === "skipped";
                          return (
                            <li
                              key={v.jobId}
                              className={cn(
                                "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2",
                                off && "text-muted-foreground line-through",
                              )}
                            >
                              <span className="w-40 shrink-0 tabular-nums">{timeRange(v)}</span>
                              <Link href={`/jobs/${v.jobId}`} className="font-medium hover:underline">
                                {v.clientName}
                              </Link>
                              <span className="text-muted-foreground">{v.address ?? "no address"}</span>
                              <span className="text-muted-foreground">· {v.serviceName}</span>
                              {includePay && <span className="ml-auto tabular-nums">{formatCents(v.payCents)}</span>}
                              <StatusBadge status={v.status} />
                              {v.accessNotes && (
                                <span className="basis-full text-xs text-muted-foreground">
                                  Access: {v.accessNotes}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { DetailList } from "@/components/owner/detail-list";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { AssignForm, CancelJobForm, RecordPaymentForm } from "@/components/scheduling/job-actions";
import { Badge } from "@/components/ui/badge";
import { RevealLockbox } from "@/components/clients/reveal-lockbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { ASSIGNMENT_LABEL } from "@/lib/scheduling/shared";
import { CHARGE_METHODS, LOCATION_PUBLIC_COLUMNS } from "@/lib/types";
import { formatLocal, localDate } from "@/lib/tz";
import { markJobDone, removeAssignment, reopenJob, setAssignmentStatus, skipJob } from "../actions";
import { endSeries } from "../../series/actions";

export default async function JobDetailPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: job }, { data: econ }, { data: providers }, { data: audit }, { data: payments }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        `*, clients(id, name, type, phone), service_types(name), locations(${LOCATION_PUBLIC_COLUMNS}, lockbox_code_enc), job_series(id, rrule, start_date, end_date, start_time, active), job_assignments(id, status, pay_cents, payout_id, accepted_at, done_at, providers(id, name))`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("v_job_economics").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("providers").select("id, name, default_pay_cents").eq("active", true).order("name"),
    supabase
      .from("audit_log")
      .select("action, actor, meta, created_at")
      .eq("entity", "job")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, method, amount_cents, fee_cents, received_at, external_ref, notes")
      .eq("job_id", id)
      .order("received_at"),
  ]);
  if (!job) notFound();

  const start = new Date(job.scheduled_start);
  const open = job.status === "scheduled" || job.status === "confirmed" || job.status === "in_progress";
  const loc = job.locations;
  const address = loc
    ? [loc.address_line1, loc.address_line2, [loc.city, loc.state].filter(Boolean).join(", "), loc.postal_code]
        .filter(Boolean)
        .join(" · ")
    : "";
  const chargeLabel =
    [...CHARGE_METHODS, { value: "venmo", label: "Venmo" }].find((m) => m.value === job.charge_method)?.label ?? null;
  const activeAssignments = job.job_assignments.filter((a) => a.status !== "declined");
  const received = (payments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const outstanding = job.charge_cents - received;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {job.clients?.name}
            <StatusBadge status={job.status} />
          </span>
        }
        description={`${formatLocal(start)} · ${job.duration_min} min · ${job.service_types?.name}`}
      >
        {open && (
          <>
            <Button variant="outline" nativeButton={false} render={<Link href={`/jobs/${job.id}/edit`} />}>
              Edit this one
            </Button>
            <form action={markJobDone.bind(null, job.id)}>
              <Button type="submit">Mark done</Button>
            </form>
          </>
        )}
        {!open && job.status !== "skipped" && (
          <form action={reopenJob.bind(null, job.id)}>
            <Button type="submit" variant="outline">
              Reopen
            </Button>
          </form>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailList
              items={[
                [
                  "Client",
                  <Link key="c" href={`/clients/${job.client_id}`} className="hover:underline">
                    {job.clients?.name}
                  </Link>,
                ],
                [
                  "Phone",
                  job.clients?.phone ? (
                    <a key="p" href={`tel:${job.clients.phone}`} className="hover:underline">
                      {job.clients.phone}
                    </a>
                  ) : null,
                ],
                ["Address", address || loc?.label || null],
                ["Access", loc?.access_notes],
                [
                  "Lockbox",
                  loc?.lockbox_code_enc ? (
                    <span key="l" className="flex flex-wrap items-center gap-2">
                      <RevealLockbox locationId={loc.id} />
                      {loc.lockbox_hint && <span className="text-muted-foreground">{loc.lockbox_hint}</span>}
                    </span>
                  ) : null,
                ],
                ["Scope", loc?.scope_of_work],
                ["Charge", `${formatCents(job.charge_cents)}${chargeLabel ? ` · ${chargeLabel}` : ""}`],
                ["Notes", job.notes],
                ["Completed", job.completed_at ? formatLocal(new Date(job.completed_at)) : null],
                ["Cancelled", job.cancelled_reason],
              ]}
            />
            {job.job_series && (
              <div className="rounded-md border p-3 text-sm">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Part of a recurring series</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    nativeButton={false}
                    render={<Link href={`/series/${job.job_series.id}`} />}
                  >
                    View series
                  </Button>
                  {open && (
                    <form action={skipJob.bind(null, job.id)}>
                      <Button size="sm" variant="outline" type="submit">
                        Skip this one
                      </Button>
                    </form>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/series/${job.job_series.id}/edit?from=${localDate(start)}`} />}
                  >
                    Edit this and future
                  </Button>
                  {job.job_series.active && (
                    <form action={endSeries.bind(null, job.job_series.id, localDate(start))}>
                      <Button size="sm" variant="destructive" type="submit">
                        End series here
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cleaners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.job_assignments.length === 0 && (
                <p className="text-sm text-muted-foreground">Nobody assigned yet.</p>
              )}
              {job.job_assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div>
                    <Link href={`/providers/${a.providers?.id}`} className="font-medium hover:underline">
                      {a.providers?.name}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatCents(a.pay_cents)} · {ASSIGNMENT_LABEL[a.status]}
                      {a.payout_id ? " · paid" : ""}
                    </span>
                  </div>
                  {!a.payout_id && open && (
                    <div className="flex gap-1">
                      {a.status === "offered" && (
                        <form action={setAssignmentStatus.bind(null, a.id, job.id, "accepted")}>
                          <Button size="xs" variant="outline" type="submit">
                            Accepted
                          </Button>
                        </form>
                      )}
                      {(a.status === "offered" || a.status === "accepted") && (
                        <form action={setAssignmentStatus.bind(null, a.id, job.id, "no_show")}>
                          <Button size="xs" variant="outline" type="submit">
                            No-show
                          </Button>
                        </form>
                      )}
                      <form action={removeAssignment.bind(null, a.id, job.id)}>
                        <Button size="xs" variant="ghost" type="submit" className="text-destructive">
                          Remove
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
              {open && (
                <AssignForm
                  jobId={job.id}
                  providers={providers ?? []}
                  exclude={activeAssignments.map((a) => a.providers?.id ?? "")}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Money</CardTitle>
              {job.status !== "cancelled" && job.status !== "skipped" && (
                <Badge variant={outstanding <= 0 ? "default" : "outline"}>
                  {outstanding <= 0 ? "Paid in full" : `${formatCents(outstanding)} outstanding`}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailList
                items={[
                  ["Charged", formatCents(job.charge_cents)],
                  ["Received", formatCents(received)],
                  ["Processing fee", formatCents(Number(econ?.fee_cents ?? 0))],
                  ["Cleaner pay", formatCents(Number(econ?.provider_pay_cents ?? 0))],
                  [
                    "Profit",
                    `${formatCents(Number(econ?.profit_cents ?? 0))}${econ?.profit_margin_pct != null ? ` (${econ.profit_margin_pct}%)` : ""}`,
                  ],
                ]}
              />
              {(payments ?? []).length > 0 && (
                <ul className="divide-y rounded-md border text-sm">
                  {(payments ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {formatLocal(new Date(p.received_at)).split(" · ")[0]} ·{" "}
                        <span className="capitalize">{p.method.replace("stripe_", "").replace("_", " ")}</span>
                        {p.external_ref && (
                          <span className="font-mono text-xs text-muted-foreground"> · {p.external_ref}</span>
                        )}
                      </span>
                      <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {job.status !== "cancelled" && job.status !== "skipped" && (
                <RecordPaymentForm
                  jobId={job.id}
                  outstandingCents={outstanding}
                  defaultMethod={job.charge_method}
                  today={localDate(new Date())}
                />
              )}
              <p className="text-xs text-muted-foreground">Payment links and Stripe invoices arrive in Session 4.</p>
            </CardContent>
          </Card>

          {open && <CancelJobForm jobId={job.id} hasAssignments={activeAssignments.length > 0} />}
        </div>
      </div>

      {(audit ?? []).length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(audit ?? []).map((a, i) => (
                <li key={i} className="flex justify-between gap-4 py-1.5">
                  <span>
                    <span className="font-medium">{a.action.replace("job.", "")}</span>
                    <span className="text-muted-foreground"> by {a.actor}</span>
                    {a.meta && typeof a.meta === "object" && "reason" in a.meta && (
                      <span className="text-muted-foreground"> · {String((a.meta as { reason: unknown }).reason)}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground">{formatLocal(new Date(a.created_at))}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

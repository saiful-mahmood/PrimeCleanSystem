import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { DetailList } from "@/components/owner/detail-list";
import { MarkPaidForm } from "@/components/pay/mark-paid-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { formatLocal } from "@/lib/tz";
import { cancelPayoutDraft, detachFromDraft } from "../actions";

export default async function PayoutPage({ params }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: payout }, { data: items }] = await Promise.all([
    supabase.from("payouts").select("*, providers(id, name, zelle_handle)").eq("id", id).maybeSingle(),
    supabase
      .from("job_assignments")
      .select("id, pay_cents, status, jobs(id, scheduled_start, clients(name), service_types(name))")
      .eq("payout_id", id)
      .order("created_at"),
  ]);
  if (!payout) notFound();
  const paid = !!payout.paid_at;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Payout to {payout.providers?.name}
            <Badge variant={paid ? "default" : "outline"}>{paid ? "Paid" : "Draft"}</Badge>
          </span>
        }
        description={`${formatCents(payout.total_cents)} · ${items?.length ?? 0} job${items?.length === 1 ? "" : "s"}`}
      >
        <Button variant="ghost" nativeButton={false} render={<Link href="/pay" />}>
          Back to Pay cleaners
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs in this payout</CardTitle>
            {!paid && <CardDescription>Remove any you did not mean to include.</CardDescription>}
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(items ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${a.jobs?.id}`} className="hover:underline">
                      {a.jobs ? formatLocal(new Date(a.jobs.scheduled_start)) : "—"}
                    </Link>
                    <div className="truncate text-muted-foreground">
                      {a.jobs?.clients?.name} · {a.jobs?.service_types?.name}
                      {a.status === "cancelled_paid" && " · cancellation fee"}
                    </div>
                  </div>
                  <span className="tabular-nums">{formatCents(a.pay_cents)}</span>
                  {!paid && (items?.length ?? 0) > 1 && (
                    <form action={detachFromDraft.bind(null, payout.id, a.id)}>
                      <Button size="xs" variant="ghost" type="submit" className="text-destructive">
                        Remove
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCents(payout.total_cents)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{paid ? "Payment" : "Send the money, then record it"}</CardTitle>
            {!paid && (
              <CardDescription>
                Zelle {formatCents(payout.total_cents)} to{" "}
                <span className="font-mono">{payout.providers?.zelle_handle ?? "(no handle on file)"}</span>, then paste
                the confirmation number below.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {paid ? (
              <DetailList
                items={[
                  ["Paid", formatLocal(new Date(payout.paid_at!))],
                  ["Method", payout.method],
                  ["Reference", payout.reference ? <span className="font-mono">{payout.reference}</span> : null],
                  ["Notes", payout.notes],
                ]}
              />
            ) : (
              <>
                <MarkPaidForm payoutId={payout.id} />
                <form action={cancelPayoutDraft.bind(null, payout.id)} className="border-t pt-3">
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    Discard this draft
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

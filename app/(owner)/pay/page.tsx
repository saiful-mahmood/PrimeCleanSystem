import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { PayoutBuilder, type OwedAssignment } from "@/components/pay/payout-builder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { formatLocal } from "@/lib/tz";

export const metadata: Metadata = { title: "Pay cleaners" };

export default async function PayPage() {
  const supabase = await createClient();
  const [{ data: owed }, { data: drafts }, { data: recent }] = await Promise.all([
    supabase
      .from("job_assignments")
      .select(
        "id, pay_cents, status, provider_id, providers(name, zelle_handle), jobs(id, scheduled_start, clients(name), service_types(name))",
      )
      .is("payout_id", null)
      .in("status", ["done", "cancelled_paid"])
      .order("created_at"),
    supabase
      .from("payouts")
      .select("id, total_cents, created_at, providers(name)")
      .is("paid_at", null)
      .order("created_at"),
    supabase
      .from("payouts")
      .select("id, total_cents, paid_at, reference, providers(name)")
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(15),
  ]);

  // Group by provider for the "owed" cards.
  const byProvider = new Map<string, { name: string; zelle: string | null; items: OwedAssignment[] }>();
  for (const a of owed ?? []) {
    const g = byProvider.get(a.provider_id) ?? {
      name: a.providers?.name ?? "?",
      zelle: a.providers?.zelle_handle ?? null,
      items: [],
    };
    g.items.push({
      id: a.id,
      payCents: a.pay_cents,
      status: a.status,
      jobId: a.jobs?.id ?? "",
      when: a.jobs ? formatLocal(new Date(a.jobs.scheduled_start)) : "",
      client: a.jobs?.clients?.name ?? "",
      service: a.jobs?.service_types?.name ?? "",
    });
    byProvider.set(a.provider_id, g);
  }
  const groups = [...byProvider.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const totalOwed = (owed ?? []).reduce((s, a) => s + a.pay_cents, 0);

  return (
    <>
      <PageHeader
        title="Pay cleaners"
        description={
          totalOwed
            ? `${formatCents(totalOwed)} owed across ${groups.length} cleaner${groups.length === 1 ? "" : "s"}`
            : "Nothing owed right now."
        }
      />

      {(drafts ?? []).length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle>Drafts waiting to be sent</CardTitle>
            <CardDescription>You started these but have not marked them paid yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(drafts ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <Link href={`/pay/${d.id}`} className="font-medium hover:underline">
                    {d.providers?.name} · {formatCents(d.total_cents)}
                  </Link>
                  <span className="text-muted-foreground">started {formatLocal(new Date(d.created_at))}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Done jobs with an assigned cleaner show up here until you pay them.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([providerId, g]) => (
            <PayoutBuilder
              key={providerId}
              providerId={providerId}
              providerName={g.name}
              zelleHandle={g.zelle}
              items={g.items}
            />
          ))}
        </div>
      )}

      {(recent ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(recent ?? []).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/pay/${p.id}`} className="hover:underline">
                    {p.providers?.name} · {formatCents(p.total_cents)}
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {p.reference && <span className="font-mono text-xs">{p.reference}</span>}
                    <Badge variant="outline">paid {formatLocal(new Date(p.paid_at!))}</Badge>
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

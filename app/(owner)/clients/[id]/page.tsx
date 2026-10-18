import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { DetailList } from "@/components/owner/detail-list";
import { RevealLockbox } from "@/components/clients/reveal-lockbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CHARGE_METHODS, LOCATION_PUBLIC_COLUMNS } from "@/lib/types";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { formatCents } from "@/lib/money";
import { describeRule } from "@/lib/rrule";
import { formatLocal } from "@/lib/tz";
import { deleteLocationAction } from "../actions";

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: locations }, { data: series }, { data: jobs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    // Select the public columns plus a boolean for "has a code"; the ciphertext never leaves the server.
    supabase
      .from("locations")
      .select(`${LOCATION_PUBLIC_COLUMNS}, lockbox_code_enc`)
      .eq("client_id", id)
      .order("created_at"),
    supabase
      .from("job_series")
      .select("id, rrule, start_date, end_date, start_time, charge_cents, active, service_types(name)")
      .eq("client_id", id)
      .order("active", { ascending: false })
      .order("start_date", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, scheduled_start, status, charge_cents")
      .eq("client_id", id)
      .gte("scheduled_start", new Date(new Date().getTime() - 30 * 86_400_000).toISOString())
      .order("scheduled_start")
      .limit(12),
  ]);
  if (!client) notFound();

  const chargeLabel = CHARGE_METHODS.find((m) => m.value === client.default_charge_method)?.label ?? null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {client.name}
            <Badge variant="outline" className="capitalize">
              {client.type}
            </Badge>
            {client.status !== "active" && <Badge variant="secondary">{client.status}</Badge>}
          </span>
        }
        description={client.basic_info ?? undefined}
      >
        <Button nativeButton={false} render={<Link href={`/clients/${client.id}/edit`} />}>
          Edit
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                [
                  "Phone",
                  client.phone ? (
                    <a href={`tel:${client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  ) : null,
                ],
                [
                  "Email",
                  client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  ) : null,
                ],
                ["Usually pays by", chargeLabel],
                ["Source", client.source],
                ["Notes", client.notes],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Locations</CardTitle>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/clients/${client.id}/locations/new`} />}
            >
              Add location
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(locations ?? []).length === 0 && <p className="text-sm text-muted-foreground">No locations yet.</p>}
            {(locations ?? []).map((loc) => {
              const address = [
                loc.address_line1,
                loc.address_line2,
                [loc.city, loc.state].filter(Boolean).join(", "),
                loc.postal_code,
              ]
                .filter(Boolean)
                .join(" · ");
              const size = [
                loc.bedrooms != null ? `${loc.bedrooms} bd` : null,
                loc.bathrooms != null ? `${loc.bathrooms} ba` : null,
                loc.sqft != null ? `${loc.sqft.toLocaleString()} sq ft` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const hasLockbox = !!loc.lockbox_code_enc;
              const isEmpty = !address && !hasLockbox && !loc.scope_of_work;
              return (
                <div key={loc.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{loc.label}</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={isEmpty ? "default" : "ghost"}
                        nativeButton={false}
                        render={<Link href={`/locations/${loc.id}/edit`} />}
                      >
                        {isEmpty ? "Add address and lockbox" : "Edit"}
                      </Button>
                      {(locations ?? []).length > 1 && (
                        <form action={deleteLocationAction.bind(null, loc.id)}>
                          <Button size="sm" variant="ghost" type="submit" className="text-destructive">
                            Delete
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                  <DetailList
                    items={[
                      ["Address", address || null],
                      ["Size", size || null],
                      ["Scope", loc.scope_of_work],
                      ["Access", loc.access_notes],
                      [
                        "Lockbox",
                        hasLockbox ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <RevealLockbox locationId={loc.id} />
                            {loc.lockbox_hint && <span className="text-muted-foreground">{loc.lockbox_hint}</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            none stored ·{" "}
                            <Link href={`/locations/${loc.id}/edit`} className="underline">
                              add one
                            </Link>
                          </span>
                        ),
                      ],
                    ]}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recurring schedules</CardTitle>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/series/new?client=${client.id}`} />}
            >
              New recurring
            </Button>
          </CardHeader>
          <CardContent>
            {(series ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring schedule yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(series ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/series/${s.id}`} className="hover:underline">
                      {s.service_types?.name} · {describeRule(s)}
                    </Link>
                    <span className="text-muted-foreground">{s.active ? formatCents(s.charge_cents) : "ended"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Visits</CardTitle>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/jobs/new?client=${client.id}`} />}
            >
              New job
            </Button>
          </CardHeader>
          <CardContent>
            {(jobs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(jobs ?? []).map((j) => (
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
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              <Link href={`/jobs?q=${encodeURIComponent(client.name)}&from=2020-01-01`} className="underline">
                All visits for this client
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Proposals, invoices, payments and lifetime margin appear here in Sessions 4–6.
        </CardContent>
      </Card>
    </>
  );
}

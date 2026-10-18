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
import { deleteLocationAction } from "../actions";

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: locations }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    // Select the public columns plus a boolean for "has a code"; the ciphertext never leaves the server.
    supabase
      .from("locations")
      .select(`${LOCATION_PUBLIC_COLUMNS}, lockbox_code_enc`)
      .eq("client_id", id)
      .order("created_at"),
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
        <Button render={<Link href={`/clients/${client.id}/edit`} />}>Edit</Button>
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
            <Button size="sm" variant="outline" render={<Link href={`/clients/${client.id}/locations/new`} />}>
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
              return (
                <div key={loc.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{loc.label}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" render={<Link href={`/locations/${loc.id}/edit`} />}>
                        Edit
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
                          <span className="text-muted-foreground">none stored</span>
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

      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Recurring series, upcoming and past jobs, proposals, invoices and lifetime margin appear here as those screens
          are built (Sessions 2–6).
        </CardContent>
      </Card>
    </>
  );
}

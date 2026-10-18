import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList } from "@/components/owner/detail-list";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { setProviderActive } from "../actions";

export default async function ProviderDetailPage({ params }: PageProps<"/providers/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: provider }, { data: owed }, { data: ytd }] = await Promise.all([
    supabase.from("providers").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_provider_owed").select("owed_cents, jobs_owed, oldest_job_at").eq("provider_id", id).maybeSingle(),
    supabase
      .from("v_provider_ytd")
      .select("year, paid_cents")
      .eq("provider_id", id)
      .order("year", { ascending: false }),
  ]);
  if (!provider) notFound();

  const toggleActive = setProviderActive.bind(null, provider.id, !provider.active);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {provider.name}
            {!provider.active && <Badge variant="outline">inactive</Badge>}
          </span>
        }
        description={provider.service_area ?? undefined}
      >
        <form action={toggleActive}>
          <Button type="submit" variant="outline">
            {provider.active ? "Deactivate" : "Reactivate"}
          </Button>
        </form>
        <Button render={<Link href={`/providers/${provider.id}/edit`} />}>Edit</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact and pay</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                [
                  "Phone",
                  provider.phone ? (
                    <a href={`tel:${provider.phone}`} className="hover:underline">
                      {provider.phone}
                    </a>
                  ) : null,
                ],
                [
                  "Email",
                  provider.email ? (
                    <a href={`mailto:${provider.email}`} className="hover:underline">
                      {provider.email}
                    </a>
                  ) : null,
                ],
                ["Zelle handle", provider.zelle_handle],
                ["Default pay", provider.default_pay_cents != null ? formatCents(provider.default_pay_cents) : null],
                ["W-9 on file", provider.w9_on_file ? "Yes" : "No"],
                ["Notes", provider.notes],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                [
                  "Owed now",
                  owed && owed.owed_cents
                    ? `${formatCents(Number(owed.owed_cents))} across ${owed.jobs_owed} job(s)`
                    : "$0.00",
                ],
                ...(ytd ?? []).map(
                  (y) => [`Paid in ${y.year}`, formatCents(Number(y.paid_cents ?? 0))] as [string, string],
                ),
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Jobs done, no-shows and the payout history appear here once scheduling (Session 2) and Pay cleaners
              (Session 3) exist.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

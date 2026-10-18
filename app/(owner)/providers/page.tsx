import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Cleaners" };

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  const { show } = await searchParams;
  const showInactive = show === "all";

  const supabase = await createClient();
  let query = supabase
    .from("providers")
    .select("id, name, phone, zelle_handle, default_pay_cents, w9_on_file, active")
    .order("active", { ascending: false })
    .order("name");
  if (!showInactive) query = query.eq("active", true);
  const [{ data: providers, error }, { data: owed }] = await Promise.all([
    query,
    supabase.from("v_provider_owed").select("provider_id, owed_cents, jobs_owed"),
  ]);
  if (error) throw new Error(error.message);
  const owedBy = new Map((owed ?? []).map((o) => [o.provider_id, o]));

  return (
    <>
      <PageHeader title="Cleaners" description={`${providers?.length ?? 0} ${showInactive ? "total" : "active"}`}>
        <Button variant="outline" render={<Link href={showInactive ? "/providers" : "/providers?show=all"} />}>
          {showInactive ? "Active only" : "Show inactive"}
        </Button>
        <Button render={<Link href="/providers/new" />}>Add cleaner</Button>
      </PageHeader>

      {providers && providers.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Zelle</TableHead>
                <TableHead className="text-right">Default pay</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead className="hidden sm:table-cell">W-9</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => {
                const o = owedBy.get(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/providers/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      {!p.active && (
                        <Badge variant="outline" className="ml-2">
                          inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.phone ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.zelle_handle ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.default_pay_cents != null ? formatCents(p.default_pay_cents) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o && o.owed_cents ? (
                        <span title={`${o.jobs_owed} job(s)`}>{formatCents(Number(o.owed_cents))}</span>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.w9_on_file ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No cleaners yet. Add the people and companies you subcontract to.
        </p>
      )}
    </>
  );
}

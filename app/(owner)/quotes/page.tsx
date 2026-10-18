import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatQuoteMoney, quoteTotalCents, toQuoteFields } from "@/lib/quotes/model";
import { formatLocal } from "@/lib/tz";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("proposals")
    .select("id, quote_number, title, status, current_version, updated_at, sent_at, clients(name)")
    .not("quote_number", "is", null)
    .order("updated_at", { ascending: false });
  const ids = (quotes ?? []).map((q) => q.id);
  const { data: versions } = ids.length
    ? await supabase
        .from("proposal_versions")
        .select("proposal_id, version_no, fields, created_at")
        .in("proposal_id", ids)
    : { data: [] as { proposal_id: string; version_no: number; fields: unknown; created_at: string }[] };
  const latestByQuote = new Map<string, { fields: unknown; created_at: string }>();
  for (const q of quotes ?? []) {
    const v = (versions ?? []).find((x) => x.proposal_id === q.id && x.version_no === q.current_version);
    if (v) latestByQuote.set(q.id, v);
  }

  return (
    <>
      <PageHeader title="Quotes" description="Estimates for prospective and existing clients, with every version kept.">
        <Button nativeButton={false} render={<Link href="/quotes/new" />}>
          New quote
        </Button>
      </PageHeader>
      {(quotes ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No quotes yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Version</TableHead>
                <TableHead className="hidden md:table-cell">Last saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(quotes ?? []).map((q) => {
                const v = latestByQuote.get(q.id);
                const f = v ? toQuoteFields(v.fields) : null;
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/quotes/${q.id}`} className="font-mono text-xs hover:underline">
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/quotes/${q.id}`} className="font-medium hover:underline">
                        {f?.client.name || q.clients?.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f ? formatQuoteMoney(quoteTotalCents(f)) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={q.status === "accepted" ? "default" : "outline"} className="capitalize">
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">v{q.current_version}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {v ? formatLocal(new Date(v.created_at)) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { QuoteEditor } from "@/components/quotes/quote-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/quotes/ai";
import { formatQuoteMoney, quoteTotalCents, toQuoteFields } from "@/lib/quotes/model";
import { formatLocal } from "@/lib/tz";
import { restoreVersion, setQuoteStatus } from "../actions";

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: quote }, { data: versions }] = await Promise.all([
    supabase.from("proposals").select("*, clients(id, name)").eq("id", id).maybeSingle(),
    supabase
      .from("proposal_versions")
      .select("version_no, created_at, change_summary, generated_by, model, fields")
      .eq("proposal_id", id)
      .order("version_no", { ascending: false }),
  ]);
  if (!quote || !quote.quote_number) notFound();
  const current = (versions ?? []).find((v) => v.version_no === quote.current_version);
  if (!current) notFound();
  const fields = toQuoteFields(current.fields);
  const total = formatQuoteMoney(quoteTotalCents(fields));

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {fields.client.name || quote.clients?.name}
            <Badge variant="outline" className="font-mono">
              {quote.quote_number}
            </Badge>
            <Badge variant={quote.status === "accepted" ? "default" : "secondary"} className="capitalize">
              {quote.status}
            </Badge>
          </span>
        }
        description={`v${quote.current_version} saved ${formatLocal(new Date(current.created_at))} · ${total}`}
      >
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer" />}
        >
          Open PDF
        </Button>
        <Button nativeButton={false} render={<a href={`/api/quotes/${quote.id}/pdf?download=1`} />}>
          Download PDF
        </Button>
        {quote.status === "draft" && (
          <form action={setQuoteStatus.bind(null, quote.id, "sent")}>
            <Button type="submit" variant="outline">
              Mark sent
            </Button>
          </form>
        )}
        {quote.status === "sent" && (
          <>
            <form action={setQuoteStatus.bind(null, quote.id, "accepted")}>
              <Button type="submit">Accepted</Button>
            </form>
            <form action={setQuoteStatus.bind(null, quote.id, "declined")}>
              <Button type="submit" variant="outline">
                Declined
              </Button>
            </form>
          </>
        )}
        {quote.status !== "draft" && (
          <form action={setQuoteStatus.bind(null, quote.id, "draft")}>
            <Button type="submit" variant="ghost">
              Back to draft
            </Button>
          </form>
        )}
      </PageHeader>

      <QuoteEditor
        proposalId={quote.id}
        quoteNumber={quote.quote_number}
        versionNo={quote.current_version}
        saved={fields}
        aiEnabled={aiConfigured()}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>
            Every save is kept. Open any version as a PDF, or restore it as a new version.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {(versions ?? []).map((v) => {
              const vf = toQuoteFields(v.fields);
              return (
                <li key={v.version_no} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs">v{v.version_no}</span>
                    <span className="text-muted-foreground"> · {formatLocal(new Date(v.created_at))}</span>
                    <span className="ml-2">{v.change_summary}</span>
                    {v.generated_by === "claude" && (
                      <span className="ml-2 text-xs text-muted-foreground">(AI draft saved)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 tabular-nums text-muted-foreground">
                      {formatQuoteMoney(quoteTotalCents(vf))}
                    </span>
                    <Button
                      size="xs"
                      variant="ghost"
                      nativeButton={false}
                      render={
                        <a href={`/api/quotes/${quote.id}/pdf?v=${v.version_no}`} target="_blank" rel="noreferrer" />
                      }
                    >
                      PDF
                    </Button>
                    {v.version_no !== quote.current_version && (
                      <form action={restoreVersion.bind(null, quote.id, v.version_no)}>
                        <Button size="xs" variant="ghost" type="submit">
                          Restore
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Client record:{" "}
            <Link href={`/clients/${quote.client_id}`} className="underline">
              {quote.clients?.name}
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}

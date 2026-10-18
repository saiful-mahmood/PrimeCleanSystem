"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeImport, commitImport, type Preview } from "@/app/(owner)/settings/import/actions";
import type { ImportCounts } from "@/lib/import/commit";

type Step = "upload" | "preview" | "done";

export function ImportWizard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<Record<string, "residential" | "commercial">>({});
  const [merges, setMerges] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function filesForm(): FormData {
    return new FormData(formRef.current!);
  }

  function analyze() {
    setError(null);
    start(async () => {
      const r = await analyzeImport(filesForm());
      if (r.error || !r.preview) return setError(r.error ?? "Could not analyze.");
      setPreview(r.preview);
      setAliases(r.preview.clientAliases);
      setTypes(r.preview.clientTypes);
      setMerges(r.preview.providerMerges);
      setStep("preview");
    });
  }

  function commit() {
    setError(null);
    start(async () => {
      const fd = filesForm();
      fd.set("mappings", JSON.stringify({ clientAliases: aliases, clientTypes: types, providerMerges: merges }));
      const r = await commitImport(fd);
      if (r.error || !r.counts) return setError(r.error ?? "Import failed.");
      setResult(r.counts);
      setStep("done");
    });
  }

  // Canonical names after the owner's edits, with row counts rolled up.
  const canonicals = preview
    ? Object.entries(
        Object.entries(aliases).reduce<Record<string, number>>((acc, [sheet, canon]) => {
          const key = canon.trim() || sheet;
          acc[key] =
            (acc[key] ?? 0) +
            (preview.rowsPerClient[preview.clientAliases[sheet]] ?? 0) /
              countAliasesTo(preview, preview.clientAliases[sheet]);
          return acc;
        }, {}),
      ).sort((a, b) => a[0].localeCompare(b[0]))
    : [];

  return (
    <div className="space-y-6">
      {/* The file inputs stay mounted through every step so the same files are re-sent on commit. */}
      <form ref={formRef} className={step === "upload" ? "space-y-4" : "hidden"} onSubmit={(e) => e.preventDefault()}>
        <div className="rounded-md border p-4">
          <FileField
            name="workbook"
            label="The whole spreadsheet (.xlsx)"
            hint="In Google Sheets: File → Download → Microsoft Excel. The Client Details, Revenues and Expenses tabs are read by name; Monthly Profits is skipped and recomputed."
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </div>
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium">Or upload the tabs as separate CSV files</summary>
          <div className="mt-4 space-y-4">
            <FileField
              name="clients"
              label="Client Details"
              hint="Columns: Client Name, Lockbox Codes, Type of Client, Location, Basic Info, Scope of Work"
            />
            <FileField
              name="revenues"
              label="Revenues"
              hint="Columns: Client Name, Cleaning Type, Cleaning Date and time, Charged Amount, PMT Received, …"
            />
            <FileField
              name="expenses"
              label="Expenses"
              hint="Columns: Subscription, Payment Date, Amount, Paid With, Platform, Recurring Cadence, Notes"
            />
            <p className="text-xs text-muted-foreground">
              Export each tab with File → Download → CSV. The totals row above the header is fine. Ignored when a
              workbook is chosen above.
            </p>
          </div>
        </details>
        <Button onClick={analyze} disabled={pending}>
          {pending ? "Reading…" : "Preview import"}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "preview" && preview && (
        <>
          {preview.previousImport && (
            <Alert>
              <AlertTitle>An import already ran on {new Date(preview.previousImport).toLocaleString()}</AlertTitle>
              <AlertDescription>
                Importing again adds the rows a second time. Only continue if you are importing different files.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Clients" value={preview.counts.clients} />
            <Stat label="Visits" value={preview.counts.revenues} sub={`${preview.counts.future} upcoming`} />
            <Stat label="Cleaners paid" value={preview.counts.paidRows} sub="payouts created" />
            <Stat label="Clients unpaid" value={preview.counts.unpaidClients} sub="show in AR" />
            <Stat label="Invoices sent" value={preview.counts.invoices} sub="awaiting payment" />
            <Stat label="Expenses" value={preview.counts.expenses} />
          </div>

          {preview.lockboxCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {preview.lockboxCount} lockbox code{preview.lockboxCount === 1 ? "" : "s"} will be encrypted on import.
              They are not shown here.
            </p>
          )}

          {preview.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{preview.warnings.length} warnings</CardTitle>
                <CardDescription>
                  Rows marked &quot;skipped&quot; are left out; everything else imports with the note shown.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-mono text-muted-foreground">
                        {w.tab} row {w.row}:
                      </span>{" "}
                      {w.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {preview.files.revenues && (
            <Card>
              <CardHeader>
                <CardTitle>Clients</CardTitle>
                <CardDescription>
                  Sheet names on the left become the client on the right. Edit the right column to merge or rename; set
                  the type for each client.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[32rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 font-medium">In the sheet</th>
                        <th className="py-1 pr-2 font-medium">Becomes client</th>
                        <th className="py-1 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(preview.clientAliases)
                        .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
                        .map(([sheet, proposed]) => {
                          const current = aliases[sheet] ?? proposed;
                          return (
                            <tr key={sheet} className="border-t">
                              <td className="py-1 pr-2 text-muted-foreground">
                                {sheet}
                                {sheet !== proposed && <span className="ml-1 text-xs">→</span>}
                              </td>
                              <td className="py-1 pr-2">
                                <Input
                                  value={current}
                                  onChange={(e) => setAliases({ ...aliases, [sheet]: e.target.value })}
                                  className="h-8"
                                  list="canonical-clients"
                                />
                              </td>
                              <td className="py-1">
                                <select
                                  value={types[current] ?? preview.clientTypes[proposed] ?? "residential"}
                                  onChange={(e) =>
                                    setTypes({ ...types, [current]: e.target.value as "residential" | "commercial" })
                                  }
                                  className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                                >
                                  <option value="residential">Residential</option>
                                  <option value="commercial">Commercial</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <datalist id="canonical-clients">
                    {canonicals.map(([name]) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.files.revenues && Object.keys(preview.providerMerges).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cleaners</CardTitle>
                <CardDescription>
                  Exact names from the Provider column. Type the same name in two rows to merge them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.keys(preview.providerMerges)
                    .sort()
                    .map((name) => (
                      <div key={name} className="flex items-center gap-2 text-sm">
                        <span className="w-32 shrink-0 truncate text-muted-foreground" title={name}>
                          {name}
                        </span>
                        <Input
                          value={merges[name] ?? name}
                          onChange={(e) => setMerges({ ...merges, [name]: e.target.value })}
                          className="h-8"
                        />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {preview.files.revenues && (
            <p className="text-sm text-muted-foreground">
              Service types used: {preview.serviceNames.join(", ")}. Missing ones are created.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={commit} disabled={pending}>
              {pending ? "Importing… this takes a minute" : "Import now"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("upload")} disabled={pending}>
              Back
            </Button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>Rows written to the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
              {Object.entries(result).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href="/jobs?from=2024-01-01" />}>
                Open Jobs
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/clients" />}>
                Open Clients
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/pay" />}>
                Pay cleaners
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Next: open P&L (coming in Session 8) or Jobs and compare a month to your old Monthly Profits tab.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function countAliasesTo(preview: Preview, canonical: string): number {
  return Math.max(1, Object.values(preview.clientAliases).filter((c) => c === canonical).length);
}

function FileField({
  name,
  label,
  hint,
  accept = ".csv,text/csv",
}: {
  name: string;
  label: string;
  hint: string;
  accept?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`file-${name}`}>{label}</Label>
      <Input id={`file-${name}`} name={name} type="file" accept={accept} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

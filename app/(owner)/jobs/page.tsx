import type { Metadata } from "next";
import Link from "next/link";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { PageHeader } from "@/components/owner/page-header";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { JOB_STATUSES, type JobStatus } from "@/lib/scheduling/shared";
import { formatLocal, localDate, localToInstant } from "@/lib/tz";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams;
  const today = localDate(new Date());
  const from = typeof sp.from === "string" && sp.from ? sp.from : format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
  const to = typeof sp.to === "string" && sp.to ? sp.to : format(endOfMonth(parseISO(today)), "yyyy-MM-dd");
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const provider = typeof sp.provider === "string" ? sp.provider : "";

  const supabase = await createClient();
  let query = supabase
    .from("v_job_economics")
    .select("*")
    .gte("scheduled_start", localToInstant(from, "00:00").toISOString())
    .lt("scheduled_start", new Date(localToInstant(to, "00:00").getTime() + 86_400_000).toISOString())
    .order("scheduled_start", { ascending: false });
  if (status) query = query.eq("status", status as JobStatus);
  if (q) query = query.ilike("client_name", `%${q}%`);
  if (provider) {
    const { data: ids } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("provider_id", provider)
      .neq("status", "declined");
    query = query.in(
      "job_id",
      (ids ?? []).map((r) => r.job_id),
    );
  }

  const [{ data: rows, error }, { data: providers }] = await Promise.all([
    query,
    supabase.from("providers").select("id, name").order("name"),
  ]);
  if (error) throw new Error(error.message);

  const totals = (rows ?? []).reduce(
    (t, r) => ({
      charge: t.charge + (r.charge_cents ?? 0),
      fee: t.fee + Number(r.fee_cents ?? 0),
      pay: t.pay + Number(r.provider_pay_cents ?? 0),
      profit: t.profit + Number(r.profit_cents ?? 0),
    }),
    { charge: 0, fee: 0, pay: 0, profit: 0 },
  );

  return (
    <>
      <PageHeader title="Jobs" description={`${rows?.length ?? 0} visits · ${from} to ${to}`}>
        <Button nativeButton={false} render={<Link href="/jobs/new" />}>
          New job
        </Button>
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/jobs">
        <Input type="date" name="from" defaultValue={from} className="w-40" aria-label="From" />
        <Input type="date" name="to" defaultValue={to} className="w-40" aria-label="To" />
        <Input name="q" defaultValue={q} placeholder="Client" className="w-44" />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="provider"
          defaultValue={provider}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All cleaners</option>
          {(providers ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/jobs" />}>
          Reset
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Received</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Fee</TableHead>
              <TableHead className="hidden sm:table-cell">Cleaner</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Pay</TableHead>
              <TableHead className="hidden sm:table-cell">Paid</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                  No visits in this range.
                </TableCell>
              </TableRow>
            )}
            {(rows ?? []).map((r) => (
              <TableRow key={r.job_id}>
                <TableCell className="whitespace-nowrap">
                  <Link href={`/jobs/${r.job_id}`} className="hover:underline">
                    {formatLocal(new Date(r.scheduled_start!))}
                  </Link>
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  <Link href={`/clients/${r.client_id}`} className="hover:underline">
                    {r.client_name}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">{r.cleaning_type}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(r.charge_cents ?? 0)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {formatCents(Number(r.received_cents ?? 0))}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {formatCents(Number(r.fee_cents ?? 0))}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {r.provider_names ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatCents(Number(r.provider_pay_cents ?? 0))}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {Number(r.provider_pay_cents ?? 0) === 0 ? (
                    "—"
                  ) : r.provider_unpaid ? (
                    <span className="text-amber-700">Unpaid</span>
                  ) : (
                    "Paid"
                  )}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${Number(r.profit_cents ?? 0) < 0 ? "text-destructive" : ""}`}
                >
                  {formatCents(Number(r.profit_cents ?? 0))}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {r.profit_margin_pct != null ? `${r.profit_margin_pct}%` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status!} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {(rows ?? []).length > 0 && (
            <tfoot className="border-t bg-muted/40 text-sm font-medium">
              <tr>
                <td className="px-2 py-2" colSpan={3}>
                  Totals
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCents(totals.charge)}</td>
                <td className="hidden px-2 py-2 lg:table-cell" />
                <td className="hidden px-2 py-2 text-right tabular-nums lg:table-cell">{formatCents(totals.fee)}</td>
                <td className="hidden px-2 py-2 sm:table-cell" />
                <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{formatCents(totals.pay)}</td>
                <td className="hidden px-2 py-2 sm:table-cell" />
                <td className="px-2 py-2 text-right tabular-nums">{formatCents(totals.profit)}</td>
                <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">
                  {totals.charge ? `${Math.round((1000 * totals.profit) / totals.charge) / 10}%` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </>
  );
}

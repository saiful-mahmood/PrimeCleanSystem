import type { Metadata } from "next";
import Link from "next/link";
import { addMonths, format, parseISO } from "date-fns";
import { PageHeader } from "@/components/owner/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { localDate } from "@/lib/tz";
import { deleteExpense } from "./actions";

export const metadata: Metadata = { title: "Expenses" };

const CATEGORY_LABEL: Record<string, string> = {
  overhead: "Overhead",
  software: "Software",
  ads: "Advertising",
  supplies: "Supplies",
  insurance: "Insurance",
  other: "Other",
};

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const sp = await searchParams;
  const month =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : localDate(new Date()).slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = format(addMonths(parseISO(monthStart), 1), "yyyy-MM-dd");
  const prev = format(addMonths(parseISO(monthStart), -1), "yyyy-MM");
  const next = format(addMonths(parseISO(monthStart), 1), "yyyy-MM");

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("paid_at", monthStart)
    .lt("paid_at", nextMonth)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);

  const total = (rows ?? []).reduce((s, r) => s + r.amount_cents, 0);
  const byCat = new Map<string, number>();
  for (const r of rows ?? []) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount_cents);

  return (
    <>
      <PageHeader title="Expenses" description={`${format(parseISO(monthStart), "MMMM yyyy")} · ${formatCents(total)}`}>
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/expenses/new?date=${month === localDate(new Date()).slice(0, 7) ? localDate(new Date()) : monthStart}`}
            />
          }
        >
          Add expense
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/expenses?month=${prev}`} />}>
          ‹ {format(parseISO(`${prev}-01`), "MMM")}
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/expenses" />}>
          This month
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/expenses?month=${next}`} />}>
          {format(parseISO(`${next}-01`), "MMM")} ›
        </Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {[...byCat.entries()].map(([c, v]) => (
            <span key={c}>
              {CATEGORY_LABEL[c] ?? c}: <span className="tabular-nums text-foreground">{formatCents(v)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Paid with</TableHead>
              <TableHead className="hidden md:table-cell">Recurs</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No expenses this month.
                </TableCell>
              </TableRow>
            )}
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{format(parseISO(r.paid_at), "MMM d")}</TableCell>
                <TableCell>
                  <Link href={`/expenses/${r.id}/edit`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  {r.platform && <span className="text-muted-foreground"> · {r.platform}</span>}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{CATEGORY_LABEL[r.category]}</TableCell>
                <TableCell className="hidden md:table-cell">{r.paid_with ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell capitalize">{r.cadence.replace("_", " ")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(r.amount_cents)}</TableCell>
                <TableCell className="text-right">
                  <form action={deleteExpense.bind(null, r.id)}>
                    <Button size="xs" variant="ghost" type="submit" className="text-destructive">
                      Delete
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CostsChart, ProfitChart, RankedBars, RevenueProfitChart } from "@/components/analytics/charts";
import { PageHeader } from "@/components/owner/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePeriod, periodParam, type Period } from "@/lib/analytics/build";
import { loadAnalytics } from "@/lib/analytics/load";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const { analytics: a, years } = await loadAnalytics(period);
  const s = a.summary;
  const options: { label: string; p: Period }[] = [
    ...years.map((y) => ({ label: String(y), p: { kind: "year", year: y } as Period })),
    { label: "Last 12 months", p: { kind: "last12" } },
    { label: "All time", p: { kind: "all" } },
  ];
  const current = periodParam(period);
  const costPct = (n: number) => (s.revenue ? `${Math.round((1000 * n) / s.revenue) / 10}% of revenue` : undefined);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="By cleaning date, including visits already booked. Expenses by the date they were paid."
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {options.map((o) => {
          const v = periodParam(o.p);
          return (
            <Button
              key={v}
              size="sm"
              variant={v === current ? "default" : "outline"}
              nativeButton={false}
              render={<Link href={`/analytics?period=${v}`} />}
            >
              {o.label}
            </Button>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={formatCents(s.revenue)} sub={`${s.visits} visits · ${s.clients} clients`} />
        <Stat label="Cleaner pay" value={formatCents(s.cleanerPay)} sub={costPct(s.cleanerPay)} />
        <Stat label="Expenses + fees" value={formatCents(s.expenses + s.fees)} sub={costPct(s.expenses + s.fees)} />
        <Stat
          label="Profit"
          value={formatCents(s.profit)}
          sub={s.marginPct != null ? `${s.marginPct}% margin · avg visit ${formatCents(s.avgTicket)}` : undefined}
          tone={s.profit < 0 ? "bad" : "good"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Revenue and profit by month"
          desc="Bars are what clients were charged; the line is what was left."
        >
          <RevenueProfitChart data={a.months} />
        </Panel>
        <Panel title="Where the money went" desc="Cleaner pay, card fees and business expenses, stacked per month.">
          <CostsChart data={a.months} />
        </Panel>
        <Panel title="Profit by month" desc="Red months lost money.">
          <ProfitChart data={a.months} />
        </Panel>
        <Panel title="Expenses by category" desc={`${formatCents(s.expenses)} in ${a.periodLabel.toLowerCase()}.`}>
          <RankedBars data={a.expensesByCategory} color="expenses" valueName="Spent" />
        </Panel>
        <Panel title="Revenue by service" desc="Each service type's share of what was charged.">
          <RankedBars data={a.revenueByService} color="revenue" valueName="Revenue" showDetail />
        </Panel>
        <Panel title="Top clients" desc="The ten clients charged the most.">
          <RankedBars data={a.topClients} color="revenue" valueName="Revenue" showDetail />
        </Panel>
        <Panel title="Residential vs commercial" desc="Revenue, visits and profit by client type.">
          <ClientTypeSplit rows={a.byClientType} />
        </Panel>
        <Panel title="Pay by cleaner" desc="What each cleaner earned on visits in the period.">
          <RankedBars data={a.payByCleaner} color="cleaner" valueName="Pay" />
        </Panel>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Monthly figures</CardTitle>
          <CardDescription>The numbers behind the charts.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cleaner pay</TableHead>
                <TableHead className="text-right">Card fees</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(m.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(m.cleanerPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(m.fees)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(m.expenses)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", m.profit < 0 && "text-destructive")}>
                    {formatCents(m.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.revenue ? `${Math.round((1000 * m.profit) / m.revenue) / 10}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.cleanerPay)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.fees)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(s.expenses)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", s.profit < 0 && "text-destructive")}>
                  {formatCents(s.profit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.marginPct != null ? `${s.marginPct}%` : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-xl", tone === "bad" && "text-destructive")}>{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ClientTypeSplit({
  rows,
}: {
  rows: { key: string; name: string; revenue: number; profit: number; visits: number }[];
}) {
  const total = rows.reduce((t, r) => t + r.revenue, 0);
  if (!total) return <p className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</p>;
  const color = (k: string) => (k === "commercial" ? "var(--viz-expenses)" : "var(--viz-revenue)");
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded">
        {rows.map((r) => (
          <div key={r.key} style={{ width: `${(100 * r.revenue) / total}%`, background: color(r.key) }} />
        ))}
      </div>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: color(r.key) }} />
            <span className="font-medium">{r.name}</span>
            <span className="text-muted-foreground">
              {Math.round((100 * r.revenue) / total)}% · {r.visits} visits
            </span>
            <span className="ml-auto tabular-nums">{formatCents(r.revenue)}</span>
            <span className="w-28 text-right text-muted-foreground tabular-nums">profit {formatCents(r.profit)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

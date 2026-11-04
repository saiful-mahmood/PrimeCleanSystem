"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents } from "@/lib/money";
import type { MonthPoint, RankedBar } from "@/lib/analytics/build";

const C = {
  revenue: "var(--viz-revenue)",
  cleaner: "var(--viz-cleaner)",
  profit: "var(--viz-profit)",
  fees: "var(--viz-fees)",
  expenses: "var(--viz-expenses)",
  loss: "var(--viz-loss)",
  grid: "var(--viz-grid)",
  text: "var(--muted-foreground)",
};

const axisStyle = { fontSize: 11, fill: C.text } as const;
const dollarsShort = (v: number) => {
  const d = v / 100;
  if (Math.abs(d) >= 1000) return `$${(d / 1000).toFixed(Math.abs(d) >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(d)}`;
};

type TipProps = {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
};

function MoneyTooltip({ active, label, payload, showDetail }: TipProps & { showDetail?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{String(label ?? row.name ?? "")}</p>
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3">{formatCents(Number(p.value ?? 0))}</span>
        </p>
      ))}
      {showDetail && typeof row.visits === "number" && (
        <p className="mt-1 text-muted-foreground">
          {row.visits} visit{row.visits === 1 ? "" : "s"} · profit {formatCents(Number(row.profit ?? 0))}
        </p>
      )}
    </div>
  );
}

/** Revenue as bars, profit as a line, one shared dollar axis. */
export function RevenueProfitChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={dollarsShort} width={48} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar
          isAnimationActive={false}
          dataKey="revenue"
          name="Revenue"
          fill={C.revenue}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Line
          isAnimationActive={false}
          dataKey="profit"
          name="Profit"
          type="monotone"
          stroke={C.profit}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 2, stroke: "var(--background)", fill: C.profit }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Where each month's revenue went: cleaner pay, card fees, business expenses, stacked. */
export function CostsChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={dollarsShort} width={48} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar
          dataKey="cleanerPay"
          name="Cleaner pay"
          stackId="c"
          fill={C.cleaner}
          stroke="var(--background)"
          maxBarSize={40}
        />
        <Bar
          isAnimationActive={false}
          dataKey="fees"
          name="Card fees"
          stackId="c"
          fill={C.fees}
          stroke="var(--background)"
          maxBarSize={40}
        />
        <Bar
          dataKey="expenses"
          name="Expenses"
          stackId="c"
          fill={C.expenses}
          stroke="var(--background)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Monthly profit, red below zero. */
export function ProfitChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={dollarsShort} width={48} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Bar isAnimationActive={false} dataKey="profit" name="Profit" maxBarSize={40} radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.month} fill={d.profit < 0 ? C.loss : C.profit} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranked horizontal bars, one hue, largest first. */
export function RankedBars({
  data,
  color,
  valueName,
  height,
  showDetail,
}: {
  data: RankedBar[];
  color: "revenue" | "cleaner" | "expenses" | "profit";
  valueName: string;
  height?: number;
  showDetail?: boolean;
}) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</p>;
  const h = height ?? Math.max(120, 28 * data.length + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke={C.grid} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={dollarsShort} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ ...axisStyle, fill: "var(--foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip content={<MoneyTooltip showDetail={showDetail} />} cursor={{ fill: "var(--muted)" }} />
        <Bar
          dataKey="value"
          name={valueName}
          fill={C[color]}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{
            position: "right",
            fontSize: 11,
            fill: "var(--foreground)",
            formatter: (v: unknown) => dollarsShort(Number(v)),
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

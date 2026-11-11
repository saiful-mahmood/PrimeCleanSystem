"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { FormActions, SelectField, TextField } from "@/components/forms/fields";
import { StatusBadge } from "@/components/scheduling/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { recordBulkPayment, updateBulkPricing } from "@/app/(owner)/jobs/actions";
import type { FormState } from "@/lib/forms";
import { formatCents } from "@/lib/money";
import type { JobStatus } from "@/lib/scheduling/shared";

/** One row of the Jobs list, already formatted on the server. */
export type JobRow = {
  id: string;
  when: string;
  clientId: string;
  clientName: string;
  serviceName: string | null;
  chargeCents: number;
  receivedCents: number;
  feeCents: number;
  providerNames: string | null;
  providerPayCents: number;
  providerUnpaid: boolean;
  profitCents: number;
  marginPct: number | null;
  status: JobStatus;
  chargeMethod: string | null;
};

const PAYMENT_METHODS = [
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "stripe_card", label: "Card (Stripe)" },
  { value: "stripe_ach", label: "ACH (Stripe)" },
  { value: "stripe_invoice", label: "Stripe invoice" },
];

export function JobsTable({ rows, today }: { rows: JobRow[]; today: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState<"payment" | "pricing" | null>(null);

  const live = useMemo(() => rows.filter((r) => r.status !== "cancelled" && r.status !== "skipped"), [rows]);
  const payable = useMemo(() => live.filter((r) => r.status === "done" && r.receivedCents < r.chargeCents), [live]);
  const chosen = live.filter((r) => selected.has(r.id));
  const selectedRows = chosen.filter((r) => r.status === "done" && r.receivedCents < r.chargeCents);
  const selectedTotal = selectedRows.reduce((s, r) => s + (r.chargeCents - r.receivedCents), 0);
  const allSelected = live.length > 0 && chosen.length === live.length;
  const allPayableSelected = payable.length > 0 && payable.every((r) => selected.has(r.id));

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await recordBulkPayment(prev, fd);
    if (r.message) {
      setSelected(new Set());
      setFormOpen(null);
      router.refresh();
    }
    return r;
  }, {});
  const e = state.fieldErrors ?? {};
  const [priceState, priceAction, pricePending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await updateBulkPricing(prev, fd);
    if (r.message) {
      setSelected(new Set());
      setFormOpen(null);
      router.refresh();
    }
    return r;
  }, {});
  const pe = priceState.fieldErrors ?? {};
  const message = state.message ?? priceState.message;

  const counted = rows.filter((r) => r.status !== "cancelled" && r.status !== "skipped");
  const totals = counted.reduce(
    (t, r) => ({
      charge: t.charge + r.chargeCents,
      fee: t.fee + r.feeCents,
      pay: t.pay + r.providerPayCents,
      profit: t.profit + r.profitCents,
    }),
    { charge: 0, fee: 0, pay: 0, profit: 0 },
  );

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      )}

      {live.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(ev) => setSelected(ev.target.checked ? new Set(live.map((r) => r.id)) : new Set())}
              className="accent-primary"
            />
            Select all ({live.length})
          </label>
          {payable.length > 0 && (
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allPayableSelected}
                onChange={(ev) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const r of payable)
                      if (ev.target.checked) next.add(r.id);
                      else next.delete(r.id);
                    return next;
                  })
                }
                className="accent-primary"
              />
              Where the client still owes ({payable.length})
            </label>
          )}
          <span className="text-muted-foreground">
            {chosen.length} selected
            {selectedRows.length > 0 && (
              <>
                {" "}
                · <span className="font-medium text-foreground tabular-nums">{formatCents(selectedTotal)}</span> owed
              </>
            )}
          </span>
          <span className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={formOpen === "pricing" ? "secondary" : "outline"}
              disabled={chosen.length === 0}
              onClick={() => setFormOpen((o) => (o === "pricing" ? null : "pricing"))}
            >
              Update pricing
            </Button>
            <Button
              size="sm"
              variant={formOpen === "payment" ? "secondary" : "default"}
              disabled={selectedRows.length === 0}
              onClick={() => setFormOpen((o) => (o === "payment" ? null : "payment"))}
            >
              Record client payment
            </Button>
          </span>
        </div>
      )}

      {formOpen === "pricing" && chosen.length > 0 && (
        <form action={priceAction} className="space-y-3 rounded-md border p-3">
          {chosen.map((r) => (
            <input key={r.id} type="hidden" name="job_ids" value={r.id} />
          ))}
          <p className="text-sm">
            Setting new amounts on {chosen.length} visit{chosen.length === 1 ? "" : "s"} for{" "}
            {[...new Set(chosen.map((r) => r.clientName))].join(", ")}. Leave a field blank to keep that amount as it
            is. Cleaner pay already included in a payout stays frozen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Client price per visit ($)"
              name="charge"
              inputMode="decimal"
              placeholder="keep current"
              error={pe.charge}
              autoComplete="off"
            />
            <TextField
              label="Cleaner pay per visit ($)"
              name="pay"
              inputMode="decimal"
              placeholder="keep current"
              error={pe.pay}
              autoComplete="off"
            />
          </div>
          <FormActions
            pending={pricePending}
            submitLabel={`Update ${chosen.length} visit${chosen.length === 1 ? "" : "s"}`}
            error={priceState.error}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(null)}>
            Cancel
          </Button>
        </form>
      )}

      {formOpen === "payment" && selectedRows.length > 0 && (
        <form action={action} className="space-y-3 rounded-md border p-3">
          {selectedRows.map((r) => (
            <input key={r.id} type="hidden" name="job_ids" value={r.id} />
          ))}
          <p className="text-sm">
            Recording <span className="font-medium tabular-nums">{formatCents(selectedTotal)}</span> across{" "}
            {selectedRows.length} visit
            {selectedRows.length === 1 ? "" : "s"} for {[...new Set(selectedRows.map((r) => r.clientName))].join(", ")}.
            Each visit is marked as paid by the client in full. For Stripe methods the fee is estimated per visit at
            Stripe&apos;s rate (card 2.9% + 30¢, ACH 0.8% capped at $5, invoices add 0.4%). (Paying your cleaners is
            separate, under Pay.)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Paid by"
              name="method"
              defaultValue={selectedRows[0]?.chargeMethod ?? "zelle"}
              error={e.method}
              options={PAYMENT_METHODS}
            />
            <TextField
              label="Date received"
              name="received_at"
              type="date"
              defaultValue={today}
              error={e.received_at}
              required
            />
            <TextField label="Confirmation / check #" name="external_ref" error={e.external_ref} autoComplete="off" />
          </div>
          <FormActions pending={pending} submitLabel={`Record ${formatCents(selectedTotal)}`} error={state.error} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(null)}>
            Cancel
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Client paid</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Fee</TableHead>
              <TableHead className="hidden sm:table-cell">Cleaner</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Pay</TableHead>
              <TableHead className="hidden sm:table-cell">Cleaner paid</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="hidden text-right md:table-cell">Margin</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
                  No visits in this range.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const unpaidDone = r.status === "done" && r.receivedCents < r.chargeCents;
              const noProfit = r.status === "cancelled" || r.status === "skipped";
              return (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell>
                    {!noProfit && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(ev) => toggle(r.id, ev.target.checked)}
                        className="accent-primary"
                        aria-label={`Select ${r.clientName} on ${r.when}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/jobs/${r.id}`} className="hover:underline">
                      {r.when}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    <Link href={`/clients/${r.clientId}`} className="hover:underline">
                      {r.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(r.chargeCents)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {formatCents(r.receivedCents)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {formatCents(r.feeCents)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.providerNames ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatCents(r.providerPayCents)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.providerPayCents === 0 ? (
                      "—"
                    ) : r.providerUnpaid ? (
                      <span className="text-amber-700">Unpaid</span>
                    ) : (
                      "Paid"
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${r.profitCents < 0 ? "text-destructive" : ""}`}>
                    {noProfit ? "—" : formatCents(r.profitCents)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {r.marginPct != null && !noProfit ? `${r.marginPct}%` : "—"}
                  </TableCell>
                  <TableCell>
                    {unpaidDone ? (
                      <span className="inline-flex items-center rounded-md border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-900">
                        Done · client owes
                      </span>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {rows.length > 0 && (
            <tfoot className="border-t bg-muted/40 text-sm font-medium">
              <tr>
                <td className="px-2 py-2" colSpan={4}>
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
    </div>
  );
}

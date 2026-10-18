"use client";

import { useActionState, useState } from "react";
import { FormActions, SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormState } from "@/lib/forms";
import { assignProvider, cancelJob, recordPayment } from "@/app/(owner)/jobs/actions";

export function AssignForm({
  jobId,
  providers,
  exclude,
}: {
  jobId: string;
  providers: { id: string; name: string; default_pay_cents: number | null }[];
  exclude: string[];
}) {
  const available = providers.filter((p) => !exclude.includes(p.id));
  const [state, action, pending] = useActionState<FormState, FormData>(assignProvider.bind(null, jobId), {});
  const [providerId, setProviderId] = useState(available[0]?.id ?? "");
  const provider = available.find((p) => p.id === providerId);
  if (available.length === 0) return null;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-3">
      <div className="space-y-1.5">
        <label htmlFor="assign-provider" className="text-sm font-medium">
          Add cleaner
        </label>
        <select
          id="assign-provider"
          name="provider_id"
          value={providerId}
          onChange={(ev) => setProviderId(ev.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <TextField
        key={providerId}
        label="Pay"
        name="pay_cents"
        inputMode="decimal"
        defaultValue={provider?.default_pay_cents != null ? (provider.default_pay_cents / 100).toFixed(2) : ""}
        error={e.pay_cents}
        wrapperClassName="w-28"
        required
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Assign"}
      </Button>
      {state.error && !state.fieldErrors && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function CancelJobForm({ jobId, hasAssignments }: { jobId: string; hasAssignments: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(cancelJob.bind(null, jobId), {});
  const e = state.fieldErrors ?? {};

  if (!open) {
    return (
      <Button variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        Cancel this visit…
      </Button>
    );
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Cancel this visit</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <TextField
            label="Reason"
            name="reason"
            error={e.reason}
            required
            autoFocus
            placeholder="Client rescheduled, sick, weather…"
          />
          {hasAssignments && (
            <TextField
              label="Pay the cleaner a cancellation fee?"
              name="fee_cents"
              inputMode="decimal"
              placeholder="0.00"
              error={e.fee_cents}
              hint="Usually $0. A fee shows up in what you owe them."
            />
          )}
          <FormActions pending={pending} submitLabel="Cancel visit" error={state.error} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep it
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const PAYMENT_METHODS = [
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "stripe_card", label: "Card (Stripe)" },
  { value: "stripe_ach", label: "ACH (Stripe)" },
  { value: "stripe_invoice", label: "Stripe invoice" },
];

export function RecordPaymentForm({
  jobId,
  outstandingCents,
  defaultMethod,
  today,
  onRecorded,
}: {
  jobId: string;
  outstandingCents: number;
  defaultMethod: string | null;
  today: string;
  /** Called after a successful save, e.g. to refresh a parent list. */
  onRecorded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await recordPayment(jobId, prev, fd);
    if (!r.error && !r.fieldErrors) {
      setOpen(false);
      onRecorded?.();
    }
    return r;
  }, {});
  const e = state.fieldErrors ?? {};

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Record client payment
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Amount"
          name="amount_cents"
          inputMode="decimal"
          defaultValue={(Math.max(outstandingCents, 0) / 100).toFixed(2)}
          error={e.amount_cents}
          required
          autoFocus
        />
        <SelectField
          label="Paid by"
          name="method"
          defaultValue={
            defaultMethod && PAYMENT_METHODS.some((m) => m.value === defaultMethod) ? defaultMethod : "zelle"
          }
          error={e.method}
          options={PAYMENT_METHODS}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Date received"
          name="received_at"
          type="date"
          defaultValue={today}
          error={e.received_at}
          required
        />
        <TextField
          label="Confirmation / check #"
          name="external_ref"
          error={e.external_ref}
          placeholder="Zelle confirmation, check number"
          autoComplete="off"
        />
      </div>
      <TextField
        label="Processing fee (if card)"
        name="fee_cents"
        inputMode="decimal"
        placeholder="0.00"
        error={e.fee_cents}
        hint="Leave blank for Zelle, check, cash or Venmo."
      />
      <FormActions pending={pending} submitLabel="Record client payment" error={state.error} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { FormActions, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];

const CATEGORIES = [
  { value: "overhead", label: "Overhead" },
  { value: "software", label: "Software" },
  { value: "ads", label: "Advertising" },
  { value: "supplies", label: "Supplies" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];
const CADENCES = [
  { value: "one_time", label: "One time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export function ExpenseForm({
  action,
  expense,
  defaultDate,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  expense?: Expense;
  defaultDate: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <TextField
        label="Name"
        name="name"
        defaultValue={expense?.name}
        error={e.name}
        required
        autoFocus
        placeholder="Gas, Thimble, BookingKoala…"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Date paid"
          name="paid_at"
          type="date"
          defaultValue={expense?.paid_at ?? defaultDate}
          error={e.paid_at}
          required
        />
        <TextField
          label="Amount"
          name="amount_cents"
          inputMode="decimal"
          defaultValue={expense ? (expense.amount_cents / 100).toFixed(2) : ""}
          error={e.amount_cents}
          required
        />
        <SelectField
          label="Category"
          name="category"
          defaultValue={expense?.category ?? "overhead"}
          error={e.category}
          options={CATEGORIES}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Paid with"
          name="paid_with"
          defaultValue={expense?.paid_with ?? ""}
          error={e.paid_with}
          placeholder="chase card 7714"
        />
        <TextField
          label="Platform / vendor"
          name="platform"
          defaultValue={expense?.platform ?? ""}
          error={e.platform}
        />
        <SelectField
          label="Recurs"
          name="cadence"
          defaultValue={expense?.cadence ?? "one_time"}
          error={e.cadence}
          options={CADENCES}
        />
      </div>
      <TextAreaField label="Notes" name="notes" rows={2} defaultValue={expense?.notes ?? ""} error={e.notes} />
      <FormActions
        pending={pending}
        submitLabel={expense ? "Save expense" : "Add expense"}
        error={state.error}
        cancelHref={cancelHref}
      />
    </form>
  );
}

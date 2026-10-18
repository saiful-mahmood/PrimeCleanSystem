"use client";

import { useActionState } from "react";
import { FormActions, SelectField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import { markPayoutPaid } from "@/app/(owner)/pay/actions";

export function MarkPaidForm({ payoutId }: { payoutId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(markPayoutPaid.bind(null, payoutId), {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <TextField
        label="Zelle confirmation number"
        name="reference"
        error={e.reference}
        required
        autoFocus
        autoComplete="off"
        placeholder="e.g. JPM99a1b2c3"
      />
      <SelectField
        label="Sent via"
        name="method"
        defaultValue="zelle"
        options={[
          { value: "zelle", label: "Zelle" },
          { value: "cash", label: "Cash" },
          { value: "check", label: "Check" },
          { value: "other", label: "Other" },
        ]}
      />
      <TextField label="Notes" name="notes" error={e.notes} />
      <FormActions pending={pending} submitLabel="Mark paid" error={state.error} />
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { CheckboxField, FormActions, TextAreaField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import type { Provider } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  provider?: Provider;
  cancelHref: string;
};

export function ProviderForm({ action, provider, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const pay = provider?.default_pay_cents != null ? (provider.default_pay_cents / 100).toFixed(2) : "";

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <TextField label="Name" name="name" defaultValue={provider?.name} error={e.name} required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={provider?.phone ?? ""}
          error={e.phone}
        />
        <TextField label="Email" name="email" type="email" defaultValue={provider?.email ?? ""} error={e.email} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Zelle handle"
          name="zelle_handle"
          defaultValue={provider?.zelle_handle ?? ""}
          error={e.zelle_handle}
          hint="Phone or email they receive Zelle at."
        />
        <TextField
          label="Default pay per job"
          name="default_pay_cents"
          inputMode="decimal"
          placeholder="120.00"
          defaultValue={pay}
          error={e.default_pay_cents}
          hint="Dollars. Pre-fills new assignments."
        />
      </div>
      <TextField
        label="Service area"
        name="service_area"
        defaultValue={provider?.service_area ?? ""}
        error={e.service_area}
      />
      <TextAreaField label="Notes" name="notes" defaultValue={provider?.notes ?? ""} error={e.notes} rows={3} />
      <div className="space-y-3">
        <CheckboxField label="W-9 on file" name="w9_on_file" defaultChecked={provider?.w9_on_file ?? false} />
        <CheckboxField
          label="Active"
          name="active"
          defaultChecked={provider?.active ?? true}
          hint="Inactive cleaners are hidden when assigning jobs."
        />
      </div>
      <FormActions
        pending={pending}
        submitLabel={provider ? "Save changes" : "Add cleaner"}
        error={state.error}
        cancelHref={cancelHref}
      />
    </form>
  );
}

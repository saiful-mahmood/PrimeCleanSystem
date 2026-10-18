"use client";

import { useActionState } from "react";
import { FormActions, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import { CHARGE_METHODS, type Client } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  cancelHref: string;
};

export function ClientForm({ action, client, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <TextField label="Name" name="name" defaultValue={client?.name} error={e.name} required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Type"
          name="type"
          defaultValue={client?.type ?? "residential"}
          error={e.type}
          options={[
            { value: "residential", label: "Residential" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={client?.status ?? "active"}
          error={e.status}
          options={[
            { value: "active", label: "Active" },
            { value: "lead", label: "Lead" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={client?.phone ?? ""}
          error={e.phone}
        />
        <TextField label="Email" name="email" type="email" defaultValue={client?.email ?? ""} error={e.email} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Usually pays by"
          name="default_charge_method"
          defaultValue={client?.default_charge_method ?? ""}
          error={e.default_charge_method}
          allowEmpty="Not set"
          options={CHARGE_METHODS}
        />
        <TextField
          label="Source"
          name="source"
          placeholder="Referral, Google, Yelp…"
          defaultValue={client?.source ?? ""}
          error={e.source}
        />
      </div>
      <TextAreaField
        label="Basic info"
        name="basic_info"
        rows={2}
        defaultValue={client?.basic_info ?? ""}
        error={e.basic_info}
        hint="Business category, who to call, anything you'd want on the first screen."
      />
      <TextAreaField label="Notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} error={e.notes} />
      <FormActions
        pending={pending}
        submitLabel={client ? "Save changes" : "Add client"}
        error={state.error}
        cancelHref={cancelHref}
      />
    </form>
  );
}

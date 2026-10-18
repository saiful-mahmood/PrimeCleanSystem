"use client";

import { useActionState } from "react";
import { CheckboxField, FormActions, TextAreaField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import type { LocationPublic } from "@/lib/types";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  location?: LocationPublic;
  cancelHref: string;
};

export function LocationForm({ action, location, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-xl space-y-4" autoComplete="off">
      <TextField
        label="Label"
        name="label"
        defaultValue={location?.label ?? "Main"}
        error={e.label}
        required
        hint="Home, Office, Unit 2B…"
      />
      <TextField
        label="Address"
        name="address_line1"
        defaultValue={location?.address_line1 ?? ""}
        error={e.address_line1}
        autoComplete="street-address"
      />
      <TextField
        label="Address line 2"
        name="address_line2"
        defaultValue={location?.address_line2 ?? ""}
        error={e.address_line2}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_5rem_7rem]">
        <TextField label="City" name="city" defaultValue={location?.city ?? ""} error={e.city} />
        <TextField label="State" name="state" defaultValue={location?.state ?? "MA"} error={e.state} maxLength={2} />
        <TextField
          label="ZIP"
          name="postal_code"
          inputMode="numeric"
          defaultValue={location?.postal_code ?? ""}
          error={e.postal_code}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField label="Sq ft" name="sqft" inputMode="numeric" defaultValue={location?.sqft ?? ""} error={e.sqft} />
        <TextField
          label="Bedrooms"
          name="bedrooms"
          inputMode="decimal"
          defaultValue={location?.bedrooms ?? ""}
          error={e.bedrooms}
        />
        <TextField
          label="Bathrooms"
          name="bathrooms"
          inputMode="decimal"
          defaultValue={location?.bathrooms ?? ""}
          error={e.bathrooms}
        />
      </div>
      <TextAreaField
        label="Scope of work"
        name="scope_of_work"
        rows={3}
        defaultValue={location?.scope_of_work ?? ""}
        error={e.scope_of_work}
      />
      <TextAreaField
        label="Access notes"
        name="access_notes"
        rows={2}
        defaultValue={location?.access_notes ?? ""}
        error={e.access_notes}
        hint="Parking, alarm, pets. Not the code itself."
      />

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Lockbox</legend>
        <TextField
          label="Where it is"
          name="lockbox_hint"
          defaultValue={location?.lockbox_hint ?? ""}
          error={e.lockbox_hint}
          placeholder="On the back gate"
        />
        <TextField
          label={location?.has_lockbox ? "New code" : "Code"}
          name="lockbox_code"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          error={e.lockbox_code}
          hint={
            location?.has_lockbox
              ? "A code is stored. Leave blank to keep it; type a new one to replace it."
              : "Stored encrypted. Shown only via Reveal, which is logged."
          }
        />
        {location?.has_lockbox && <CheckboxField label="Remove the stored code" name="clear_lockbox" />}
      </fieldset>

      <FormActions
        pending={pending}
        submitLabel={location ? "Save location" : "Add location"}
        error={state.error}
        cancelHref={cancelHref}
      />
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { FormActions, SelectField, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import { createQuote } from "@/app/(owner)/quotes/actions";

export function NewQuoteForm({
  clients,
  today,
}: {
  clients: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createQuote, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-2xl space-y-4">
      <SelectField
        label="Existing client (optional)"
        name="client_id"
        allowEmpty="New client — type the details below"
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
        hint="Pick one to attach the quote to their record; the details below are still what prints on the quote."
      />
      <TextField
        label="Client / organization name"
        name="name"
        error={e.name}
        required
        autoFocus
        placeholder="Islamic Center of Boston"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Street address"
          name="address_line1"
          error={e.address_line1}
          placeholder="126 Boston Post Road"
        />
        <TextField
          label="City, State ZIP"
          name="address_line2"
          error={e.address_line2}
          placeholder="Wayland, Massachusetts 01778"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Contact name" name="contact_name" error={e.contact_name} />
        <TextField label="Contact email" name="email" type="email" error={e.email} />
        <TextField label="Contact phone" name="phone" type="tel" error={e.phone} />
      </div>
      <TextField
        label="Additional email recipients"
        name="extra_emails"
        error={e.extra_emails}
        hint="Optional, comma-separated."
      />
      <TextField
        label="Quote date"
        name="quote_date"
        type="date"
        defaultValue={today}
        error={e.quote_date}
        required
        wrapperClassName="max-w-xs"
      />
      <FormActions pending={pending} submitLabel="Create quote" error={state.error} cancelHref="/quotes" />
    </form>
  );
}

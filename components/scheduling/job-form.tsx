"use client";

import { useActionState } from "react";
import { FormActions, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import type { SchedulingOptions } from "@/lib/scheduling/options";
import { ProviderFields, VisitFields, type VisitDefaults } from "./visit-fields";

export function JobForm({
  action,
  options,
  defaults,
  cancelHref,
  submitLabel,
  mode,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  options: SchedulingOptions;
  defaults: VisitDefaults & { date?: string };
  cancelHref: string;
  submitLabel: string;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <TextField label="Date" name="date" type="date" defaultValue={defaults.date} error={e.date} required />
      <VisitFields options={options} defaults={defaults} errors={e} lockClient={mode === "edit"} />
      {mode === "create" && <ProviderFields options={options} defaults={defaults} errors={e} />}
      <FormActions pending={pending} submitLabel={submitLabel} error={state.error} cancelHref={cancelHref} />
    </form>
  );
}

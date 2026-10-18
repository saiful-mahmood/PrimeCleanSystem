"use client";

import { useActionState, useState } from "react";
import { CheckboxField, FormActions, TextField } from "@/components/forms/fields";
import type { FormState } from "@/lib/forms";
import type { SchedulingOptions } from "@/lib/scheduling/options";
import { WEEKDAYS, type Frequency, type WeekdayCode } from "@/lib/rrule";
import { ProviderFields, VisitFields, type VisitDefaults } from "./visit-fields";

export type SeriesDefaults = VisitDefaults & {
  frequency?: Frequency;
  weekdays?: WeekdayCode[];
  start_date?: string;
  end_date?: string | null;
  active?: boolean;
};

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "every4weeks", label: "Every 4 weeks" },
  { value: "monthly_day", label: "Monthly, same day of month" },
  { value: "monthly_weekday", label: "Monthly, same weekday (e.g. 2nd Tuesday)" },
];

export function SeriesForm({
  action,
  options,
  defaults,
  cancelHref,
  submitLabel,
  lockStart = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  options: SchedulingOptions;
  defaults: SeriesDefaults;
  cancelHref: string;
  submitLabel: string;
  lockStart?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const [frequency, setFrequency] = useState<Frequency>(defaults.frequency ?? "weekly");
  const weekly = frequency === "weekly" || frequency === "biweekly" || frequency === "every4weeks";

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Visit</h2>
        <VisitFields options={options} defaults={defaults} errors={e} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Repeats</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="frequency" className="text-sm font-medium">
              Frequency
            </label>
            <select
              id="frequency"
              name="frequency"
              value={frequency}
              onChange={(ev) => setFrequency(ev.target.value as Frequency)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label={lockStart ? "Changes take effect from" : "First visit"}
            name="start_date"
            type="date"
            defaultValue={defaults.start_date}
            error={e.start_date}
            required
            readOnly={lockStart}
            hint={weekly ? undefined : "Monthly rules use this date's day of month or weekday."}
          />
        </div>
        {weekly && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">On these days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.code}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm has-checked:border-primary has-checked:bg-accent"
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={d.code}
                    defaultChecked={defaults.weekdays?.includes(d.code)}
                    className="accent-primary"
                  />
                  {d.short}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Leave all unchecked to use the first visit&apos;s weekday.</p>
            {e.weekdays && <p className="text-xs text-destructive">{e.weekdays}</p>}
          </fieldset>
        )}
        <TextField
          label="Last visit (optional)"
          name="end_date"
          type="date"
          defaultValue={defaults.end_date ?? ""}
          error={e.end_date}
          hint="Leave blank for an open-ended series."
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Default cleaner</h2>
        <ProviderFields options={options} defaults={defaults} errors={e} label="Usually done by" />
        <p className="text-xs text-muted-foreground">
          Each generated visit is offered to this cleaner at this pay; you can change either per visit.
        </p>
      </section>

      {defaults.active !== undefined && (
        <CheckboxField
          label="Active"
          name="active"
          defaultChecked={defaults.active}
          hint="Inactive series stop generating visits."
        />
      )}
      {defaults.active === undefined && <input type="hidden" name="active" value="on" />}

      <FormActions pending={pending} submitLabel={submitLabel} error={state.error} cancelHref={cancelHref} />
    </form>
  );
}

import { z } from "zod";
import { checkbox, optionalDollars, optionalText, requiredText } from "@/lib/forms";
import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type JobStatus = Enums["job_status"];
export type AssignmentStatus = Enums["assignment_status"];

export const JOB_STATUSES: { value: JobStatus; label: string; color: string }[] = [
  { value: "scheduled", label: "Scheduled", color: "bg-sky-100 text-sky-900 border-sky-200" },
  { value: "confirmed", label: "Confirmed", color: "bg-indigo-100 text-indigo-900 border-indigo-200" },
  { value: "in_progress", label: "In progress", color: "bg-amber-100 text-amber-900 border-amber-200" },
  { value: "done", label: "Done", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-rose-100 text-rose-900 border-rose-200 line-through" },
  { value: "skipped", label: "Skipped", color: "bg-neutral-100 text-neutral-600 border-neutral-200 line-through" },
];

export function statusMeta(status: JobStatus) {
  return JOB_STATUSES.find((s) => s.value === status) ?? JOB_STATUSES[0];
}

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  offered: "Offered",
  accepted: "Accepted",
  declined: "Declined",
  done: "Done",
  no_show: "No-show",
  cancelled_paid: "Cancelled, paid fee",
};

export const uuid = z.string().uuid("Pick one.");
export const localDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
export const localTimeField = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a time.");

export const requiredDollars = (label: string) =>
  optionalDollars.transform((v, ctx) => {
    if (v === null) {
      ctx.addIssue({ code: "custom", message: `${label} is required.` });
      return z.NEVER;
    }
    return v;
  });

export const durationField = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 15 || n > 24 * 60) {
      ctx.addIssue({ code: "custom", message: "Duration in minutes, 15 to 1440." });
      return z.NEVER;
    }
    return n;
  });

export const chargeMethodField = z
  .string()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.enum(["stripe_card", "stripe_ach", "stripe_invoice", "zelle", "check", "cash", "venmo"]).nullable());

/** Fields common to a one-off job and a series. */
export const visitFields = {
  client_id: uuid,
  location_id: uuid,
  service_type_id: uuid,
  start_time: localTimeField,
  duration_min: durationField,
  charge_cents: requiredDollars("Charge"),
  charge_method: chargeMethodField,
  notes: optionalText,
};

export const providerFields = {
  provider_id: z
    .string()
    .transform((s) => (s === "" ? null : s))
    .pipe(uuid.nullable()),
  provider_pay_cents: optionalDollars,
};

export const seriesSchema = z.object({
  ...visitFields,
  ...providerFields,
  frequency: z.enum(["weekly", "biweekly", "every4weeks", "monthly_day", "monthly_weekday"]),
  weekdays: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).default([]),
  start_date: localDateField,
  end_date: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .pipe(localDateField.nullable()),
  active: checkbox.default(true),
});

export const jobSchema = z.object({
  ...visitFields,
  ...providerFields,
  date: localDateField,
});

export const jobEditSchema = z.object({
  service_type_id: uuid,
  date: localDateField,
  start_time: localTimeField,
  duration_min: durationField,
  charge_cents: requiredDollars("Charge"),
  charge_method: chargeMethodField,
  notes: optionalText,
  location_id: uuid,
});

export const assignSchema = z.object({
  provider_id: uuid,
  pay_cents: requiredDollars("Pay"),
});

export const cancelSchema = z.object({
  reason: requiredText("Reason"),
  fee_cents: optionalDollars,
});

export const paymentSchema = z.object({
  method: z.enum(["zelle", "check", "cash", "venmo", "stripe_card", "stripe_ach", "stripe_invoice"]),
  amount_cents: requiredDollars("Amount"),
  fee_cents: optionalDollars,
  received_at: localDateField,
  external_ref: optionalText,
  notes: optionalText,
});

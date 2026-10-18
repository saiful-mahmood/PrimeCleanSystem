import { z } from "zod";
import { parseDollars } from "@/lib/money";

/** Shared shape for form server actions used with useActionState. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const OK: FormState = {};

/** Turn a zod failure into per-field messages plus a summary. */
export function fromZod(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Please fix the highlighted fields.", fieldErrors };
}

/** Empty strings from inputs become null. */
export const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);

export const optionalEmail = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.string().email("Enter a valid email.").nullable())
  .transform((v) => v ?? null);

/** Digits only; keeps a leading +. */
export const optionalPhone = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s.replace(/[^\d+]/g, "")))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Dollar text ("$120", "120.50") to integer cents; blank is null. */
export const optionalDollars = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const cents = parseDollars(s);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a dollar amount like 120 or 120.50." });
      return z.NEVER;
    }
    return cents;
  });

export const optionalInt = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number." });
      return z.NEVER;
    }
    return n;
  });

/** "2.5" style numbers for bedrooms and bathrooms. */
export const optionalHalfStep = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || Math.round(n * 2) !== n * 2) {
      ctx.addIssue({ code: "custom", message: "Use whole or half numbers, like 2 or 2.5." });
      return z.NEVER;
    }
    return n;
  });

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Pull plain string values out of a FormData for zod. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

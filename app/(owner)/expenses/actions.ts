"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formValues, fromZod, optionalText, requiredText, type FormState } from "@/lib/forms";
import { requiredDollars, localDateField } from "@/lib/scheduling/shared";

// Not exported: a "use server" module may only export async functions.
const EXPENSE_CATEGORIES = ["overhead", "software", "ads", "supplies", "insurance", "other"] as const;
const EXPENSE_CADENCES = ["one_time", "weekly", "monthly", "quarterly", "annual"] as const;

const schema = z.object({
  name: requiredText("Name"),
  category: z.enum(EXPENSE_CATEGORIES),
  paid_at: localDateField,
  amount_cents: requiredDollars("Amount"),
  paid_with: optionalText,
  platform: optionalText,
  cadence: z.enum(EXPENSE_CADENCES),
  notes: optionalText,
});

function revalidateExpenses(id?: string) {
  revalidatePath("/expenses");
  revalidatePath("/");
  if (id) revalidatePath(`/expenses/${id}/edit`);
}

export async function createExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert(parsed.data);
  if (error) return { error: error.message };
  revalidateExpenses();
  redirect(`/expenses?month=${parsed.data.paid_at.slice(0, 7)}`);
}

export async function updateExpense(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidateExpenses(id);
  redirect(`/expenses?month=${parsed.data.paid_at.slice(0, 7)}`);
}

export async function deleteExpense(id: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: e } = await supabase.from("expenses").select("name, amount_cents, paid_at").eq("id", id).maybeSingle();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await supabase
    .from("audit_log")
    .insert({ actor: "owner", action: "expense.delete", entity: "expense", entity_id: id, meta: e ?? {} });
  revalidateExpenses();
}

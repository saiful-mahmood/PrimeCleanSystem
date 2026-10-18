"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  checkbox,
  formValues,
  fromZod,
  optionalDollars,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
  type FormState,
} from "@/lib/forms";

const providerSchema = z.object({
  name: requiredText("Name"),
  phone: optionalPhone,
  email: optionalEmail,
  zelle_handle: optionalText,
  default_pay_cents: optionalDollars,
  service_area: optionalText,
  w9_on_file: checkbox,
  active: checkbox,
  notes: optionalText,
});

export async function createProvider(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = providerSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("providers").insert(parsed.data).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/providers");
  redirect(`/providers/${data.id}`);
}

export async function updateProvider(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = providerSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("providers").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/providers");
  revalidatePath(`/providers/${id}`);
  redirect(`/providers/${id}`);
}

export async function setProviderActive(id: string, active: boolean) {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("providers").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/providers");
  revalidatePath(`/providers/${id}`);
}

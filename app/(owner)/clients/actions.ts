"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  checkbox,
  formValues,
  fromZod,
  optionalEmail,
  optionalHalfStep,
  optionalInt,
  optionalPhone,
  optionalText,
  requiredText,
  type FormState,
} from "@/lib/forms";
import { CHARGE_METHODS, CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/types";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  name: requiredText("Name"),
  type: z.enum(CLIENT_TYPES as [string, ...string[]]),
  status: z.enum(CLIENT_STATUSES as [string, ...string[]]),
  email: optionalEmail,
  phone: optionalPhone,
  default_charge_method: z
    .string()
    .transform((s) => (s === "" ? null : s))
    .pipe(z.enum(CHARGE_METHODS.map((m) => m.value) as [string, ...string[]]).nullable()),
  source: optionalText,
  basic_info: optionalText,
  notes: optionalText,
});

type ClientInput = z.infer<typeof clientSchema>;

function toClientRow(d: ClientInput) {
  return {
    ...d,
    type: d.type as (typeof CLIENT_TYPES)[number],
    status: d.status as (typeof CLIENT_STATUSES)[number],
    default_charge_method: d.default_charge_method as (typeof CHARGE_METHODS)[number]["value"] | null,
  };
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = clientSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(toClientRow(parsed.data)).select("id").single();
  if (error) return { error: error.message };

  // Every client gets a "Main" location so there is somewhere to put the address.
  await supabase.from("locations").insert({ client_id: data.id, label: "Main" });

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = clientSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(toClientRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

// ---------------------------------------------------------------------------
// Locations (lockbox code is encrypted here and only ever decrypted in
// revealLockbox; it never goes back to the browser any other way)
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  label: requiredText("Label"),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  sqft: optionalInt,
  bedrooms: optionalHalfStep,
  bathrooms: optionalHalfStep,
  scope_of_work: optionalText,
  access_notes: optionalText,
  lockbox_hint: optionalText,
  lockbox_code: z.string().trim().optional().default(""),
  clear_lockbox: checkbox,
});

export async function createLocationAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = locationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { lockbox_code, ...rest } = parsed.data;
  const { clear_lockbox: _unused, ...fields } = rest;
  void _unused;

  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({
    ...fields,
    client_id: clientId,
    lockbox_code_enc: lockbox_code ? encryptSecret(lockbox_code) : null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function updateLocationAction(
  locationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = locationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { lockbox_code, clear_lockbox, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("locations").select("client_id").eq("id", locationId).maybeSingle();
  if (!existing) return { error: "Location not found." };

  // Blank code = keep what is stored; "clear" removes it; a new code replaces it.
  const lockboxPatch = clear_lockbox
    ? { lockbox_code_enc: null }
    : lockbox_code
      ? { lockbox_code_enc: encryptSecret(lockbox_code) }
      : {};

  const { error } = await supabase
    .from("locations")
    .update({ ...fields, ...lockboxPatch })
    .eq("id", locationId);
  if (error) return { error: error.message };

  if (clear_lockbox || lockbox_code) {
    await supabase.from("audit_log").insert({
      actor: "owner",
      action: clear_lockbox ? "lockbox.clear" : "lockbox.set",
      entity: "location",
      entity_id: locationId,
      meta: { client_id: existing.client_id },
    });
  }

  revalidatePath(`/clients/${existing.client_id}`);
  redirect(`/clients/${existing.client_id}`);
}

export async function deleteLocationAction(locationId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: loc } = await supabase.from("locations").select("client_id").eq("id", locationId).maybeSingle();
  if (!loc) return;
  const { error } = await supabase.from("locations").delete().eq("id", locationId);
  if (error) {
    // Jobs reference locations with ON DELETE RESTRICT; tell the owner plainly.
    throw new Error("This location has jobs attached and cannot be deleted.");
  }
  revalidatePath(`/clients/${loc.client_id}`);
}

/**
 * Decrypt a lockbox code for the owner and record that it happened.
 * Returns the code only in this response; it is never logged.
 */
export async function revealLockbox(locationId: string): Promise<{ code: string | null; error?: string }> {
  await requireOwner();
  const supabase = await createClient();
  const { data: loc, error } = await supabase
    .from("locations")
    .select("client_id, lockbox_code_enc")
    .eq("id", locationId)
    .maybeSingle();
  if (error || !loc) return { code: null, error: "Location not found." };
  if (!loc.lockbox_code_enc) return { code: null };

  let code: string;
  try {
    code = decryptSecret(loc.lockbox_code_enc);
  } catch {
    return { code: null, error: "Could not decrypt this code. Was LOCKBOX_ENC_KEY changed?" };
  }

  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "lockbox.reveal",
    entity: "location",
    entity_id: locationId,
    meta: { client_id: loc.client_id },
  });

  return { code };
}

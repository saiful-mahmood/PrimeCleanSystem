"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formValues, fromZod, requiredText, type FormState } from "@/lib/forms";

function revalidatePay(payoutId?: string) {
  revalidatePath("/pay");
  revalidatePath("/providers");
  revalidatePath("/jobs");
  revalidatePath("/");
  if (payoutId) revalidatePath(`/pay/${payoutId}`);
}

/**
 * Step 1 of paying a cleaner: draft a payout and attach the chosen
 * assignments. The DB trigger refuses assignments of another provider or
 * ones already in a paid batch, so this cannot double-pay even if the UI is
 * wrong. Nothing is "paid" until markPayoutPaid.
 */
export async function createPayoutDraft(providerId: string, assignmentIds: string[]): Promise<{ error?: string }> {
  await requireOwner();
  if (assignmentIds.length === 0) return { error: "Select at least one job." };
  const supabase = await createClient();

  // Only unpaid, done (or fee-bearing cancelled) assignments of this provider.
  const { data: eligible, error: eErr } = await supabase
    .from("job_assignments")
    .select("id")
    .eq("provider_id", providerId)
    .is("payout_id", null)
    .in("status", ["done", "cancelled_paid"])
    .in("id", assignmentIds);
  if (eErr) return { error: eErr.message };
  const ids = (eligible ?? []).map((a) => a.id);
  if (ids.length !== assignmentIds.length) {
    return {
      error: "Some of those jobs are no longer payable (already in a payout or not done). Refresh and try again.",
    };
  }

  const { data: payout, error } = await supabase
    .from("payouts")
    .insert({ provider_id: providerId, method: "zelle" })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: attachErr } = await supabase.from("job_assignments").update({ payout_id: payout.id }).in("id", ids);
  if (attachErr) {
    await supabase.from("payouts").delete().eq("id", payout.id);
    return { error: attachErr.message };
  }

  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "payout.draft",
    entity: "payout",
    entity_id: payout.id,
    meta: { provider_id: providerId, assignment_ids: ids },
  });
  revalidatePay(payout.id);
  redirect(`/pay/${payout.id}`);
}

const paidSchema = z.object({
  reference: requiredText("Zelle confirmation number"),
  method: z.enum(["zelle", "cash", "check", "other"]).default("zelle"),
  notes: z.string().trim().optional(),
});

/** Step 2: the owner has sent the money. Freeze the batch. */
export async function markPayoutPaid(payoutId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = paidSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: payout } = await supabase
    .from("payouts")
    .select("paid_at, total_cents")
    .eq("id", payoutId)
    .maybeSingle();
  if (!payout) return { error: "Payout not found." };
  if (payout.paid_at) return { error: "This payout is already marked paid." };
  if (payout.total_cents === 0) return { error: "This payout has no jobs attached." };

  const { error } = await supabase
    .from("payouts")
    .update({
      paid_at: new Date().toISOString(),
      reference: parsed.data.reference,
      method: parsed.data.method,
      notes: parsed.data.notes || null,
    })
    .eq("id", payoutId)
    .is("paid_at", null);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "payout.paid",
    entity: "payout",
    entity_id: payoutId,
    meta: { total_cents: payout.total_cents, reference: parsed.data.reference, method: parsed.data.method },
  });
  revalidatePay(payoutId);
  return {};
}

/** Abandon a draft: detach its assignments (they become owed again) and delete the empty batch. */
export async function cancelPayoutDraft(payoutId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: payout } = await supabase.from("payouts").select("paid_at").eq("id", payoutId).maybeSingle();
  if (!payout) return;
  if (payout.paid_at) throw new Error("A paid payout cannot be cancelled.");
  await supabase.from("job_assignments").update({ payout_id: null }).eq("payout_id", payoutId);
  const { error } = await supabase.from("payouts").delete().eq("id", payoutId);
  if (error) throw new Error(error.message);
  await supabase
    .from("audit_log")
    .insert({ actor: "owner", action: "payout.draft_cancelled", entity: "payout", entity_id: payoutId });
  revalidatePay();
  redirect("/pay");
}

/** Remove one assignment from a draft. */
export async function detachFromDraft(payoutId: string, assignmentId: string) {
  await requireOwner();
  const supabase = await createClient();
  // The trigger blocks this when the payout is already paid; surface that plainly.
  const { error } = await supabase
    .from("job_assignments")
    .update({ payout_id: null })
    .eq("id", assignmentId)
    .eq("payout_id", payoutId);
  if (error) throw new Error(error.message);
  revalidatePay(payoutId);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formValues, fromZod, type FormState } from "@/lib/forms";
import { assignSchema, cancelSchema, jobEditSchema, jobSchema, paymentSchema } from "@/lib/scheduling/shared";
import { localDate, localTime, localToInstant } from "@/lib/tz";
import type { Json } from "@/lib/database.types";

function revalidateJob(jobId?: string) {
  revalidatePath("/calendar");
  revalidatePath("/jobs");
  revalidatePath("/");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  jobId: string,
  meta: Record<string, Json> = {},
) {
  await supabase.from("audit_log").insert({ actor: "owner", action, entity: "job", entity_id: jobId, meta });
}

export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = jobSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      client_id: d.client_id,
      location_id: d.location_id,
      service_type_id: d.service_type_id,
      scheduled_start: localToInstant(d.date, d.start_time).toISOString(),
      duration_min: d.duration_min,
      charge_cents: d.charge_cents,
      charge_method: d.charge_method,
      notes: d.notes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (d.provider_id) {
    await supabase.from("job_assignments").insert({
      job_id: job.id,
      provider_id: d.provider_id,
      pay_cents: d.provider_pay_cents ?? 0,
      status: "offered",
    });
  }
  revalidateJob();
  redirect(`/jobs/${job.id}`);
}

/** "Edit this one": change the visit in place (rule 3: history is in audit_log). */
export async function updateJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = jobEditSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("jobs")
    .select("scheduled_start, charge_cents")
    .eq("id", jobId)
    .maybeSingle();
  if (!before) return { error: "Job not found." };

  const scheduled_start = localToInstant(d.date, d.start_time).toISOString();
  const { error } = await supabase
    .from("jobs")
    .update({
      service_type_id: d.service_type_id,
      location_id: d.location_id,
      scheduled_start,
      duration_min: d.duration_min,
      charge_cents: d.charge_cents,
      charge_method: d.charge_method,
      notes: d.notes,
    })
    .eq("id", jobId);
  if (error) return { error: error.message };

  if (before.scheduled_start !== scheduled_start) {
    await audit(supabase, "job.reschedule", jobId, { from: before.scheduled_start, to: scheduled_start });
  }
  revalidateJob(jobId);
  redirect(`/jobs/${jobId}`);
}

/** Drag-and-drop on the calendar: move to another local day, keep the time. */
export async function rescheduleJob(
  jobId: string,
  toLocalDate: string,
  toLocalTime?: string,
): Promise<{ error?: string }> {
  await requireOwner();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("scheduled_start, status").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };
  if (job.status === "done" || job.status === "cancelled" || job.status === "skipped") {
    return { error: `A ${job.status} job cannot be moved.` };
  }
  const time = toLocalTime ?? localTime(new Date(job.scheduled_start));
  const next = localToInstant(toLocalDate, time).toISOString();
  const { error } = await supabase.from("jobs").update({ scheduled_start: next }).eq("id", jobId);
  if (error) {
    if (error.code === "23505") return { error: "This series already has a visit on that day." };
    return { error: error.message };
  }
  await audit(supabase, "job.reschedule", jobId, { from: job.scheduled_start, to: next, via: "calendar" });
  revalidateJob(jobId);
  return {};
}

/** Series instance the client does not want this time. Assignments become declined. */
export async function skipJob(jobId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "skipped" })
    .eq("id", jobId)
    .in("status", ["scheduled", "confirmed"]);
  if (error) throw new Error(error.message);
  await supabase
    .from("job_assignments")
    .update({ status: "declined" })
    .eq("job_id", jobId)
    .in("status", ["offered", "accepted"]);
  await audit(supabase, "job.skip", jobId);
  revalidateJob(jobId);
}

/**
 * Cancel with an optional cleaner fee (DECISIONS.md): fee > 0 marks the
 * assignment cancelled_paid with pay = fee so it flows through payouts.
 */
export async function cancelJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { reason, fee_cents } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "cancelled", cancelled_reason: reason })
    .eq("id", jobId)
    .in("status", ["scheduled", "confirmed", "in_progress"]);
  if (error) return { error: error.message };

  if (fee_cents && fee_cents > 0) {
    await supabase
      .from("job_assignments")
      .update({ status: "cancelled_paid", pay_cents: fee_cents })
      .eq("job_id", jobId)
      .in("status", ["offered", "accepted"]);
  } else {
    await supabase
      .from("job_assignments")
      .update({ status: "declined" })
      .eq("job_id", jobId)
      .in("status", ["offered", "accepted"]);
  }
  await audit(supabase, "job.cancel", jobId, { reason, fee_cents: fee_cents ?? 0 });
  revalidateJob(jobId);
  redirect(`/jobs/${jobId}`);
}

export async function assignProvider(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = assignSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_assignments")
    .upsert(
      { job_id: jobId, provider_id: parsed.data.provider_id, pay_cents: parsed.data.pay_cents, status: "offered" },
      { onConflict: "job_id,provider_id" },
    );
  if (error) return { error: error.message };
  revalidateJob(jobId);
  return {};
}

export async function removeAssignment(assignmentId: string, jobId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("job_assignments")
    .select("payout_id, status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a) return;
  if (a.payout_id) throw new Error("This assignment is in a payout and cannot be removed.");
  const { error } = await supabase.from("job_assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidateJob(jobId);
}

export async function setAssignmentStatus(
  assignmentId: string,
  jobId: string,
  status: "accepted" | "declined" | "no_show" | "offered",
) {
  await requireOwner();
  const supabase = await createClient();
  const patch = status === "accepted" ? { status, accepted_at: new Date().toISOString() } : { status };
  const { error } = await supabase.from("job_assignments").update(patch).eq("id", assignmentId).is("payout_id", null);
  if (error) throw new Error(error.message);
  revalidateJob(jobId);
}

/**
 * Owner marks the visit done (cleaner pages do this too, Session 5).
 * DECISIONS.md: the job is done when all non-declined assignments are done.
 */
export async function markJobDone(jobId: string) {
  await requireOwner();
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("job_assignments")
    .update({ status: "done", done_at: now })
    .eq("job_id", jobId)
    .in("status", ["offered", "accepted"]);
  const { error } = await supabase
    .from("jobs")
    .update({ status: "done", completed_at: now })
    .eq("id", jobId)
    .in("status", ["scheduled", "confirmed", "in_progress"]);
  if (error) throw new Error(error.message);
  await audit(supabase, "job.done", jobId, { by: "owner" });
  revalidateJob(jobId);
}

export async function reopenJob(jobId: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: paid } = await supabase
    .from("job_assignments")
    .select("id")
    .eq("job_id", jobId)
    .not("payout_id", "is", null)
    .limit(1);
  if (paid && paid.length) throw new Error("A cleaner has already been paid for this job; it cannot be reopened.");
  await supabase
    .from("jobs")
    .update({ status: "scheduled", completed_at: null, cancelled_reason: null })
    .eq("id", jobId);
  await supabase
    .from("job_assignments")
    .update({ status: "accepted", done_at: null })
    .eq("job_id", jobId)
    .in("status", ["done", "declined", "cancelled_paid"]);
  await audit(supabase, "job.reopen", jobId);
  revalidateJob(jobId);
}

/** Today's local date helper for forms. */
export async function todayForForms() {
  return localDate(new Date());
}

/**
 * A visit may be billed through an invoice (commercial monthly billing or
 * imported "In Progress" rows). After a payment lands on such a visit, link
 * the payment to the invoice and mark the invoice paid once covered.
 */
async function settleInvoiceForJobs(supabase: Awaited<ReturnType<typeof createClient>>, jobIds: string[]) {
  if (jobIds.length === 0) return;
  const { data: links } = await supabase.from("invoice_jobs").select("invoice_id, job_id").in("job_id", jobIds);
  const invoiceIds = [...new Set((links ?? []).map((l) => l.invoice_id))];
  if (invoiceIds.length === 0) return;
  for (const l of links ?? []) {
    await supabase.from("payments").update({ invoice_id: l.invoice_id }).eq("job_id", l.job_id).is("invoice_id", null);
  }
  const [{ data: invoices }, { data: pays }] = await Promise.all([
    supabase.from("invoices").select("id, amount_cents, status").in("id", invoiceIds),
    supabase.from("payments").select("invoice_id, amount_cents").in("invoice_id", invoiceIds),
  ]);
  for (const inv of invoices ?? []) {
    const paid = (pays ?? []).filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + p.amount_cents, 0);
    if (inv.status === "sent" && paid >= inv.amount_cents) {
      await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", inv.id);
    }
  }
}

/**
 * The client paid: record money received against this visit. Zelle, check,
 * cash and Venmo are entered by hand; Stripe rows will come from the webhook
 * in Session 4 and look the same. Payments are never deleted (rule 3).
 */
export async function recordPayment(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = paymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("client_id, status").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };

  const { error } = await supabase.from("payments").insert({
    client_id: job.client_id,
    job_id: jobId,
    method: d.method,
    amount_cents: d.amount_cents,
    fee_cents: d.fee_cents ?? 0,
    received_at: localToInstant(d.received_at, "12:00").toISOString(),
    external_ref: d.external_ref,
    notes: d.notes,
  });
  if (error) return { error: error.message };

  await settleInvoiceForJobs(supabase, [jobId]);
  await audit(supabase, "job.payment_recorded", jobId, {
    method: d.method,
    amount_cents: d.amount_cents,
    external_ref: d.external_ref,
  });
  revalidateJob(jobId);
  revalidatePath(`/clients/${job.client_id}`);
  return {};
}

const bulkPaymentSchema = paymentSchema.omit({ amount_cents: true, fee_cents: true });

/**
 * One client payment covering several visits (a Zelle for the month, a
 * check for four cleans). Writes one payments row per visit for what that
 * visit still owes, all carrying the same reference, so per-visit margins
 * and the P&L stay exact.
 */
export async function recordBulkPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const jobIds = formData.getAll("job_ids").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (jobIds.length === 0) return { error: "Select at least one visit." };
  const parsed = bulkPaymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const [{ data: jobs }, { data: paid }] = await Promise.all([
    supabase.from("jobs").select("id, client_id, charge_cents, status").in("id", jobIds),
    supabase.from("payments").select("job_id, amount_cents").in("job_id", jobIds),
  ]);
  const received = new Map<string, number>();
  for (const p of paid ?? []) if (p.job_id) received.set(p.job_id, (received.get(p.job_id) ?? 0) + p.amount_cents);

  const receivedAt = localToInstant(d.received_at, "12:00").toISOString();
  const rows = (jobs ?? [])
    .filter((j) => j.status !== "cancelled" && j.status !== "skipped")
    .map((j) => ({ job: j, outstanding: j.charge_cents - (received.get(j.id) ?? 0) }))
    .filter((x) => x.outstanding > 0)
    .map(({ job, outstanding }) => ({
      client_id: job.client_id,
      job_id: job.id,
      method: d.method,
      amount_cents: outstanding,
      fee_cents: 0,
      received_at: receivedAt,
      external_ref: d.external_ref,
      notes: d.notes,
    }));
  if (rows.length === 0) return { error: "None of the selected visits has anything outstanding." };

  const { error } = await supabase.from("payments").insert(rows);
  if (error) return { error: error.message };

  await settleInvoiceForJobs(
    supabase,
    rows.map((r) => r.job_id),
  );
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  await supabase.from("audit_log").insert(
    rows.map((r) => ({
      actor: "owner",
      action: "job.payment_recorded",
      entity: "job",
      entity_id: r.job_id,
      meta: { method: d.method, amount_cents: r.amount_cents, external_ref: d.external_ref, bulk: rows.length },
    })),
  );
  revalidateJob();
  for (const r of rows) revalidatePath(`/jobs/${r.job_id}`);
  return {
    message: `Recorded ${rows.length} payment${rows.length === 1 ? "" : "s"} totalling $${(total / 100).toFixed(2)}.`,
  };
}

/**
 * Change who does a visit, from the calendar. Unpaid assignments are
 * replaced; an assignment already in a payout is never touched (rule 4).
 * The new assignment inherits the visit's state, so a reassigned done visit
 * moves to the new cleaner's "owed" immediately.
 */
export async function reassignCleaner(
  jobId: string,
  providerId: string,
  payCents: number,
): Promise<{ error?: string }> {
  await requireOwner();
  if (!Number.isInteger(payCents) || payCents < 0) return { error: "Enter a pay amount." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status, completed_at").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };
  if (job.status === "cancelled" || job.status === "skipped") return { error: `A ${job.status} visit has no cleaner.` };

  const { data: existing } = await supabase
    .from("job_assignments")
    .select("id, provider_id, payout_id, status")
    .eq("job_id", jobId);
  const paid = (existing ?? []).filter((a) => a.payout_id);
  if (paid.some((a) => a.provider_id !== providerId)) {
    return { error: "A cleaner has already been paid for this visit; it cannot be reassigned." };
  }
  const removable = (existing ?? []).filter((a) => !a.payout_id);
  if (removable.length) {
    const { error } = await supabase
      .from("job_assignments")
      .delete()
      .in(
        "id",
        removable.map((a) => a.id),
      );
    if (error) return { error: error.message };
  }

  const done = job.status === "done";
  const { error } = await supabase.from("job_assignments").insert({
    job_id: jobId,
    provider_id: providerId,
    pay_cents: payCents,
    status: done ? "done" : "offered",
    done_at: done ? (job.completed_at ?? new Date().toISOString()) : null,
  });
  if (error) {
    if (error.code === "23505") return { error: "That cleaner is already on this visit." };
    return { error: error.message };
  }
  await audit(supabase, "job.reassign", jobId, {
    provider_id: providerId,
    pay_cents: payCents,
    replaced: removable.map((a) => a.provider_id),
  });
  revalidateJob(jobId);
  revalidatePath("/pay");
  revalidatePath("/providers");
  return {};
}

/** Change what the client is charged for one visit (from the calendar). */
export async function updateJobCharge(jobId: string, chargeCents: number): Promise<{ error?: string }> {
  await requireOwner();
  if (!Number.isInteger(chargeCents) || chargeCents < 0) return { error: "Enter a price." };
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("charge_cents, status").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job not found." };
  if (job.status === "cancelled" || job.status === "skipped") return { error: `A ${job.status} visit has no price.` };
  if (job.charge_cents === chargeCents) return {};
  const { error } = await supabase.from("jobs").update({ charge_cents: chargeCents }).eq("id", jobId);
  if (error) return { error: error.message };
  await audit(supabase, "job.price_changed", jobId, { from_cents: job.charge_cents, to_cents: chargeCents });
  revalidateJob(jobId);
  return {};
}

/** Change what a cleaner is paid for one visit. Refused once the assignment is in a payout (the DB freezes it too). */
export async function updateAssignmentPay(
  assignmentId: string,
  jobId: string,
  payCents: number,
): Promise<{ error?: string }> {
  await requireOwner();
  if (!Number.isInteger(payCents) || payCents < 0) return { error: "Enter a pay amount." };
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("job_assignments")
    .select("pay_cents, payout_id, provider_id")
    .eq("id", assignmentId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!a) return { error: "Assignment not found." };
  if (a.payout_id) return { error: "This cleaner has already been paid for this visit; the pay is frozen." };
  if (a.pay_cents === payCents) return {};
  const { error } = await supabase.from("job_assignments").update({ pay_cents: payCents }).eq("id", assignmentId);
  if (error) return { error: error.message };
  await audit(supabase, "job.pay_changed", jobId, {
    provider_id: a.provider_id,
    from_cents: a.pay_cents,
    to_cents: payCents,
  });
  revalidateJob(jobId);
  revalidatePath("/pay");
  return {};
}

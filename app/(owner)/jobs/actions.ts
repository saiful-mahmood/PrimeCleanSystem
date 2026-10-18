"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formValues, fromZod, type FormState } from "@/lib/forms";
import { assignSchema, cancelSchema, jobEditSchema, jobSchema } from "@/lib/scheduling/shared";
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

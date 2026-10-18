"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formValues, fromZod, type FormState } from "@/lib/forms";
import { buildRule } from "@/lib/rrule";
import { generateInstances } from "@/lib/scheduling/generate";
import { seriesSchema } from "@/lib/scheduling/shared";
import { localDate } from "@/lib/tz";

function parseSeries(formData: FormData) {
  const values = formValues(formData);
  const weekdays = formData.getAll("weekdays").filter((v): v is string => typeof v === "string");
  return seriesSchema.safeParse({ ...values, weekdays });
}

function toRow(d: ReturnType<typeof seriesSchema.parse>) {
  return {
    client_id: d.client_id,
    location_id: d.location_id,
    service_type_id: d.service_type_id,
    rrule: buildRule(d.frequency, d.weekdays, d.start_date),
    start_date: d.start_date,
    end_date: d.end_date,
    start_time: d.start_time,
    duration_min: d.duration_min,
    charge_cents: d.charge_cents,
    provider_pay_cents: d.provider_pay_cents ?? 0,
    default_provider_id: d.provider_id,
    charge_method: d.charge_method,
    notes: d.notes,
    active: d.active,
  };
}

function revalidateScheduling(clientId?: string) {
  revalidatePath("/calendar");
  revalidatePath("/jobs");
  revalidatePath("/series");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function createSeries(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = parseSeries(formData);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("job_series").insert(toRow(parsed.data)).select("id").single();
  if (error) return { error: error.message };

  await generateInstances(supabase, { seriesId: data.id });
  revalidateScheduling(parsed.data.client_id);
  redirect(`/series/${data.id}`);
}

/**
 * "Edit this and future" (DECISIONS.md): end the current series the day
 * before `fromDate`, cancel its not-yet-done instances from that date on,
 * create a new series starting on `fromDate`, and generate its instances.
 */
export async function splitSeries(
  seriesId: string,
  fromDate: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const parsed = parseSeries(formData);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: old } = await supabase.from("job_series").select("*").eq("id", seriesId).maybeSingle();
  if (!old) return { error: "Series not found." };

  const dayBefore = format(addDays(parseISO(fromDate), -1), "yyyy-MM-dd");
  const { error: endErr } = await supabase
    .from("job_series")
    .update({ end_date: dayBefore, active: dayBefore >= old.start_date })
    .eq("id", seriesId);
  if (endErr) return { error: endErr.message };

  await cancelFutureInstances(supabase, seriesId, fromDate, "Series changed from this date");

  const row = { ...toRow({ ...parsed.data, start_date: fromDate }) };
  const { data: created, error } = await supabase.from("job_series").insert(row).select("id").single();
  if (error) return { error: error.message };

  await generateInstances(supabase, { seriesId: created.id });
  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "series.split",
    entity: "job_series",
    entity_id: seriesId,
    meta: { from_date: fromDate, new_series_id: created.id },
  });
  revalidateScheduling(parsed.data.client_id);
  redirect(`/series/${created.id}`);
}

/** "End series": no more instances from `fromDate`; existing future ones are cancelled, history is kept. */
export async function endSeries(seriesId: string, fromDate: string) {
  await requireOwner();
  const supabase = await createClient();
  const { data: series } = await supabase
    .from("job_series")
    .select("client_id, start_date")
    .eq("id", seriesId)
    .maybeSingle();
  if (!series) throw new Error("Series not found.");

  const dayBefore = format(addDays(parseISO(fromDate), -1), "yyyy-MM-dd");
  const { error } = await supabase.from("job_series").update({ end_date: dayBefore, active: false }).eq("id", seriesId);
  if (error) throw new Error(error.message);

  await cancelFutureInstances(supabase, seriesId, fromDate, "Series ended");
  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "series.end",
    entity: "job_series",
    entity_id: seriesId,
    meta: { from_date: fromDate },
  });
  revalidateScheduling(series.client_id);
}

export async function regenerateSeries(seriesId: string) {
  await requireOwner();
  const supabase = await createClient();
  await generateInstances(supabase, { seriesId });
  revalidateScheduling();
}

async function cancelFutureInstances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seriesId: string,
  fromDate: string,
  reason: string,
) {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, scheduled_start")
    .eq("series_id", seriesId)
    .in("status", ["scheduled", "confirmed"]);
  const ids = (jobs ?? []).filter((j) => localDate(new Date(j.scheduled_start)) >= fromDate).map((j) => j.id);
  if (ids.length === 0) return;
  await supabase.from("jobs").update({ status: "cancelled", cancelled_reason: reason }).in("id", ids);
  await supabase
    .from("job_assignments")
    .update({ status: "declined" })
    .in("job_id", ids)
    .in("status", ["offered", "accepted"]);
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { generationWindow } from "@/lib/rrule";
import { localDate } from "@/lib/tz";
import { planInstances } from "./plan";

type Db = SupabaseClient<Database>;

export type GenerateResult = {
  seriesChecked: number;
  jobsCreated: number;
  assignmentsCreated: number;
  errors: { seriesId: string; message: string }[];
};

/**
 * Create job instances for active series through the window (8 weeks by
 * default). Idempotent: the unique index on (series_id, local date) rejects
 * duplicates and we also skip dates we already see. Each new job gets an
 * `offered` assignment for the series' default provider.
 *
 * Works with either the owner's client (series editor) or the service-role
 * client (nightly cron).
 */
export async function generateInstances(
  db: Db,
  opts: { seriesId?: string; now?: Date; weeks?: number } = {},
): Promise<GenerateResult> {
  const window = generationWindow(opts.now ?? new Date(), opts.weeks ?? 8);
  const result: GenerateResult = { seriesChecked: 0, jobsCreated: 0, assignmentsCreated: 0, errors: [] };

  let q = db.from("job_series").select("*").eq("active", true);
  if (opts.seriesId) q = q.eq("id", opts.seriesId);
  const { data: seriesList, error } = await q;
  if (error) throw new Error(error.message);

  for (const series of seriesList ?? []) {
    result.seriesChecked++;
    // Skip series that ended before the window.
    if (series.end_date && series.end_date < window.from) continue;

    const { data: existing, error: exErr } = await db.from("jobs").select("scheduled_start").eq("series_id", series.id);
    if (exErr) {
      result.errors.push({ seriesId: series.id, message: exErr.message });
      continue;
    }
    const existingDates = (existing ?? []).map((j) => localDate(new Date(j.scheduled_start)));
    const plan = planInstances(series, existingDates, window);
    if (plan.length === 0) continue;

    for (const p of plan) {
      const { data: job, error: insErr } = await db
        .from("jobs")
        .insert({
          series_id: series.id,
          client_id: series.client_id,
          location_id: series.location_id,
          service_type_id: series.service_type_id,
          scheduled_start: p.scheduledStart.toISOString(),
          duration_min: series.duration_min,
          charge_cents: series.charge_cents,
          charge_method: series.charge_method,
          notes: series.notes,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (insErr) {
        // 23505 = unique violation: another run got there first. Not an error.
        if (insErr.code !== "23505") result.errors.push({ seriesId: series.id, message: insErr.message });
        continue;
      }
      result.jobsCreated++;

      if (series.default_provider_id) {
        const { error: aErr } = await db.from("job_assignments").insert({
          job_id: job.id,
          provider_id: series.default_provider_id,
          pay_cents: series.provider_pay_cents,
          status: "offered",
        });
        if (aErr) result.errors.push({ seriesId: series.id, message: aErr.message });
        else result.assignmentsCreated++;
      }
    }
  }

  return result;
}

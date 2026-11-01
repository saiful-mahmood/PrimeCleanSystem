import "server-only";

import { createClient } from "@/lib/supabase/server";
import { localToInstant } from "@/lib/tz";
import { buildMonthlySchedule, monthBounds, type MonthlySchedule, type ScheduleVisit } from "./build";

/** A cleaner's visits for one month, from the owner's session (RLS applies). Lockbox columns are never selected. */
export async function loadMonthlySchedule(providerId: string, month: string): Promise<MonthlySchedule | null> {
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("id, name").eq("id", providerId).maybeSingle();
  if (!provider) return null;
  const b = monthBounds(month);
  const { data: rows, error } = await supabase
    .from("job_assignments")
    .select(
      "status, pay_cents, jobs!inner(id, scheduled_start, duration_min, status, notes, clients(name), service_types(name), locations(address_line1, city, access_notes))",
    )
    .eq("provider_id", providerId)
    .neq("status", "declined")
    .gte("jobs.scheduled_start", localToInstant(b.start, "00:00").toISOString())
    .lt("jobs.scheduled_start", localToInstant(b.end, "00:00").toISOString());
  if (error) throw new Error(error.message);

  const visits: ScheduleVisit[] = (rows ?? []).map((r) => ({
    jobId: r.jobs.id,
    scheduledStart: r.jobs.scheduled_start,
    durationMin: r.jobs.duration_min,
    status: r.jobs.status,
    assignmentStatus: r.status,
    payCents: r.pay_cents,
    clientName: r.jobs.clients?.name ?? "",
    address: [r.jobs.locations?.address_line1, r.jobs.locations?.city].filter(Boolean).join(", ") || null,
    accessNotes: r.jobs.locations?.access_notes ?? null,
    serviceName: r.jobs.service_types?.name ?? "",
    notes: r.jobs.notes,
  }));
  return buildMonthlySchedule(provider.name, month, visits);
}

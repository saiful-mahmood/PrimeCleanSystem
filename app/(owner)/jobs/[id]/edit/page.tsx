import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { JobForm } from "@/components/scheduling/job-form";
import { loadSchedulingOptions } from "@/lib/scheduling/options";
import { createClient } from "@/lib/supabase/server";
import { localDate, localTime } from "@/lib/tz";
import { updateJob } from "../../actions";

export default async function EditJobPage({ params }: PageProps<"/jobs/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: job }, options] = await Promise.all([
    supabase.from("jobs").select("*, clients(name)").eq("id", id).maybeSingle(),
    loadSchedulingOptions(),
  ]);
  if (!job) notFound();
  const start = new Date(job.scheduled_start);

  return (
    <>
      <PageHeader
        title="Edit this visit"
        description={job.series_id ? "Only this visit changes; the series is untouched." : job.clients?.name}
      />
      <JobForm
        action={updateJob.bind(null, job.id)}
        options={options}
        defaults={{
          date: localDate(start),
          start_time: localTime(start),
          client_id: job.client_id,
          location_id: job.location_id,
          service_type_id: job.service_type_id,
          duration_min: job.duration_min,
          charge_cents: job.charge_cents,
          charge_method: job.charge_method,
          notes: job.notes,
        }}
        cancelHref={`/jobs/${job.id}`}
        submitLabel="Save visit"
        mode="edit"
      />
    </>
  );
}

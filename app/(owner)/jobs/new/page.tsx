import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { JobForm } from "@/components/scheduling/job-form";
import { loadSchedulingOptions } from "@/lib/scheduling/options";
import { localDate } from "@/lib/tz";
import { createJob } from "../actions";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  const sp = await searchParams;
  const options = await loadSchedulingOptions();
  const date = typeof sp.date === "string" ? sp.date : localDate(new Date());
  const time = typeof sp.time === "string" ? sp.time : "09:00";
  const clientId = typeof sp.client === "string" ? sp.client : undefined;

  return (
    <>
      <PageHeader
        title="New job"
        description={
          <>
            One visit. For a repeating schedule,{" "}
            <Link href={`/series/new?date=${date}${clientId ? `&client=${clientId}` : ""}`} className="underline">
              create a recurring job
            </Link>{" "}
            instead.
          </>
        }
      />
      {options.clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a client first.{" "}
          <Link href="/clients/new" className="underline">
            Add client
          </Link>
        </p>
      ) : (
        <JobForm
          action={createJob}
          options={options}
          defaults={{ date, start_time: time, client_id: clientId }}
          cancelHref="/calendar"
          submitLabel="Create job"
          mode="create"
        />
      )}
    </>
  );
}

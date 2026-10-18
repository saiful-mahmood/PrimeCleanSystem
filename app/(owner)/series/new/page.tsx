import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { SeriesForm } from "@/components/scheduling/series-form";
import { loadSchedulingOptions } from "@/lib/scheduling/options";
import { localDate } from "@/lib/tz";
import { createSeries } from "../actions";

export const metadata: Metadata = { title: "New recurring job" };

export default async function NewSeriesPage({ searchParams }: PageProps<"/series/new">) {
  const sp = await searchParams;
  const options = await loadSchedulingOptions();
  const clientId = typeof sp.client === "string" ? sp.client : undefined;
  const date = typeof sp.date === "string" ? sp.date : localDate(new Date());

  return (
    <>
      <PageHeader
        title="New recurring job"
        description="Visits are generated 8 weeks ahead and kept topped up nightly."
      />
      <SeriesForm
        action={createSeries}
        options={options}
        defaults={{ client_id: clientId, start_date: date, frequency: "biweekly" }}
        cancelHref={clientId ? `/clients/${clientId}` : "/calendar"}
        submitLabel="Create series"
      />
    </>
  );
}

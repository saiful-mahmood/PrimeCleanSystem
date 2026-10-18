import { notFound } from "next/navigation";
import { RRule } from "rrule";
import { PageHeader } from "@/components/owner/page-header";
import { SeriesForm, type SeriesDefaults } from "@/components/scheduling/series-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadSchedulingOptions } from "@/lib/scheduling/options";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/tz";
import type { Frequency, WeekdayCode } from "@/lib/rrule";
import { splitSeries } from "../../actions";

/** Reverse of buildRule, for pre-filling the form. */
function ruleToDefaults(rrule: string): Pick<SeriesDefaults, "frequency" | "weekdays"> {
  const o = RRule.parseString(rrule);
  const codes: WeekdayCode[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const byweekday = Array.isArray(o.byweekday) ? o.byweekday : o.byweekday ? [o.byweekday] : [];
  const weekdays = byweekday
    .map((w) => {
      if (typeof w === "number") return codes[w];
      if (typeof w === "string") return codes.includes(w as WeekdayCode) ? (w as WeekdayCode) : undefined;
      return codes[w.weekday];
    })
    .filter((c): c is WeekdayCode => !!c);
  let frequency: Frequency = "weekly";
  if (o.freq === RRule.MONTHLY) frequency = o.bymonthday ? "monthly_day" : "monthly_weekday";
  else if (o.interval === 2) frequency = "biweekly";
  else if (o.interval === 4) frequency = "every4weeks";
  return { frequency, weekdays };
}

export default async function EditSeriesPage({ params, searchParams }: PageProps<"/series/[id]/edit">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: series }, options] = await Promise.all([
    supabase.from("job_series").select("*").eq("id", id).maybeSingle(),
    loadSchedulingOptions(),
  ]);
  if (!series) notFound();

  const from = typeof sp.from === "string" ? sp.from : localDate(new Date());

  return (
    <>
      <PageHeader
        title="Edit this and future visits"
        description={`Visits before ${from} keep their current details.`}
      />
      <Alert className="mb-6 max-w-2xl">
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          The current series ends the day before {from}. A new series starts on {from} with the details below, and its
          visits replace the ones already generated from that date.
        </AlertDescription>
      </Alert>
      <SeriesForm
        action={splitSeries.bind(null, series.id, from)}
        options={options}
        defaults={{
          client_id: series.client_id,
          location_id: series.location_id,
          service_type_id: series.service_type_id,
          start_time: series.start_time,
          duration_min: series.duration_min,
          charge_cents: series.charge_cents,
          charge_method: series.charge_method,
          notes: series.notes,
          provider_id: series.default_provider_id,
          provider_pay_cents: series.provider_pay_cents,
          start_date: from,
          end_date: series.end_date,
          ...ruleToDefaults(series.rrule),
        }}
        cancelHref={`/series/${series.id}`}
        submitLabel="Apply from this date"
        lockStart
      />
    </>
  );
}

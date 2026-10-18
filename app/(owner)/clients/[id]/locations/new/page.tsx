import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { LocationForm } from "@/components/clients/location-form";
import { createClient } from "@/lib/supabase/server";
import { createLocationAction } from "../../../actions";

export default async function NewLocationPage({ params }: PageProps<"/clients/[id]/locations/new">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).maybeSingle();
  if (!client) notFound();

  return (
    <>
      <PageHeader title="Add location" description={client.name} />
      <LocationForm action={createLocationAction.bind(null, client.id)} cancelHref={`/clients/${client.id}`} />
    </>
  );
}

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { LocationForm } from "@/components/clients/location-form";
import { createClient } from "@/lib/supabase/server";
import { LOCATION_PUBLIC_COLUMNS, type LocationPublic } from "@/lib/types";
import { updateLocationAction } from "@/app/(owner)/clients/actions";

export default async function EditLocationPage({ params }: PageProps<"/locations/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select(`${LOCATION_PUBLIC_COLUMNS}, lockbox_code_enc, clients(name)`)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  // Strip the ciphertext before anything reaches a client component.
  const { lockbox_code_enc, clients, ...rest } = data;
  const location: LocationPublic = { ...rest, has_lockbox: !!lockbox_code_enc };

  return (
    <>
      <PageHeader title={`Edit ${location.label}`} description={clients?.name} />
      <LocationForm
        action={updateLocationAction.bind(null, location.id)}
        location={location}
        cancelHref={`/clients/${location.client_id}`}
      />
    </>
  );
}

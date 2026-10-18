import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { createClient } from "@/lib/supabase/server";
import { updateClientAction } from "../../actions";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  return (
    <>
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        client={client}
        cancelHref={`/clients/${client.id}`}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { ProviderForm } from "@/components/providers/provider-form";
import { createClient } from "@/lib/supabase/server";
import { updateProvider } from "../../actions";

export default async function EditProviderPage({ params }: PageProps<"/providers/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase.from("providers").select("*").eq("id", id).maybeSingle();
  if (!provider) notFound();

  return (
    <>
      <PageHeader title={`Edit ${provider.name}`} />
      <ProviderForm
        action={updateProvider.bind(null, provider.id)}
        provider={provider}
        cancelHref={`/providers/${provider.id}`}
      />
    </>
  );
}

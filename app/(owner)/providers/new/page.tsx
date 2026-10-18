import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { ProviderForm } from "@/components/providers/provider-form";
import { createProvider } from "../actions";

export const metadata: Metadata = { title: "Add cleaner" };

export default function NewProviderPage() {
  return (
    <>
      <PageHeader title="Add cleaner" />
      <ProviderForm action={createProvider} cancelHref="/providers" />
    </>
  );
}

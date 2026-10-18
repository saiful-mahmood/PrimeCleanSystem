import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Add client" description="A 'Main' location is created with it; add the address next." />
      <ClientForm action={createClientAction} cancelHref="/clients" />
    </>
  );
}

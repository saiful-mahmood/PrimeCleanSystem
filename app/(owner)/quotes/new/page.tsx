import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { NewQuoteForm } from "@/components/quotes/new-quote-form";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/tz";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, email, phone, locations(address_line1, city)")
    .neq("status", "inactive")
    .order("name");
  return (
    <>
      <PageHeader title="New quote" description="Enter who the quote is for. You write (or draft) each section next." />
      <NewQuoteForm
        today={localDate(new Date())}
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.locations[0]?.address_line1 ?? null,
          city: c.locations[0]?.city ?? null,
        }))}
      />
    </>
  );
}

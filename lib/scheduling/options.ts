import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ClientOption = {
  id: string;
  name: string;
  type: "residential" | "commercial";
  default_charge_method: string | null;
  locations: { id: string; label: string; city: string | null; address_line1: string | null }[];
};
export type ServiceTypeOption = { id: string; name: string; default_duration_min: number };
export type ProviderOption = { id: string; name: string; default_pay_cents: number | null };

export type SchedulingOptions = {
  clients: ClientOption[];
  serviceTypes: ServiceTypeOption[];
  providers: ProviderOption[];
};

/** Reference data the job and series forms need. Never includes lockbox columns. */
export async function loadSchedulingOptions(): Promise<SchedulingOptions> {
  const supabase = await createClient();
  const [{ data: clients }, { data: serviceTypes }, { data: providers }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, type, default_charge_method, locations(id, label, city, address_line1)")
      .neq("status", "inactive")
      .order("name"),
    supabase.from("service_types").select("id, name, default_duration_min").eq("active", true).order("name"),
    supabase.from("providers").select("id, name, default_pay_cents").eq("active", true).order("name"),
  ]);
  return {
    clients: (clients ?? []) as ClientOption[],
    serviceTypes: serviceTypes ?? [],
    providers: providers ?? [],
  };
}

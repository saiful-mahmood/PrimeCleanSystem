import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { NEW_CLIENT } from "./shared";

type VisitClient = {
  client_id: string;
  location_id: string | null;
  new_client_name: string | null;
  new_client_type: "residential" | "commercial";
  new_client_phone: string | null;
  new_client_email: string | null;
  new_address_line1: string | null;
  new_city: string | null;
  new_state: string | null;
  new_postal_code: string | null;
};

/**
 * When a job or series form chose "New client", create the client and its
 * "Main" location (with whatever address was typed) and return their ids;
 * otherwise return the ids the form picked. Lockbox codes are never set here.
 */
export async function resolveClient(
  supabase: SupabaseClient<Database>,
  d: VisitClient,
): Promise<{ client_id: string; location_id: string } | { error: string }> {
  if (d.client_id !== NEW_CLIENT) {
    if (!d.location_id) return { error: "Pick a location." };
    return { client_id: d.client_id, location_id: d.location_id };
  }
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: d.new_client_name ?? "",
      type: d.new_client_type,
      status: "active",
      phone: d.new_client_phone,
      email: d.new_client_email,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const { data: location, error: locErr } = await supabase
    .from("locations")
    .insert({
      client_id: client.id,
      label: "Main",
      address_line1: d.new_address_line1,
      city: d.new_city,
      state: d.new_state,
      postal_code: d.new_postal_code,
    })
    .select("id")
    .single();
  if (locErr) return { error: locErr.message };
  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "client.created_inline",
    entity: "client",
    entity_id: client.id,
    meta: { name: d.new_client_name },
  });
  return { client_id: client.id, location_id: location.id };
}

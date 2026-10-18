import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type Enums = Database["public"]["Enums"];

export type Provider = Tables["providers"]["Row"];
export type Client = Tables["clients"]["Row"];
export type Location = Tables["locations"]["Row"];
/** A location as it may be sent to the browser: never the ciphertext. */
export type LocationPublic = Omit<Location, "lockbox_code_enc"> & { has_lockbox: boolean };

export type ProviderOwed = Views["v_provider_owed"]["Row"];
export type ProviderYtd = Views["v_provider_ytd"]["Row"];

export type ClientType = Enums["client_type"];
export type ClientStatus = Enums["client_status"];
export type ChargeMethod = Enums["charge_method"];

export const CLIENT_TYPES: ClientType[] = ["residential", "commercial"];
export const CLIENT_STATUSES: ClientStatus[] = ["active", "lead", "inactive"];
export const CHARGE_METHODS: { value: ChargeMethod; label: string }[] = [
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "stripe_card", label: "Stripe (card)" },
  { value: "stripe_ach", label: "Stripe (ACH)" },
  { value: "stripe_invoice", label: "Stripe invoice" },
  { value: "cash", label: "Cash" },
];

/** Columns safe to select for a location in any list or detail query. */
export const LOCATION_PUBLIC_COLUMNS =
  "id, client_id, label, address_line1, address_line2, city, state, postal_code, sqft, bedrooms, bathrooms, scope_of_work, access_notes, lockbox_hint, created_at, updated_at" as const;

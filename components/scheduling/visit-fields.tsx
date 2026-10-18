"use client";

import { useMemo, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { CHARGE_METHODS } from "@/lib/types";
import type { SchedulingOptions } from "@/lib/scheduling/options";

export type VisitDefaults = {
  client_id?: string | null;
  location_id?: string | null;
  service_type_id?: string | null;
  start_time?: string | null;
  duration_min?: number | null;
  charge_cents?: number | null;
  charge_method?: string | null;
  notes?: string | null;
  provider_id?: string | null;
  provider_pay_cents?: number | null;
};

export function dollars(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

const ALL_CHARGE_METHODS = [...CHARGE_METHODS, { value: "venmo", label: "Venmo" }];

/**
 * Client → location → service type → time/duration → charge, shared by the
 * one-off job form and the series form. Location options follow the client.
 */
export function VisitFields({
  options,
  defaults,
  errors,
  lockClient = false,
}: {
  options: SchedulingOptions;
  defaults: VisitDefaults;
  errors: Record<string, string>;
  lockClient?: boolean;
}) {
  const [clientId, setClientId] = useState(defaults.client_id ?? options.clients[0]?.id ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(defaults.service_type_id ?? options.serviceTypes[0]?.id ?? "");
  const client = useMemo(() => options.clients.find((c) => c.id === clientId), [options.clients, clientId]);
  const serviceType = options.serviceTypes.find((s) => s.id === serviceTypeId);
  const locations = client?.locations ?? [];
  const locationDefault = locations.some((l) => l.id === defaults.location_id)
    ? defaults.location_id!
    : locations[0]?.id;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="client_id" className="text-sm font-medium">
            Client
          </label>
          <select
            id="client_id"
            name="client_id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={lockClient}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs disabled:opacity-70"
          >
            {options.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {lockClient && <input type="hidden" name="client_id" value={clientId} />}
          {errors.client_id && <p className="text-xs text-destructive">{errors.client_id}</p>}
        </div>
        <SelectField
          key={clientId}
          label="Location"
          name="location_id"
          defaultValue={locationDefault}
          error={errors.location_id}
          options={locations.map((l) => ({
            value: l.id,
            label: [l.label, l.address_line1 ?? l.city].filter(Boolean).join(" · "),
          }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="service_type_id" className="text-sm font-medium">
            Service
          </label>
          <select
            id="service_type_id"
            name="service_type_id"
            value={serviceTypeId}
            onChange={(e) => setServiceTypeId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            {options.serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.service_type_id && <p className="text-xs text-destructive">{errors.service_type_id}</p>}
        </div>
        <SelectField
          label="Client pays by"
          name="charge_method"
          defaultValue={defaults.charge_method ?? client?.default_charge_method ?? ""}
          error={errors.charge_method}
          allowEmpty="Not set"
          options={ALL_CHARGE_METHODS}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Start time"
          name="start_time"
          type="time"
          defaultValue={(defaults.start_time ?? "09:00").slice(0, 5)}
          error={errors.start_time}
          required
        />
        <TextField
          key={`dur-${serviceTypeId}`}
          label="Duration (minutes)"
          name="duration_min"
          inputMode="numeric"
          defaultValue={defaults.duration_min ?? serviceType?.default_duration_min ?? 120}
          error={errors.duration_min}
          required
        />
      </div>

      <TextField
        label="Charge to client"
        name="charge_cents"
        inputMode="decimal"
        placeholder="280.00"
        defaultValue={dollars(defaults.charge_cents)}
        error={errors.charge_cents}
        required
        hint="Dollars per visit."
      />

      <TextAreaField label="Notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} error={errors.notes} />
    </>
  );
}

export function ProviderFields({
  options,
  defaults,
  errors,
  label = "Cleaner",
}: {
  options: SchedulingOptions;
  defaults: VisitDefaults;
  errors: Record<string, string>;
  label?: string;
}) {
  const [providerId, setProviderId] = useState(defaults.provider_id ?? "");
  const provider = options.providers.find((p) => p.id === providerId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="provider_id" className="text-sm font-medium">
          {label}
        </label>
        <select
          id="provider_id"
          name="provider_id"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Unassigned</option>
          {options.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.provider_id && <p className="text-xs text-destructive">{errors.provider_id}</p>}
      </div>
      <TextField
        key={`pay-${providerId}`}
        label="Cleaner pay"
        name="provider_pay_cents"
        inputMode="decimal"
        placeholder="165.00"
        defaultValue={dollars(defaults.provider_pay_cents ?? provider?.default_pay_cents)}
        error={errors.provider_pay_cents}
        hint="Dollars per visit."
      />
    </div>
  );
}

import { describe, expect, it } from "vitest";
import { cancelSchema, jobSchema, NEW_CLIENT } from "./shared";

const base = {
  service_type_id: "6f1f2a0e-5d3f-4f0a-9e2a-1b2c3d4e5f60",
  start_time: "09:00",
  duration_min: "120",
  charge_cents: "250",
  charge_method: "",
  provider_id: "",
  date: "2026-11-10",
};

describe("jobSchema", () => {
  it("accepts an existing client with a location and no new-client fields", () => {
    const r = jobSchema.safeParse({
      ...base,
      client_id: "0c8c68cc-f32e-42f6-89cc-c23995ca4b35",
      location_id: "bf5f0e04-7077-47da-b653-406b7849a761",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.charge_cents).toBe(25000);
  });
  it("needs a location for an existing client", () => {
    const r = jobSchema.safeParse({ ...base, client_id: "0c8c68cc-f32e-42f6-89cc-c23995ca4b35" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toEqual(["location_id"]);
  });
  it("accepts a new client with a name and no location", () => {
    const r = jobSchema.safeParse({
      ...base,
      client_id: NEW_CLIENT,
      new_client_name: "Jane Smith",
      new_client_type: "residential",
      new_client_email: "",
      new_address_line1: "1 Main St",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.location_id).toBeNull();
      expect(r.data.new_client_email).toBeNull();
    }
  });
  it("needs a name for a new client", () => {
    const r = jobSchema.safeParse({ ...base, client_id: NEW_CLIENT, new_client_name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toEqual(["new_client_name"]);
  });
});

describe("cancelSchema", () => {
  it("works without the fee field (no cleaner assigned)", () => {
    const r = cancelSchema.safeParse({ reason: "Client away" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fee_cents).toBeNull();
  });
});

/**
 * Integration test against the real (hosted) database: the payout ledger is
 * the anti-double-pay mechanism, and the DB must enforce it even if the UI
 * is wrong. Runs with `pnpm test:db` (needs .env.local). Creates its own
 * throwaway rows and removes them afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeDb = url && key ? describe : describe.skip;

describeDb("payout ledger guards (DB)", () => {
  let db: SupabaseClient<Database>;
  const ids = {
    client: "",
    location: "",
    provider: "",
    provider2: "",
    serviceType: "",
    jobs: [] as string[],
    assignments: [] as string[],
    payouts: [] as string[],
  };

  beforeAll(async () => {
    db = createClient<Database>(url!, key!, { auth: { persistSession: false } });
    const tag = `test-${Date.now()}`;
    const { data: client } = await db
      .from("clients")
      .insert({ name: `${tag} client` })
      .select("id")
      .single();
    ids.client = client!.id;
    const { data: loc } = await db
      .from("locations")
      .insert({ client_id: ids.client, label: "Main" })
      .select("id")
      .single();
    ids.location = loc!.id;
    const { data: p1 } = await db
      .from("providers")
      .insert({ name: `${tag} p1` })
      .select("id")
      .single();
    const { data: p2 } = await db
      .from("providers")
      .insert({ name: `${tag} p2` })
      .select("id")
      .single();
    ids.provider = p1!.id;
    ids.provider2 = p2!.id;
    const { data: st } = await db.from("service_types").select("id").limit(1).single();
    ids.serviceType = st!.id;
    for (let i = 0; i < 2; i++) {
      const { data: job } = await db
        .from("jobs")
        .insert({
          client_id: ids.client,
          location_id: ids.location,
          service_type_id: ids.serviceType,
          scheduled_start: new Date(Date.UTC(2020, 0, 10 + i, 14)).toISOString(),
          charge_cents: 28000,
          status: "done",
        })
        .select("id")
        .single();
      ids.jobs.push(job!.id);
      const { data: a } = await db
        .from("job_assignments")
        .insert({ job_id: job!.id, provider_id: ids.provider, pay_cents: 16500, status: "done" })
        .select("id")
        .single();
      ids.assignments.push(a!.id);
    }
  });

  afterAll(async () => {
    await db.from("job_assignments").update({ payout_id: null }).in("id", ids.assignments).is("payout_id", null);
    // Paid payouts freeze their assignments; delete jobs first (cascades the assignments) then payouts.
    await db.from("jobs").delete().in("id", ids.jobs);
    if (ids.payouts.length) await db.from("payouts").delete().in("id", ids.payouts);
    await db.from("providers").delete().in("id", [ids.provider, ids.provider2]);
    await db.from("clients").delete().eq("id", ids.client);
  });

  it("owed view shows both assignments before any payout", async () => {
    const { data } = await db.from("v_provider_owed").select("*").eq("provider_id", ids.provider).single();
    expect(data?.jobs_owed).toBe(2);
    expect(Number(data?.owed_cents)).toBe(33000);
  });

  it("creating a payout for two assignments totals them and removes them from owed", async () => {
    const { data: payout } = await db.from("payouts").insert({ provider_id: ids.provider }).select("id").single();
    ids.payouts.push(payout!.id);
    const { error } = await db.from("job_assignments").update({ payout_id: payout!.id }).in("id", ids.assignments);
    expect(error).toBeNull();

    const { data: p } = await db.from("payouts").select("total_cents").eq("id", payout!.id).single();
    expect(p?.total_cents).toBe(33000);

    const { data: owed } = await db.from("v_provider_owed").select("*").eq("provider_id", ids.provider).maybeSingle();
    expect(owed).toBeNull();

    const { error: paidErr } = await db
      .from("payouts")
      .update({ paid_at: new Date().toISOString(), reference: "TEST123" })
      .eq("id", payout!.id);
    expect(paidErr).toBeNull();
  });

  it("a paid assignment cannot be moved into another payout", async () => {
    const { data: second } = await db.from("payouts").insert({ provider_id: ids.provider }).select("id").single();
    ids.payouts.push(second!.id);
    const { error } = await db.from("job_assignments").update({ payout_id: second!.id }).eq("id", ids.assignments[0]);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/already paid/);
  });

  it("a paid assignment's pay is frozen", async () => {
    const { error } = await db.from("job_assignments").update({ pay_cents: 1 }).eq("id", ids.assignments[0]);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/frozen/);
  });

  it("an assignment cannot be attached to another provider's payout", async () => {
    const { data: job } = await db
      .from("jobs")
      .insert({
        client_id: ids.client,
        location_id: ids.location,
        service_type_id: ids.serviceType,
        scheduled_start: new Date(Date.UTC(2020, 0, 20, 14)).toISOString(),
        charge_cents: 10000,
        status: "done",
      })
      .select("id")
      .single();
    ids.jobs.push(job!.id);
    const { data: a } = await db
      .from("job_assignments")
      .insert({ job_id: job!.id, provider_id: ids.provider, pay_cents: 5000, status: "done" })
      .select("id")
      .single();
    ids.assignments.push(a!.id);
    const { data: wrong } = await db.from("payouts").insert({ provider_id: ids.provider2 }).select("id").single();
    ids.payouts.push(wrong!.id);

    const { error } = await db.from("job_assignments").update({ payout_id: wrong!.id }).eq("id", a!.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/belongs to provider/);
  });
});

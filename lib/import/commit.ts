import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { encryptSecret } from "@/lib/crypto";
import { localDate } from "@/lib/tz";
import type { Normalized } from "./normalize";

type Db = SupabaseClient<Database>;

export type Mappings = {
  clientAliases: Record<string, string>;
  clientTypes: Record<string, "residential" | "commercial">;
  providerMerges: Record<string, string>;
};

export type ImportCounts = {
  clients: number;
  locations: number;
  providers: number;
  serviceTypes: number;
  jobs: number;
  assignments: number;
  payments: number;
  invoices: number;
  payouts: number;
  expenses: number;
};

/** Re-point rows at the owner-edited canonical names. */
export function applyMappings(n: Normalized, m: Mappings): Normalized {
  const alias = (sheet: string, fallback: string) => (m.clientAliases[sheet] ?? fallback).trim() || fallback;
  const prov = (p: string | null) => (p ? (m.providerMerges[p] ?? p).trim() || p : null);
  return {
    ...n,
    clients: n.clients.map((c) => ({ ...c, canonical: alias(c.sheetName, c.canonical) })),
    revenues: n.revenues.map((r) => ({
      ...r,
      canonical: alias(r.sheetClient, r.canonical),
      provider: prov(r.provider),
    })),
    clientTypes: { ...n.clientTypes, ...m.clientTypes },
  };
}

function chunk<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Write everything. Order matters: clients → locations → providers →
 * service types → jobs → assignments → payments/invoices → payouts → expenses.
 * Paid rows get a one-assignment payout dated the cleaning day so history is
 * consistent with the ledger (IMPORT_MAPPING.md).
 */
async function writeImportInner(db: Db, n: Normalized, now: Date, created: CreatedIds): Promise<ImportCounts> {
  const counts: ImportCounts = {
    clients: 0,
    locations: 0,
    providers: 0,
    serviceTypes: 0,
    jobs: 0,
    assignments: 0,
    payments: 0,
    invoices: 0,
    payouts: 0,
    expenses: 0,
  };
  const fail = (what: string, e: { message: string } | null) => {
    if (e) throw new Error(`${what}: ${e.message}`);
  };

  // --- clients -------------------------------------------------------------
  const canonicalNames = new Set<string>([...n.clients.map((c) => c.canonical), ...n.revenues.map((r) => r.canonical)]);
  const { data: existingClients } = await db.from("clients").select("id, name");
  const clientId = new Map<string, string>();
  for (const c of existingClients ?? []) clientId.set(c.name.toLowerCase(), c.id);

  const detailByCanonical = new Map(n.clients.map((c) => [c.canonical.toLowerCase(), c]));
  const newClients = [...canonicalNames]
    .filter((name) => !clientId.has(name.toLowerCase()))
    .map((name) => {
      const d = detailByCanonical.get(name.toLowerCase());
      return {
        name,
        type: n.clientTypes[name] ?? "residential",
        status: "active" as const,
        basic_info: [d?.category, d?.basicInfo].filter(Boolean).join(" · ") || null,
        source: "import",
      };
    });
  for (const batch of chunk(newClients)) {
    const { data, error } = await db.from("clients").insert(batch).select("id, name");
    fail("clients", error);
    for (const c of data ?? []) clientId.set(c.name.toLowerCase(), c.id);
    created.clients.push(...(data ?? []).map((c) => c.id));
    counts.clients += data?.length ?? 0;
  }

  // --- locations (one "Main" per client; Client Details fills city/lockbox) --
  const { data: existingLocs } = await db.from("locations").select("id, client_id").order("created_at");
  const locationId = new Map<string, string>();
  for (const l of existingLocs ?? []) if (!locationId.has(l.client_id)) locationId.set(l.client_id, l.id);

  const newLocs = [...canonicalNames]
    .map((name) => clientId.get(name.toLowerCase())!)
    .filter((cid) => cid && !locationId.has(cid))
    .map((cid) => {
      const name = [...canonicalNames].find((nm) => clientId.get(nm.toLowerCase()) === cid)!;
      const d = detailByCanonical.get(name.toLowerCase());
      return {
        client_id: cid,
        label: "Main",
        city: d?.city ?? null,
        scope_of_work: d?.scopeOfWork ?? null,
        lockbox_code_enc: d?.lockboxCode ? encryptSecret(d.lockboxCode) : null,
      };
    });
  for (const batch of chunk(newLocs)) {
    const { data, error } = await db.from("locations").insert(batch).select("id, client_id");
    fail("locations", error);
    for (const l of data ?? []) locationId.set(l.client_id, l.id);
    created.locations.push(...(data ?? []).map((l) => l.id));
    counts.locations += data?.length ?? 0;
  }
  // Client Details for clients that already had a location: fill blanks, set lockbox if given.
  for (const d of n.clients) {
    const cid = clientId.get(d.canonical.toLowerCase());
    const lid = cid ? locationId.get(cid) : undefined;
    if (!lid || newLocs.some((l) => l.client_id === cid)) continue;
    const patch: Database["public"]["Tables"]["locations"]["Update"] = {};
    if (d.city) patch.city = d.city;
    if (d.scopeOfWork) patch.scope_of_work = d.scopeOfWork;
    if (d.lockboxCode) patch.lockbox_code_enc = encryptSecret(d.lockboxCode);
    if (Object.keys(patch).length) await db.from("locations").update(patch).eq("id", lid);
  }

  // --- providers -----------------------------------------------------------
  const providerNames = new Set(n.revenues.map((r) => r.provider).filter((p): p is string => !!p));
  const { data: existingProviders } = await db.from("providers").select("id, name");
  const providerId = new Map<string, string>();
  for (const p of existingProviders ?? []) providerId.set(p.name.toLowerCase(), p.id);
  const newProviders = [...providerNames]
    .filter((p) => !providerId.has(p.toLowerCase()))
    .map((name) => ({ name, notes: "Created by import" }));
  for (const batch of chunk(newProviders)) {
    const { data, error } = await db.from("providers").insert(batch).select("id, name");
    fail("providers", error);
    for (const p of data ?? []) providerId.set(p.name.toLowerCase(), p.id);
    created.providers.push(...(data ?? []).map((p) => p.id));
    counts.providers += data?.length ?? 0;
  }

  // --- service types -------------------------------------------------------
  const { data: existingTypes } = await db.from("service_types").select("id, name");
  const serviceId = new Map<string, string>();
  for (const s of existingTypes ?? []) serviceId.set(s.name.toLowerCase(), s.id);
  const newTypes = n.serviceNames.filter((s) => !serviceId.has(s.toLowerCase())).map((name) => ({ name }));
  if (newTypes.length) {
    const { data, error } = await db.from("service_types").insert(newTypes).select("id, name");
    fail("service_types", error);
    for (const s of data ?? []) serviceId.set(s.name.toLowerCase(), s.id);
    created.serviceTypes.push(...(data ?? []).map((s) => s.id));
    counts.serviceTypes += data?.length ?? 0;
  }

  // --- jobs ----------------------------------------------------------------
  type JobIns = Database["public"]["Tables"]["jobs"]["Insert"];
  const jobRows: JobIns[] = n.revenues.map((r) => {
    const cid = clientId.get(r.canonical.toLowerCase())!;
    const done = !r.isFuture;
    return {
      client_id: cid,
      location_id: locationId.get(cid)!,
      service_type_id: serviceId.get(r.serviceName.toLowerCase())!,
      scheduled_start: r.scheduledStart,
      duration_min: 120,
      status: done ? "done" : "scheduled",
      charge_cents: r.chargeCents,
      charge_method: r.chargeMethod,
      notes: r.notes,
      completed_at: done ? new Date(new Date(r.scheduledStart).getTime() + 120 * 60_000).toISOString() : null,
    };
  });
  const jobIds: string[] = [];
  for (const batch of chunk(jobRows)) {
    const { data, error } = await db.from("jobs").insert(batch).select("id");
    fail("jobs", error);
    jobIds.push(...(data ?? []).map((j) => j.id));
    created.jobs.push(...(data ?? []).map((j) => j.id));
  }
  counts.jobs = jobIds.length;

  // --- assignments ---------------------------------------------------------
  type AsgIns = Database["public"]["Tables"]["job_assignments"]["Insert"];
  const asgRows: (AsgIns & { _paid: boolean; _when: string; _label: string | null })[] = [];
  n.revenues.forEach((r, i) => {
    if (!r.provider) return;
    const done = !r.isFuture;
    asgRows.push({
      job_id: jobIds[i],
      provider_id: providerId.get(r.provider.toLowerCase())!,
      pay_cents: r.providerPayCents,
      status: done ? "done" : "accepted",
      done_at: done ? r.scheduledStart : null,
      _paid: r.paid && done,
      _when: r.scheduledStart,
      _label: r.payoutLabel,
    });
  });
  const asgIds: string[] = [];
  for (const batch of chunk(asgRows)) {
    const { data, error } = await db
      .from("job_assignments")
      .insert(
        batch.map((a) => ({
          job_id: a.job_id,
          provider_id: a.provider_id,
          pay_cents: a.pay_cents,
          status: a.status,
          done_at: a.done_at,
        })),
      )
      .select("id");
    fail("job_assignments", error);
    asgIds.push(...(data ?? []).map((a) => a.id));
  }
  counts.assignments = asgIds.length;

  // --- payments (PMT Received = Yes) and invoices (In Progress) ------------
  type PayIns = Database["public"]["Tables"]["payments"]["Insert"];
  const payRows: PayIns[] = [];
  const invRows: {
    client_id: string;
    amount_cents: number;
    method: NonNullable<JobIns["charge_method"]>;
    sent_at: string;
    due_date: string;
    _job: string;
  }[] = [];
  n.revenues.forEach((r, i) => {
    if (r.isFuture) return;
    const cid = clientId.get(r.canonical.toLowerCase())!;
    if (r.pmt === "yes") {
      payRows.push({
        client_id: cid,
        job_id: jobIds[i],
        method: r.chargeMethod ?? "check",
        amount_cents: r.chargeCents,
        fee_cents: r.feeCents,
        received_at: r.scheduledStart,
        external_ref: "imported",
        notes: r.feeEstimated ? "Fee estimated on import" : null,
      });
    } else if (r.pmt === "in_progress") {
      invRows.push({
        client_id: cid,
        amount_cents: r.chargeCents,
        method: r.chargeMethod ?? "stripe_invoice",
        sent_at: r.scheduledStart,
        due_date: localDate(new Date(new Date(r.scheduledStart).getTime() + 30 * 86_400_000)),
        _job: jobIds[i],
      });
    }
  });
  for (const batch of chunk(payRows)) {
    const { data, error } = await db.from("payments").insert(batch).select("id");
    fail("payments", error);
    created.payments.push(...(data ?? []).map((p) => p.id));
    counts.payments += batch.length;
  }
  for (const batch of chunk(invRows)) {
    const { data, error } = await db
      .from("invoices")
      .insert(
        batch.map((inv) => ({
          client_id: inv.client_id,
          amount_cents: inv.amount_cents,
          method: inv.method,
          sent_at: inv.sent_at,
          due_date: inv.due_date,
          status: "sent" as const,
          notes: "Imported: invoice sent, awaiting payment",
        })),
      )
      .select("id");
    fail("invoices", error);
    created.invoices.push(...(data ?? []).map((inv) => inv.id));
    const links = (data ?? []).map((inv, k) => ({ invoice_id: inv.id, job_id: batch[k]._job }));
    const { error: linkErr } = await db.from("invoice_jobs").insert(links);
    fail("invoice_jobs", linkErr);
    counts.invoices += batch.length;
  }

  // --- payouts for Paid rows: one per assignment, paid on the cleaning day --
  const paidIdx = asgRows.map((a, k) => (a._paid ? k : -1)).filter((k) => k >= 0);
  for (const batch of chunk(paidIdx)) {
    const { data: payouts, error } = await db
      .from("payouts")
      .insert(
        batch.map((k) => ({
          provider_id: asgRows[k].provider_id,
          method: "zelle" as const,
          reference: "imported",
          notes: asgRows[k]._label ? `Sheet: ${asgRows[k]._label}` : null,
        })),
      )
      .select("id");
    fail("payouts", error);
    created.payouts.push(...(payouts ?? []).map((p) => p.id));
    // Attach, then mark paid (the trigger freezes assignments once paid_at is set).
    for (let j = 0; j < batch.length; j++) {
      const k = batch[j];
      const { error: aErr } = await db
        .from("job_assignments")
        .update({ payout_id: payouts![j].id })
        .eq("id", asgIds[k]);
      fail("attach payout", aErr);
    }
    const { error: paidErr } = await db.from("payouts").upsert(
      batch.map((k, j) => ({
        id: payouts![j].id,
        provider_id: asgRows[k].provider_id,
        paid_at: asgRows[k]._when,
        reference: "imported",
      })),
    );
    fail("mark payouts paid", paidErr);
    counts.payouts += batch.length;
  }

  // --- expenses ------------------------------------------------------------
  for (const batch of chunk(n.expenses)) {
    const { data, error } = await db
      .from("expenses")
      .insert(
        batch.map((e) => ({
          name: e.name,
          category: e.category,
          paid_at: e.paidAt,
          amount_cents: e.amountCents,
          paid_with: e.paidWith,
          platform: e.platform,
          cadence: e.cadence,
          notes: e.notes,
        })),
      )
      .select("id");
    fail("expenses", error);
    created.expenses.push(...(data ?? []).map((e) => e.id));
    counts.expenses += batch.length;
  }

  await db.from("audit_log").insert({
    actor: "owner",
    action: "import.commit",
    entity: "import",
    meta: { ...counts, at: now.toISOString(), warnings: n.warnings.length, ids: created as unknown as Json },
  });
  return counts;
}

export type CreatedIds = {
  clients: string[];
  locations: string[];
  providers: string[];
  serviceTypes: string[];
  jobs: string[];
  payments: string[];
  invoices: string[];
  payouts: string[];
  expenses: string[];
};

function emptyCreated(): CreatedIds {
  return {
    clients: [],
    locations: [],
    providers: [],
    serviceTypes: [],
    jobs: [],
    payments: [],
    invoices: [],
    payouts: [],
    expenses: [],
  };
}

/**
 * Supabase's HTTP API has no multi-statement transaction, so an import is a
 * sequence of inserts. If any step fails, delete what this run created, in
 * dependency order, and rethrow. The ids are also stored on the
 * import.commit audit row so scripts/rollback-import.mjs can undo a finished
 * import.
 */
export async function writeImport(db: Db, n: Normalized, now = new Date()): Promise<ImportCounts> {
  const created = emptyCreated();
  try {
    return await writeImportInner(db, n, now, created);
  } catch (e) {
    const undo = await rollbackCreated(db, created);
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${msg}. Nothing was kept: ${undo} rows from this attempt were removed.`);
  }
}

export async function rollbackCreated(db: Db, c: CreatedIds): Promise<number> {
  let removed = 0;
  const wipe = async (
    table:
      | "payments"
      | "invoices"
      | "jobs"
      | "payouts"
      | "expenses"
      | "service_types"
      | "providers"
      | "locations"
      | "clients",
    ids: string[],
  ) => {
    for (const batch of chunk(ids, 100)) {
      const { count } = await db.from(table).delete({ count: "exact" }).in("id", batch);
      removed += count ?? 0;
    }
  };
  // Jobs cascade their assignments; a paid payout only freezes updates, not deletes.
  await wipe("payments", c.payments);
  await wipe("invoices", c.invoices);
  await wipe("jobs", c.jobs);
  await wipe("payouts", c.payouts);
  await wipe("expenses", c.expenses);
  await wipe("service_types", c.serviceTypes);
  await wipe("providers", c.providers);
  await wipe("locations", c.locations);
  await wipe("clients", c.clients);
  return removed;
}

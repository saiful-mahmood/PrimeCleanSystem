// Remove everything a sheet import wrote. Two modes:
//   node scripts/rollback-import.mjs            → undo the most recent import.commit (ids from audit_log)
//   node scripts/rollback-import.mjs --partial  → clean up a half-finished import that never reached audit_log,
//                                                 using the markers the importer leaves (source/reference/notes)
// Asks nothing; prints what it deleted. Run with care.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const partial = process.argv.includes("--partial");

async function del(table, build) {
  const { count, error } = await build(db.from(table).delete({ count: "exact" }));
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table.padEnd(16)} -${count ?? 0}`);
}

if (partial) {
  const { data: clients } = await db.from("clients").select("id").eq("source", "import");
  const clientIds = (clients ?? []).map((c) => c.id);
  const { data: firstClient } = await db.from("clients").select("created_at").eq("source", "import").order("created_at").limit(1).maybeSingle();
  const windowStart = firstClient ? new Date(new Date(firstClient.created_at).getTime() - 60_000).toISOString() : null;

  await del("payments", (q) => q.eq("external_ref", "imported"));
  await del("invoices", (q) => q.like("notes", "Imported:%"));
  if (clientIds.length) await del("jobs", (q) => q.in("client_id", clientIds)); // cascades assignments
  await del("payouts", (q) => q.eq("reference", "imported"));
  if (windowStart) await del("expenses", (q) => q.gte("created_at", windowStart));
  await del("providers", (q) => q.eq("notes", "Created by import"));
  await del("clients", (q) => q.eq("source", "import")); // cascades locations
} else {
  const { data: audit } = await db.from("audit_log").select("id, meta, created_at").eq("action", "import.commit").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!audit?.meta?.ids) {
    console.error("No import.commit with row ids found. For a half-finished import use --partial.");
    process.exit(1);
  }
  const ids = audit.meta.ids;
  const byIds = (key) => (q) => q.in("id", ids[key] ?? []);
  if (ids.payments?.length) await del("payments", byIds("payments"));
  if (ids.invoices?.length) await del("invoices", byIds("invoices"));
  if (ids.jobs?.length) await del("jobs", byIds("jobs"));
  if (ids.payouts?.length) await del("payouts", byIds("payouts"));
  if (ids.expenses?.length) await del("expenses", byIds("expenses"));
  if (ids.serviceTypes?.length) await del("service_types", byIds("serviceTypes"));
  if (ids.providers?.length) await del("providers", byIds("providers"));
  if (ids.clients?.length) await del("clients", byIds("clients"));
  await db.from("audit_log").insert({ actor: "owner", action: "import.rollback", entity: "import", meta: { of: audit.id } });
}
console.log("done");

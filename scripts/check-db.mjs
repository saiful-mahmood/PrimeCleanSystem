// Smoke-check the hosted database after a migration: every table and view
// answers, and the seed rows are present. Reads .env.local; prints no secrets.
// Usage: node scripts/check-db.mjs
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "profiles", "providers", "clients", "locations", "service_types", "rate_cards", "leads",
  "proposals", "proposal_versions", "job_series", "jobs", "payouts", "job_assignments",
  "invoices", "invoice_jobs", "payments", "expenses", "messages", "magic_links", "audit_log",
  "settings",
];
const views = ["v_job_economics", "v_monthly_pnl", "v_monthly_pnl_by_job", "v_provider_owed", "v_ar_aging", "v_provider_ytd"];

let failed = 0;
for (const name of [...tables, ...views]) {
  const { count, error } = await db.from(name).select("*", { count: "exact", head: true });
  const kind = views.includes(name) ? "view " : "table";
  if (error) {
    failed++;
    console.log(`FAIL  ${kind} ${name}: ${error.message}`);
  } else {
    console.log(`ok    ${kind} ${name.padEnd(18)} ${count} rows`);
  }
}

const { data: st } = await db.from("service_types").select("name").order("name");
console.log("\nservice_types:", st?.map((r) => r.name).join(", "));
const { data: settings } = await db.from("settings").select("key").order("key");
console.log("settings keys:", settings?.map((r) => r.key).join(", "));

process.exit(failed ? 1 : 0);

// Wipe the business data so a fresh workbook can be imported. Keeps: your
// login, settings, service types and rate cards. Removes: clients,
// locations, cleaners, jobs, series, assignments, payouts, payments,
// invoices, expenses, quotes, messages, magic links and the audit log.
//
//   node scripts/reset-data.mjs            → shows what would be deleted
//   node scripts/reset-data.mjs --yes      → deletes it
//   node scripts/reset-data.mjs --yes --keep-quotes   → everything except quotes and their clients
//
// Uses the service role from .env.local, so it only runs on your machine.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const yes = process.argv.includes("--yes");
const keepQuotes = process.argv.includes("--keep-quotes");

// Order matters: children first. Jobs cascade assignments; clients cascade locations/series.
const tables = [
  "payments",
  "invoice_jobs",
  "invoices",
  "jobs",
  "payouts",
  "job_series",
  "messages",
  "magic_links",
  "expenses",
  ...(keepQuotes ? [] : ["proposal_versions", "proposals", "leads"]),
  "locations",
  "providers",
  "clients",
  "audit_log",
];

let quoteClientIds = [];
if (keepQuotes) {
  const { data } = await db.from("proposals").select("client_id");
  quoteClientIds = [...new Set((data ?? []).map((p) => p.client_id).filter(Boolean))];
}

console.log(yes ? "Deleting:" : "Would delete (add --yes to do it):");
for (const t of tables) {
  let q = db.from(t).select("*", { count: "exact", head: true });
  if (keepQuotes && (t === "clients" || t === "locations") && quoteClientIds.length) {
    q = q.not(t === "clients" ? "id" : "client_id", "in", `(${quoteClientIds.join(",")})`);
  }
  const { count } = await q;
  console.log(`  ${t.padEnd(18)} ${count ?? 0}`);
  if (!yes) continue;
  let d = db.from(t).delete({ count: "exact" });
  if (keepQuotes && (t === "clients" || t === "locations") && quoteClientIds.length) {
    d = d.not(t === "clients" ? "id" : "client_id", "in", `(${quoteClientIds.join(",")})`);
  } else if (t === "audit_log") {
    d = d.gt("id", 0);
  } else if (t === "invoice_jobs") {
    d = d.not("invoice_id", "is", null); // composite key, no id column
  } else {
    d = d.not("id", "is", null);
  }
  const { error } = await d;
  if (error) {
    console.error(`  ${t}: ${error.message}`);
    process.exit(1);
  }
}
if (yes) {
  await db.from("audit_log").insert({ actor: "owner", action: "data.reset", entity: "all", meta: { keepQuotes } });
  console.log("Done. Settings → Import to load the new workbook.");
}

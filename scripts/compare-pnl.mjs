// Compare v_monthly_pnl_by_job with the old "Monthly Profits" tab of the workbook.
// Usage: node scripts/compare-pnl.mjs "/path/to/Prime Clean Care CRM.xlsx"
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Import counts
const { data: audit } = await db.from("audit_log").select("meta, created_at").eq("action", "import.commit").order("created_at", { ascending: false }).limit(1).maybeSingle();
const { ids, ...counts } = audit?.meta ?? {};
console.log("import.commit:", audit?.created_at, JSON.stringify(counts));

// Old tab
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(process.argv[2]);
const ws = wb.getWorksheet("Monthly Profits");
const old = new Map();
const val = (x) => (x && typeof x === "object" && !(x instanceof Date) && "result" in x ? x.result : x);
ws.eachRow((row, i) => {
  if (i === 1) return;
  const v = row.values.map(val);
  if (!(v[1] instanceof Date)) return;
  const month = `${v[1].getUTCFullYear()}-${String(v[1].getUTCMonth() + 1).padStart(2, "0")}-01`;
  old.set(month, { overhead: Number(v[2] ?? 0), provider: Number(v[3] ?? 0), fee: Number(v[4] ?? 0), received: Number(v[5] ?? 0), ads: Number(v[6] ?? 0), profit: Number(v[7] ?? 0) });
});

const { data: rows } = await db.from("v_monthly_pnl_by_job").select("*");
const mine = new Map(rows.map((r) => [r.month, r]));
const months = [...new Set([...old.keys(), ...mine.keys()])].sort().filter((m) => m <= "2026-11-01");
const c = (v) => Number(v ?? 0) / 100;
const f = (n) => (Math.round(n * 100) / 100).toFixed(2).padStart(10);
let maxDiff = 0;
console.log("\nmonth       | revenue old / new   | cleaners old / new  | fees old / new  | overhead old / new | ads old / new | profit old / new / diff");
for (const m of months) {
  const o = old.get(m) ?? {};
  const n = mine.get(m) ?? {};
  const rev = [o.received ?? 0, c(n.charged_cents)];
  const prov = [o.provider ?? 0, c(n.provider_payment_cents)];
  const fee = [o.fee ?? 0, c(n.stripe_fee_cents)];
  const ovh = [o.overhead ?? 0, c(n.overhead_expense_cents)];
  const ads = [o.ads ?? 0, c(n.ad_expense_cents)];
  const prof = [o.profit ?? 0, c(n.total_profit_cents)];
  const diff = prof[1] - prof[0];
  maxDiff = Math.max(maxDiff, Math.abs(diff));
  console.log(`${m.slice(0, 7)}     |${f(rev[0])}${f(rev[1])} |${f(prov[0])}${f(prov[1])} |${f(fee[0])}${f(fee[1])} |${f(ovh[0])}${f(ovh[1])} |${f(ads[0])}${f(ads[1])} |${f(prof[0])}${f(prof[1])}${f(diff)}`);
}
console.log("\nmax monthly profit difference:", maxDiff.toFixed(2));
const sum = (k) => months.reduce((s, m) => s + ((old.get(m) ?? {})[k] ?? 0), 0);
const sumN = (k) => months.reduce((s, m) => s + c((mine.get(m) ?? {})[k]), 0);
console.log("totals old vs new: revenue", sum("received").toFixed(2), sumN("charged_cents").toFixed(2), "| cleaners", sum("provider").toFixed(2), sumN("provider_payment_cents").toFixed(2), "| fees", sum("fee").toFixed(2), sumN("stripe_fee_cents").toFixed(2), "| overhead", sum("overhead").toFixed(2), sumN("overhead_expense_cents").toFixed(2), "| ads", sum("ads").toFixed(2), sumN("ad_expense_cents").toFixed(2), "| profit", sum("profit").toFixed(2), sumN("total_profit_cents").toFixed(2));

import { NextResponse, type NextRequest } from "next/server";
import { getOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, dollars, toCsv } from "@/lib/export";

/**
 * Monthly P&L as CSV. mode=by_job (default; matches the old Monthly Profits
 * tab) or mode=cash (when money actually moved).
 */
export async function GET(request: NextRequest) {
  if (!(await getOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mode = request.nextUrl.searchParams.get("mode") === "cash" ? "cash" : "by_job";
  const supabase = await createClient();

  if (mode === "cash") {
    const { data, error } = await supabase.from("v_monthly_pnl").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = [
      "Month",
      "Overhead Expenses",
      "Provider Payments",
      "Stripe Fees",
      "Received Payments",
      "Ad Expense",
      "Total Profits",
      "YTD",
    ];
    const rows = (data ?? []).map((r) => [
      r.month,
      dollars(r.overhead_expense_cents),
      dollars(r.provider_payment_cents),
      dollars(r.stripe_fee_cents),
      dollars(r.received_cents),
      dollars(r.ad_expense_cents),
      dollars(r.total_profit_cents),
      dollars(r.ytd_profit_cents),
    ]);
    return csvResponse("pnl-cash-basis.csv", toCsv(headers, rows));
  }

  const { data, error } = await supabase.from("v_monthly_pnl_by_job").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const headers = [
    "Month",
    "Overhead Expenses",
    "Provider Payments",
    "Stripe Fees",
    "Received Payments",
    "Ad Expense",
    "Total Profits",
    "YTD",
  ];
  const rows = (data ?? []).map((r) => [
    r.month,
    dollars(r.overhead_expense_cents),
    dollars(r.provider_payment_cents),
    dollars(r.stripe_fee_cents),
    dollars(r.charged_cents),
    dollars(r.ad_expense_cents),
    dollars(r.total_profit_cents),
    dollars(r.ytd_profit_cents),
  ]);
  return csvResponse("pnl-by-job-date.csv", toCsv(headers, rows));
}

import { NextResponse, type NextRequest } from "next/server";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { getOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, dollars, toCsv } from "@/lib/export";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TZ, localDate, localToInstant } from "@/lib/tz";

/** Same filters as the Jobs page; columns mirror the old Revenues tab plus margin. */
export async function GET(request: NextRequest) {
  if (!(await getOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const today = localDate(new Date());
  const from = sp.get("from") || format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
  const to = sp.get("to") || format(endOfMonth(parseISO(today)), "yyyy-MM-dd");
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("v_job_economics")
    .select("*")
    .gte("scheduled_start", localToInstant(from, "00:00").toISOString())
    .lt("scheduled_start", new Date(localToInstant(to, "00:00").getTime() + 86_400_000).toISOString())
    .order("scheduled_start");
  if (status) query = query.eq("status", status as "done");
  if (q) query = query.ilike("client_name", `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    "Client Name",
    "Cleaning Type",
    "Cleaning Date and time",
    "Charged Amount",
    "PMT Received",
    "Stripe fee",
    "Charge Method",
    "Provider",
    "Provider Payment",
    "Paid",
    "Profit",
    "Profit Margin",
    "Status",
  ];
  const rows = (data ?? []).map((r) => [
    r.client_name,
    r.cleaning_type,
    formatInTimeZone(new Date(r.scheduled_start!), BUSINESS_TZ, "yyyy-MM-dd HH:mm"),
    dollars(r.charge_cents),
    r.fully_paid ? "Yes" : Number(r.received_cents ?? 0) > 0 ? "Partial" : "No",
    dollars(r.fee_cents),
    r.charge_method ?? "",
    r.provider_names ?? "",
    dollars(r.provider_pay_cents),
    Number(r.provider_pay_cents ?? 0) === 0 ? "" : r.provider_unpaid ? "Unpaid" : "Paid",
    r.status === "cancelled" || r.status === "skipped" ? "" : dollars(r.profit_cents),
    r.profit_margin_pct != null && r.status !== "cancelled" && r.status !== "skipped" ? `${r.profit_margin_pct}%` : "",
    r.status,
  ]);
  return csvResponse(`jobs-${from}-to-${to}.csv`, toCsv(headers, rows));
}

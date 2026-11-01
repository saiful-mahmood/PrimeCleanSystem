import { NextResponse, type NextRequest } from "next/server";
import { getOwner } from "@/lib/auth";
import { loadMonthlySchedule } from "@/lib/schedules/load";
import { renderSchedulePdf } from "@/lib/schedules/pdf";
import { localDate } from "@/lib/tz";

export const runtime = "nodejs";

/** GET /api/schedules/pdf?provider=<id>&month=YYYY-MM&pay=1 */
export async function GET(request: NextRequest) {
  if (!(await getOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const providerId = sp.get("provider") ?? "";
  const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? sp.get("month")! : localDate(new Date()).slice(0, 7);
  const includePay = sp.get("pay") !== "0";
  const schedule = await loadMonthlySchedule(providerId, month);
  if (!schedule) return NextResponse.json({ error: "cleaner not found" }, { status: 404 });

  const pdf = await renderSchedulePdf(schedule, includePay);
  const safe = schedule.providerName.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="schedule-${safe}-${month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

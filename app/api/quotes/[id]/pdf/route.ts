import { NextResponse, type NextRequest } from "next/server";
import { getOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toQuoteFields } from "@/lib/quotes/model";
import { renderQuotePdf } from "@/lib/quotes/pdf";

export const runtime = "nodejs";

/** GET /api/quotes/:id/pdf?v=3  → the PDF of that saved version (latest by default). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]/pdf">) {
  if (!(await getOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const vParam = request.nextUrl.searchParams.get("v");

  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, quote_number, title, current_version")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "not found" }, { status: 404 });
  const versionNo = vParam ? Number(vParam) : proposal.current_version;
  const { data: version } = await supabase
    .from("proposal_versions")
    .select("fields, version_no")
    .eq("proposal_id", id)
    .eq("version_no", versionNo)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: "version not found" }, { status: 404 });

  const fields = toQuoteFields(version.fields);
  const pdf = await renderQuotePdf(fields, proposal.quote_number ?? "QUOTE", version.version_no);
  const safeName = (fields.client.name || "quote").replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.get("download") ? "attachment" : "inline"}; filename="${proposal.quote_number ?? "quote"}-v${version.version_no}-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

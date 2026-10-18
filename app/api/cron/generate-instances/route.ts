import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInstances } from "@/lib/scheduling/generate";
import { authorizeCron } from "@/lib/cron";

/** Nightly 02:00 (vercel.json). Also safe to hit by hand. */
export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const result = await generateInstances(admin);
  await admin.from("audit_log").insert({
    actor: "system",
    action: "cron.generate_instances",
    entity: "job_series",
    meta: { ...result, errors: result.errors.length },
  });
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}

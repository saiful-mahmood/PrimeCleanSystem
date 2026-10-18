import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { DetailList } from "@/components/owner/detail-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: lastImport }] = await Promise.all([
    supabase.from("settings").select("key, value"),
    supabase
      .from("audit_log")
      .select("created_at, meta")
      .eq("action", "import.commit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const get = (k: string) => {
    const v = settings?.find((s) => s.key === k)?.value;
    return v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import from the Google Sheet</CardTitle>
            <CardDescription>
              {lastImport ? `Last import ${new Date(lastImport.created_at).toLocaleString()}.` : "Not imported yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/settings/import" />}>
              Open import
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>Editable in Session 6 along with the rate card and templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                ["Name", get("business_name")],
                ["Timezone", get("business_tz")],
                ["Weekly schedule", get("weekly_schedule_send")],
                ["Client reminder", `${get("client_reminder_hours_before")} h before`],
                ["Unpaid nudge", `${get("unpaid_provider_nudge_days")} days`],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription>CSV downloads.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<a href="/api/export/jobs?from=2024-01-01" />}>
              All jobs
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/api/export/pnl?mode=by_job" />}>
              P&amp;L by job date
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/api/export/pnl?mode=cash" />}>
              P&amp;L cash basis
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

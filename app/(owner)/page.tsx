import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const [{ count: clients }, { count: providers }] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("providers").select("*", { count: "exact", head: true }).eq("active", true),
  ]);

  return (
    <>
      <PageHeader title="Today" description="Jobs, cleaners owed and alerts land here in Session 3." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/clients">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle>{clients ?? 0}</CardTitle>
              <CardDescription>Clients</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/providers">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle>{providers ?? 0}</CardTitle>
              <CardDescription>Active cleaners</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Calendar, jobs and payouts arrive in the next two sessions. Until then, add your clients and cleaners.
        </CardContent>
      </Card>
    </>
  );
}

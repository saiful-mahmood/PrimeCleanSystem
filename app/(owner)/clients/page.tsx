import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/owner/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, type, status, phone, email, locations(id, city)")
    .order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  if (status === "active" || status === "lead" || status === "inactive") query = query.eq("status", status);
  const { data: clients, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Clients" description={`${clients?.length ?? 0} shown`}>
        <Button nativeButton={false} render={<Link href="/clients/new" />}>
          Add client
        </Button>
      </PageHeader>

      <form className="mb-4 flex flex-wrap gap-2" action="/clients">
        <Input name="q" defaultValue={q} placeholder="Search by name" className="max-w-xs" />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inactive</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || status) && (
          <Button variant="ghost" nativeButton={false} render={<Link href="/clients" />}>
            Clear
          </Button>
        )}
      </form>

      {clients && clients.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Locations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{c.type}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{c.phone ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {c.locations.length === 0
                      ? "—"
                      : c.locations
                          .map((l) => l.city)
                          .filter(Boolean)
                          .join(", ") || `${c.locations.length}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {q || status ? "No clients match." : "No clients yet. Add one, or import your sheet in Session 3."}
        </p>
      )}
    </>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseCsv, rowsToRecords } from "@/lib/import/csv";
import { workbookToTabs } from "@/lib/import/workbook";
import { normalizeAll, type Normalized, type Warning } from "@/lib/import/normalize";
import { applyMappings, writeImport, type ImportCounts, type Mappings } from "@/lib/import/commit";

export type Preview = {
  counts: {
    clients: number;
    revenues: number;
    expenses: number;
    future: number;
    paidRows: number;
    unpaidClients: number;
    invoices: number;
  };
  warnings: Warning[];
  clientAliases: Record<string, string>;
  clientTypes: Record<string, "residential" | "commercial">;
  providerMerges: Record<string, string>;
  serviceNames: string[];
  /** canonical → number of revenue rows, for the preview table */
  rowsPerClient: Record<string, number>;
  lockboxCount: number;
  previousImport: string | null;
  files: { clients: boolean; revenues: boolean; expenses: boolean };
};

async function readTabs(formData: FormData): Promise<{
  clients?: Record<string, string>[];
  revenues?: Record<string, string>[];
  expenses?: Record<string, string>[];
}> {
  // One .xlsx with all the tabs wins over individual CSVs.
  const workbook = formData.get("workbook");
  if (workbook instanceof File && workbook.size > 0) {
    if (workbook.size > 25 * 1024 * 1024) throw new Error(`${workbook.name} is larger than 25 MB.`);
    if (!/\.xlsx$/i.test(workbook.name))
      throw new Error("The workbook must be an .xlsx file (File → Download → Microsoft Excel).");
    const { tabs, sheetsFound } = await workbookToTabs(Buffer.from(await workbook.arrayBuffer()));
    if (sheetsFound.length === 0) {
      throw new Error('No tab named "Client Details", "Revenues" or "Expenses" was found in the workbook.');
    }
    return tabs;
  }

  const read = async (field: string, firstHeader: string) => {
    const f = formData.get(field);
    if (!(f instanceof File) || f.size === 0) return undefined;
    if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB.`);
    return rowsToRecords(parseCsv(await f.text()), firstHeader);
  };
  const [clients, revenues, expenses] = await Promise.all([
    read("clients", "Client Name"),
    read("revenues", "Client Name"),
    read("expenses", "Subscription"),
  ]);
  if (!clients && !revenues && !expenses) throw new Error("Choose at least one CSV.");
  return { clients, revenues, expenses };
}

export async function analyzeImport(formData: FormData): Promise<{ preview?: Preview; error?: string }> {
  await requireOwner();
  try {
    const tabs = await readTabs(formData);
    const n = normalizeAll(tabs);
    const supabase = await createClient();
    const { data: prev } = await supabase
      .from("audit_log")
      .select("created_at")
      .eq("action", "import.commit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { preview: toPreview(n, tabs, prev?.created_at ?? null) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the files." };
  }
}

function toPreview(
  n: Normalized,
  tabs: { clients?: unknown[]; revenues?: unknown[]; expenses?: unknown[] },
  previousImport: string | null,
): Preview {
  const rowsPerClient: Record<string, number> = {};
  for (const r of n.revenues) rowsPerClient[r.canonical] = (rowsPerClient[r.canonical] ?? 0) + 1;
  for (const c of n.clients) rowsPerClient[c.canonical] = rowsPerClient[c.canonical] ?? 0;
  return {
    counts: {
      clients: Object.keys(rowsPerClient).length,
      revenues: n.revenues.length,
      expenses: n.expenses.length,
      future: n.revenues.filter((r) => r.isFuture).length,
      paidRows: n.revenues.filter((r) => r.paid).length,
      unpaidClients: n.revenues.filter((r) => r.pmt === "no" && !r.isFuture).length,
      invoices: n.revenues.filter((r) => r.pmt === "in_progress" && !r.isFuture).length,
    },
    warnings: n.warnings,
    clientAliases: n.clientAliases,
    clientTypes: n.clientTypes,
    providerMerges: n.providerMerges,
    serviceNames: n.serviceNames,
    rowsPerClient,
    lockboxCount: n.clients.filter((c) => c.lockboxCode).length,
    previousImport,
    files: { clients: !!tabs.clients, revenues: !!tabs.revenues, expenses: !!tabs.expenses },
  };
}

/**
 * The files are sent again with the owner's edited mappings, so lockbox
 * codes never sit in a preview payload or the browser's memory as data we
 * produced; they go file → server → ciphertext.
 */
export async function commitImport(formData: FormData): Promise<{ counts?: ImportCounts; error?: string }> {
  await requireOwner();
  try {
    const tabs = await readTabs(formData);
    const raw = formData.get("mappings");
    const mappings: Mappings =
      typeof raw === "string" ? JSON.parse(raw) : { clientAliases: {}, clientTypes: {}, providerMerges: {} };
    const n = applyMappings(normalizeAll(tabs), mappings);
    const supabase = await createClient();
    const counts = await writeImport(supabase, n);
    for (const p of ["/", "/clients", "/providers", "/jobs", "/calendar", "/expenses", "/pay"]) revalidatePath(p);
    return { counts };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}

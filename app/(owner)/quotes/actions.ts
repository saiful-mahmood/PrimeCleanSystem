"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formValues,
  fromZod,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
  type FormState,
} from "@/lib/forms";
import { localDate } from "@/lib/tz";
import { aiConfigured, draftSection } from "@/lib/quotes/ai";
import {
  SECTIONS,
  describeChanges,
  emptyFields,
  quoteTotalCents,
  toQuoteFields,
  type QuoteClient,
  type QuoteFields,
  type SectionKey,
} from "@/lib/quotes/model";
import type { Database, Json } from "@/lib/database.types";

const clientSchema = z.object({
  name: requiredText("Client name"),
  address_line1: optionalText,
  address_line2: optionalText,
  contact_name: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  extra_emails: z
    .string()
    .optional()
    .default("")
    .transform((s) =>
      s
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email("One of the extra emails is not valid."))),
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  client_id: z
    .string()
    .transform((s) => (s === "" ? null : s))
    .pipe(z.string().uuid().nullable())
    .optional()
    .default(null),
});

function toQuoteClient(d: z.infer<typeof clientSchema>): QuoteClient {
  return {
    name: d.name,
    address_line1: d.address_line1 ?? "",
    address_line2: d.address_line2 ?? "",
    contact_name: d.contact_name ?? "",
    email: d.email ?? "",
    phone: d.phone ?? "",
    extra_emails: d.extra_emails,
  };
}

/** PCC-2026-0007: per-year sequence, derived from existing numbers. */
async function nextQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const year = localDate(new Date()).slice(0, 4);
  const prefix = `PCC-${year}-`;
  const { data } = await supabase.from("proposals").select("quote_number").like("quote_number", `${prefix}%`);
  const max = (data ?? []).reduce((m, r) => Math.max(m, Number(r.quote_number?.slice(prefix.length) ?? 0) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Create the quote and its v1 (client details only). */
export async function createQuote(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = clientSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();

  // A quote needs a client row (the schema requires lead or client). Reuse by exact name, else create.
  let clientId = d.client_id;
  if (!clientId) {
    const { data: existing } = await supabase.from("clients").select("id").ilike("name", d.name).maybeSingle();
    if (existing) clientId = existing.id;
    else {
      const { data: created, error } = await supabase
        .from("clients")
        .insert({ name: d.name, type: "commercial", status: "lead", email: d.email, phone: d.phone, source: "quote" })
        .select("id")
        .single();
      if (error) return { error: error.message };
      clientId = created.id;
      await supabase.from("locations").insert({ client_id: clientId, label: "Main", address_line1: d.address_line1 });
    }
  }

  const quoteNumber = await nextQuoteNumber(supabase);
  const fields = emptyFields(toQuoteClient(d), d.quote_date);
  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({ client_id: clientId, title: `${quoteNumber} · ${d.name}`, quote_number: quoteNumber, current_version: 1 })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: vErr } = await supabase.from("proposal_versions").insert({
    proposal_id: proposal.id,
    version_no: 1,
    fields: fields as unknown as Json,
    rendered_md: "",
    generated_by: "manual",
    change_summary: "Created",
  });
  if (vErr) return { error: vErr.message };

  await supabase.from("audit_log").insert({
    actor: "owner",
    action: "quote.create",
    entity: "proposal",
    entity_id: proposal.id,
    meta: { quote_number: quoteNumber },
  });
  revalidatePath("/quotes");
  redirect(`/quotes/${proposal.id}`);
}

async function latest(supabase: Awaited<ReturnType<typeof createClient>>, proposalId: string) {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, current_version, status, quote_number")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) throw new Error("Quote not found.");
  const { data: version } = await supabase
    .from("proposal_versions")
    .select("fields, version_no")
    .eq("proposal_id", proposalId)
    .eq("version_no", proposal.current_version)
    .maybeSingle();
  return { proposal, fields: version ? toQuoteFields(version.fields) : null };
}

/**
 * Every save is a new version (rule 3: never overwrite history). `patch` is
 * merged onto the latest saved snapshot, so saving one section never
 * clobbers another section that was saved from a different tab.
 */
async function saveVersion(
  proposalId: string,
  patch: Partial<Omit<QuoteFields, "client" | "sections">> & {
    client?: Partial<QuoteClient>;
    sections?: Partial<Record<SectionKey, string>>;
  },
  generatedBy = "manual",
  summaryPrefix?: string,
) {
  const supabase = await createClient();
  const { proposal, fields: before } = await latest(supabase, proposalId);
  const base =
    before ??
    emptyFields(
      { name: "", address_line1: "", address_line2: "", contact_name: "", email: "", phone: "", extra_emails: [] },
      localDate(new Date()),
    );
  const after: QuoteFields = {
    ...base,
    ...patch,
    client: { ...base.client, ...(patch.client ?? {}) },
    sections: { ...base.sections, ...(patch.sections ?? {}) },
  };
  const summary = describeChanges(before, after);
  if (summary === "No changes") return { versionNo: proposal.current_version, summary };

  const versionNo = proposal.current_version + 1;
  const { error } = await supabase.from("proposal_versions").insert({
    proposal_id: proposalId,
    version_no: versionNo,
    fields: after as unknown as Json,
    rendered_md: "",
    generated_by: generatedBy,
    model: generatedBy === "claude" ? process.env.PROPOSAL_MODEL || "claude-opus-5-5" : null,
    change_summary: summaryPrefix ? `${summaryPrefix}: ${summary}` : summary,
  });
  if (error) throw new Error(error.message);
  await supabase.from("proposals").update({ current_version: versionNo }).eq("id", proposalId);
  revalidatePath(`/quotes/${proposalId}`);
  revalidatePath("/quotes");
  return { versionNo, summary };
}

export async function saveSection(
  proposalId: string,
  key: SectionKey,
  text: string,
  generatedBy: "manual" | "claude" = "manual",
) {
  await requireOwner();
  if (!SECTIONS.some((s) => s.key === key)) throw new Error("Unknown section.");
  return saveVersion(proposalId, { sections: { [key]: text } as Partial<Record<SectionKey, string>> }, generatedBy);
}

export async function saveHeader(proposalId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = clientSchema.safeParse(formValues(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const d = parsed.data;
  const title = String(formData.get("title") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  try {
    const r = await saveVersion(proposalId, {
      client: toQuoteClient(d),
      quote_date: d.quote_date,
      ...(title ? { title } : {}),
      ...(tagline ? { tagline } : {}),
    });
    return { message: r.summary === "No changes" ? "Nothing changed." : `Saved as v${r.versionNo}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
}

/** AI draft of one section. Returns text for the editor; saves nothing. */
export async function draftSectionAction(
  proposalId: string,
  key: SectionKey,
  notes: string,
  working: Partial<Record<SectionKey, string>>,
): Promise<{ text?: string; error?: string }> {
  await requireOwner();
  if (!aiConfigured())
    return { error: "AI drafting needs ANTHROPIC_API_KEY in the environment (console.anthropic.com)." };
  const supabase = await createClient();
  const { fields } = await latest(supabase, proposalId);
  if (!fields) return { error: "Quote not found." };
  try {
    const text = await draftSection({
      fields: { ...fields, sections: { ...fields.sections, ...working } },
      section: key,
      notes,
    });
    await supabase.from("audit_log").insert({
      actor: "owner",
      action: "quote.ai_draft",
      entity: "proposal",
      entity_id: proposalId,
      meta: { section: key },
    });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Drafting failed." };
  }
}

export async function restoreVersion(proposalId: string, versionNo: number) {
  await requireOwner();
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("proposal_versions")
    .select("fields")
    .eq("proposal_id", proposalId)
    .eq("version_no", versionNo)
    .maybeSingle();
  if (!v) throw new Error("Version not found.");
  const f = toQuoteFields(v.fields);
  await saveVersion(proposalId, f, "manual", `Restored v${versionNo}`);
}

export async function setQuoteStatus(proposalId: string, status: "draft" | "sent" | "accepted" | "declined") {
  await requireOwner();
  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["proposals"]["Update"] = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "accepted" || status === "declined") patch.decided_at = new Date().toISOString();
  const { error } = await supabase.from("proposals").update(patch).eq("id", proposalId);
  if (error) throw new Error(error.message);
  const { fields } = await latest(supabase, proposalId);
  await supabase.from("audit_log").insert({
    actor: "owner",
    action: `quote.${status}`,
    entity: "proposal",
    entity_id: proposalId,
    meta: { total_cents: fields ? quoteTotalCents(fields) : null },
  });
  revalidatePath(`/quotes/${proposalId}`);
  revalidatePath("/quotes");
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { FormActions, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { SECTIONS, formatQuoteMoney, quoteTotalCents, type QuoteFields, type SectionKey } from "@/lib/quotes/model";
import { draftSectionAction, saveHeader, saveSection } from "@/app/(owner)/quotes/actions";
import { QuotePreview } from "./quote-preview";
import { cn } from "@/lib/utils";

export function QuoteEditor({
  proposalId,
  quoteNumber,
  versionNo,
  saved,
  aiEnabled,
}: {
  proposalId: string;
  quoteNumber: string;
  versionNo: number;
  saved: QuoteFields;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<Record<SectionKey, string>>(saved.sections);
  const [notes, setNotes] = useState<Partial<Record<SectionKey, string>>>({});
  const [busy, setBusy] = useState<SectionKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [, start] = useTransition();

  const previewFields: QuoteFields = { ...saved, sections: working };
  const dirty = (k: SectionKey) => working[k] !== saved.sections[k];

  function save(k: SectionKey, generatedBy: "manual" | "claude" = "manual") {
    setBusy(k);
    setErrors((e) => ({ ...e, [k]: undefined }));
    start(async () => {
      try {
        const r = await saveSection(proposalId, k, working[k], generatedBy);
        setNotice(r.summary === "No changes" ? "Nothing changed." : `Saved as v${r.versionNo}: ${r.summary}`);
        router.refresh();
      } catch (e) {
        setErrors((er) => ({ ...er, [k]: e instanceof Error ? e.message : "Could not save." }));
      } finally {
        setBusy(null);
      }
    });
  }

  function draft(k: SectionKey) {
    setBusy(k);
    setErrors((e) => ({ ...e, [k]: undefined }));
    start(async () => {
      const r = await draftSectionAction(proposalId, k, notes[k] ?? "", working);
      if (r.error) setErrors((er) => ({ ...er, [k]: r.error }));
      else setWorking((w) => ({ ...w, [k]: r.text ?? "" }));
      setBusy(null);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {notice && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {notice}
          </p>
        )}

        <HeaderForm proposalId={proposalId} saved={saved} />

        {SECTIONS.map((s) => (
          <Card key={s.key} className={cn(dirty(s.key) && "border-amber-400")}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {s.heading ? `${s.heading}. ` : ""}
                  {s.title}
                  {dirty(s.key) && <span className="ml-2 text-xs font-normal text-amber-700">unsaved</span>}
                </span>
                {s.key === "quote_lines" && (
                  <span className="text-sm font-normal text-muted-foreground">
                    Total {formatQuoteMoney(quoteTotalCents(previewFields))}
                  </span>
                )}
              </CardTitle>
              <CardDescription>{s.help}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={working[s.key]}
                onChange={(e) => setWorking((w) => ({ ...w, [s.key]: e.target.value }))}
                placeholder={s.placeholder}
                rows={s.kind === "table" ? 6 : 5}
                className={cn("text-sm", s.kind === "table" && "font-mono text-xs")}
              />
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  <Sparkles className="mr-1 inline size-3.5" />
                  Draft with AI
                </summary>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={notes[s.key] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.key]: e.target.value }))}
                    placeholder="Paste walkthrough notes or tell it what to change, e.g. 'add the basement, carpet is 2,400 sq ft, no windows'."
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === s.key || !aiEnabled}
                      onClick={() => draft(s.key)}
                    >
                      {busy === s.key
                        ? "Drafting…"
                        : working[s.key].trim()
                          ? "Redraft this section"
                          : "Draft this section"}
                    </Button>
                    {!aiEnabled && (
                      <span className="text-xs text-muted-foreground">Add ANTHROPIC_API_KEY to enable.</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      The draft replaces the text above; nothing is saved until you click Save.
                    </span>
                  </div>
                </div>
              </details>
              {errors[s.key] && <p className="text-sm text-destructive">{errors[s.key]}</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === s.key || !dirty(s.key)} onClick={() => save(s.key)}>
                  {busy === s.key ? "Saving…" : "Save section"}
                </Button>
                {dirty(s.key) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWorking((w) => ({ ...w, [s.key]: saved.sections[s.key] }))}
                  >
                    Discard changes
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-xs text-muted-foreground">
          Preview of what you are editing. Only saved content goes into the PDF (currently v{versionNo}).
        </p>
        <div className="max-h-[80vh] overflow-y-auto">
          <QuotePreview fields={previewFields} quoteNumber={quoteNumber} versionNo={versionNo} />
        </div>
      </div>
    </div>
  );
}

function HeaderForm({ proposalId, saved }: { proposalId: string; saved: QuoteFields }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHeader.bind(null, proposalId), {});
  const e = state.fieldErrors ?? {};
  const c = saved.client;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client and cover page</CardTitle>
        <CardDescription>Who the quote is for and how it is addressed. Saving creates a new version.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <TextField label="Client / organization" name="name" defaultValue={c.name} error={e.name} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Street address"
              name="address_line1"
              defaultValue={c.address_line1}
              error={e.address_line1}
              placeholder="126 Boston Post Road"
            />
            <TextField
              label="City, State ZIP"
              name="address_line2"
              defaultValue={c.address_line2}
              error={e.address_line2}
              placeholder="Wayland, Massachusetts 01778"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Contact name" name="contact_name" defaultValue={c.contact_name} error={e.contact_name} />
            <TextField label="Contact email" name="email" type="email" defaultValue={c.email} error={e.email} />
            <TextField label="Contact phone" name="phone" type="tel" defaultValue={c.phone} error={e.phone} />
          </div>
          <TextField
            label="Additional email recipients"
            name="extra_emails"
            defaultValue={c.extra_emails.join(", ")}
            error={e.extra_emails}
            hint="Comma-separated. Used when the quote is sent."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Quote date"
              name="quote_date"
              type="date"
              defaultValue={saved.quote_date}
              error={e.quote_date}
              required
            />
            <TextField label="Cover title" name="title" defaultValue={saved.title} wrapperClassName="sm:col-span-2" />
          </div>
          <TextField label="Tagline under Prime Clean Care" name="tagline" defaultValue={saved.tagline} />
          {state.message && <p className="text-sm text-emerald-800">{state.message}</p>}
          <FormActions pending={pending} submitLabel="Save client details" error={state.error} />
        </form>
      </CardContent>
    </Card>
  );
}

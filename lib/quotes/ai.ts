import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { SECTION_BY_KEY, SECTIONS, type QuoteFields, type SectionKey } from "./model";

/**
 * Draft one section with Claude. The owner sees the draft in the editor and
 * decides whether to keep, edit or discard it; nothing is saved here.
 */

const SYSTEM = `You write customer-facing quotes for Prime Clean Care, a specialty cleaning company in Massachusetts (floors, tile and grout, carpet, windows, moldings and screens, post-construction, event cleaning). You draft one section at a time for a quote document whose structure is fixed:
1. Scope Summary, 2. Quote Summary (service | price table, with a pricing basis note and optional scope-based price adjustments), 3. Detailed Scope of Work (service | included work table, with optional process notes), 4. Exclusions (item | status table, with optional notes), 5. Project Conditions, 6. Proposal Acceptance (generated automatically).

Style: formal, plain, precise. Third person ("Prime Clean Care will…", "The Client will…"). Define scope literally and state what is not included. No marketing language, no exclamation marks, no bullets unless asked. Use the facility and client names exactly as given. Prices in whole dollars with a $ sign.

Output rules: return only the section content, with no heading, no preamble and no commentary. For table sections return one row per line in the form "left cell | right cell". For text sections return paragraphs separated by a blank line. If the section should be empty, return an empty response.`;

export type DraftInput = {
  fields: QuoteFields;
  section: SectionKey;
  /** Walkthrough notes, instructions, or anything the owner typed. */
  notes: string;
};

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function draftSection({ fields, section, notes }: DraftInput): Promise<string> {
  if (!aiConfigured()) throw new Error("Add ANTHROPIC_API_KEY to enable drafting.");
  const def = SECTION_BY_KEY[section];
  const client = new Anthropic();

  const context = SECTIONS.filter((s) => s.key !== section && fields.sections[s.key]?.trim())
    .map((s) => `## ${s.title}\n${fields.sections[s.key]}`)
    .join("\n\n");

  const user = [
    `Client: ${fields.client.name}`,
    `Address: ${[fields.client.address_line1, fields.client.address_line2].filter(Boolean).join(", ")}`,
    fields.client.contact_name ? `Contact: ${fields.client.contact_name}` : null,
    `Quote date: ${fields.quote_date}`,
    "",
    `Section to draft: ${def.title}`,
    `Brief: ${def.aiBrief}`,
    def.kind === "table" && def.columns ? `Table columns: ${def.columns[0]} | ${def.columns[1]}` : null,
    "",
    fields.sections[section]?.trim()
      ? `Current draft of this section (revise it, keep what is right):\n${fields.sections[section]}`
      : "This section is currently empty.",
    "",
    notes.trim()
      ? `Owner's notes and instructions:\n${notes.trim()}`
      : "The owner gave no extra notes; infer from the other sections.",
    context ? `\nOther sections already written (for consistency; do not repeat them):\n\n${context}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const response = await client.beta.messages.create({
    model: process.env.PROPOSAL_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to draft this section. Try rephrasing your notes.");
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text;
}

import { parseDollars } from "@/lib/money";

/**
 * A quote is a snapshot of `QuoteFields`, stored as one proposal_versions row
 * per save. Sections are plain text the owner edits (tables are "a | b" lines),
 * so the AI draft, the editor, the HTML preview and the PDF all share one shape.
 * Layout and wording follow templates/quote reference: the ICB Wayland quote.
 */

export type SectionKey =
  | "scope_summary"
  | "quote_lines"
  | "pricing_note"
  | "adjustments"
  | "scope_details"
  | "process_notes"
  | "exclusions"
  | "exclusion_notes"
  | "conditions";

export type SectionKind = "text" | "table";

export type SectionDef = {
  key: SectionKey;
  title: string;
  /** Heading number in the PDF; sub-sections share their parent's number. */
  heading: string | null;
  kind: SectionKind;
  columns?: [string, string];
  help: string;
  /** What the AI is asked to produce for this section. */
  aiBrief: string;
  placeholder: string;
};

export const SECTIONS: SectionDef[] = [
  {
    key: "scope_summary",
    title: "Scope Summary",
    heading: "1",
    kind: "text",
    help: "Two short paragraphs: what was walked through and what this quote covers; what it does not.",
    aiBrief:
      "Write the Scope Summary: paragraph 1 states that Prime Clean Care completed a walkthrough of the named facility and what the quote is based on; paragraph 2 states the work is specialty cleaning only, lists the surfaces in scope, and says general janitorial cleaning and unlisted surfaces are not included.",
    placeholder:
      "Prime Clean Care completed a thorough walkthrough of …\n\nThe work covered by this quote is specialty cleaning only. …",
  },
  {
    key: "quote_lines",
    title: "Quote Summary",
    heading: "2",
    kind: "table",
    columns: ["Service", "Price"],
    help: "One line per service: description | price. The total is added automatically.",
    aiBrief:
      "List the priced services, one per line as 'Service description | $price'. Keep descriptions specific (areas, approximate quantities). Do not add a total line.",
    placeholder:
      "Prayer Hall Carpet Cleaning - includes deodorizer | $510\nTile and Grout Scrubbing - first floor, approximately 10,000 square feet | $2,630",
  },
  {
    key: "pricing_note",
    title: "Pricing basis",
    heading: null,
    kind: "text",
    help: "The sentence under the total about quantities and changes requiring separate approval.",
    aiBrief:
      "Write one or two sentences stating that pricing is based on the scope and approximate quantities identified during the walkthrough and that any material change in area, quantity, access or requested work requires separate approval and pricing.",
    placeholder:
      "Pricing is based on the scope and approximate quantities identified during the walkthrough. Any material change in area, quantity, access, or requested work will require separate approval and pricing.",
  },
  {
    key: "adjustments",
    title: "Scope-Based Price Adjustments",
    heading: null,
    kind: "text",
    help: "Optional. One line per option, e.g. '$200 off if the basement is out of scope. Adjusted price: $2,430.' Leave blank to omit.",
    aiBrief:
      "If the notes mention optional reductions or add-ons, write one line per option in the form 'Service: $X off if …. Adjusted price: $Y.' Otherwise return nothing.",
    placeholder:
      "Tile and Grout Scrubbing: $200 off if the basement is out of scope. Adjusted tile and grout price: $2,430.",
  },
  {
    key: "scope_details",
    title: "Detailed Scope of Work",
    heading: "3",
    kind: "table",
    columns: ["Service", "Included Work"],
    help: "One line per service or area: name | exactly what will be cleaned. Be literal; this defines the job.",
    aiBrief:
      "Produce the Detailed Scope of Work table, one line per service or area as 'Service | Included work'. Define exactly what will be cleaned, what is included (e.g. deodorizer, grout protector) and what is explicitly not (e.g. no polish, exterior upper windows not included).",
    placeholder:
      "Prayer Hall Carpet Cleaning | Thorough cleaning of the prayer hall carpeted areas. Deodorizer is included.",
  },
  {
    key: "process_notes",
    title: "Process notes",
    heading: null,
    kind: "text",
    help: "Optional closing paragraphs for the scope section, e.g. how the tile and grout process works.",
    aiBrief:
      "Write short paragraphs describing the cleaning process for the main services (e.g. truck-mounted hot water extraction for tile and grout) and restating that only the listed surfaces are included. Return nothing if there is nothing to add.",
    placeholder:
      "Tile and Grout Cleaning Process\nFirst, we will spray the floor with floor wash. We will then wash the floor with high-pressure hot water and extract the water. …",
  },
  {
    key: "exclusions",
    title: "Exclusions",
    heading: "4",
    kind: "table",
    columns: ["Excluded Item", "Status"],
    help: "One line per item: item | status (usually 'Not included').",
    aiBrief:
      "List the exclusions, one per line as 'Excluded item | Not included' (or a qualified status such as 'Not included, except for tile floor cleaning'). Cover walls, cobwebs, baseboards, ceilings, doors, furniture, cabinets, light fixtures, blinds, general dusting, trash, bathroom fixtures, appliances, floor polishing, and anything the notes call out.",
    placeholder: "Walls | Not included\nCobwebs | Not included\nBaseboards | Not included",
  },
  {
    key: "exclusion_notes",
    title: "Exclusion notes",
    heading: null,
    kind: "text",
    help: "Optional paragraphs after the exclusions table that restate the limits.",
    aiBrief:
      "Write one or two sentences restating that window cleaning is limited to the glass and tracks described and floor cleaning to the floor surfaces and grout described; vertical surfaces and unrelated fixtures are not included.",
    placeholder: "Window cleaning is limited to the glass and tracks described in the scope. …",
  },
  {
    key: "conditions",
    title: "Project Conditions",
    heading: "5",
    kind: "text",
    help: "Access, moving items, pre-existing damage, weather. One paragraph per condition.",
    aiBrief:
      "Write the Project Conditions: client provides access and secures fragile items; extensive moving of furniture is not included and may be quoted separately; pre-existing damage, permanent staining, deteriorated grout and failed sealants are not guaranteed to be restored; exterior work is subject to safe weather and may be rescheduled.",
    placeholder:
      "The Client will provide reasonable access to all areas included in the scope …\n\nThis quote does not include extensive moving of furniture …",
  },
];

export const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, SectionDef>;

export type QuoteClient = {
  name: string;
  address_line1: string;
  address_line2: string; // "Wayland, Massachusetts 01778"
  contact_name: string;
  email: string;
  phone: string;
  extra_emails: string[];
};

export type QuoteFields = {
  title: string;
  tagline: string;
  quote_date: string; // YYYY-MM-DD
  client: QuoteClient;
  sections: Record<SectionKey, string>;
};

export const DEFAULT_TITLE = "A CUSTOMIZED CLEANING QUOTE";
export const DEFAULT_TAGLINE = "Specialty floor, carpet, window, and molding cleaning services";

export function emptyFields(client: QuoteClient, quoteDate: string): QuoteFields {
  return {
    title: DEFAULT_TITLE,
    tagline: DEFAULT_TAGLINE,
    quote_date: quoteDate,
    client,
    sections: Object.fromEntries(SECTIONS.map((s) => [s.key, ""])) as Record<SectionKey, string>,
  };
}

/** Coerce whatever is stored in proposal_versions.fields into QuoteFields. */
export function toQuoteFields(raw: unknown): QuoteFields {
  const r = (raw ?? {}) as Partial<QuoteFields> & {
    client?: Partial<QuoteClient>;
    sections?: Partial<Record<SectionKey, string>>;
  };
  const client: QuoteClient = {
    name: r.client?.name ?? "",
    address_line1: r.client?.address_line1 ?? "",
    address_line2: r.client?.address_line2 ?? "",
    contact_name: r.client?.contact_name ?? "",
    email: r.client?.email ?? "",
    phone: r.client?.phone ?? "",
    extra_emails: Array.isArray(r.client?.extra_emails)
      ? r.client!.extra_emails!.filter((e) => typeof e === "string")
      : [],
  };
  return {
    title: r.title ?? DEFAULT_TITLE,
    tagline: r.tagline ?? DEFAULT_TAGLINE,
    quote_date: r.quote_date ?? "",
    client,
    sections: Object.fromEntries(SECTIONS.map((s) => [s.key, r.sections?.[s.key] ?? ""])) as Record<SectionKey, string>,
  };
}

// ---------------------------------------------------------------------------
// Parsing the text the owner edits
// ---------------------------------------------------------------------------

export type TableRow = { cells: [string, string] };

/** "a | b" lines → rows. A line without a separator becomes a one-cell row. */
export function parseTable(text: string): TableRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf("|");
      if (idx === -1) return { cells: [l, ""] as [string, string] };
      return { cells: [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string] };
    });
}

/** Paragraphs separated by blank lines; single newlines are kept inside a paragraph. */
export function parseParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Total of the Quote Summary prices, in cents. Unparseable prices count as 0. */
export function quoteTotalCents(fields: QuoteFields): number {
  return parseTable(fields.sections.quote_lines).reduce((s, r) => s + (parseDollars(r.cells[1]) ?? 0), 0);
}

/** "$4,700" style, no cents when whole dollars (matches the template). */
export function formatQuoteMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Which top-level parts differ between two snapshots, for the version's change summary. */
export function describeChanges(before: QuoteFields | null, after: QuoteFields): string {
  if (!before) return "Created";
  const changed: string[] = [];
  if (before.title !== after.title) changed.push("title");
  if (before.tagline !== after.tagline) changed.push("tagline");
  if (before.quote_date !== after.quote_date) changed.push("quote date");
  if (JSON.stringify(before.client) !== JSON.stringify(after.client)) changed.push("client details");
  for (const s of SECTIONS) {
    if ((before.sections[s.key] ?? "") !== (after.sections[s.key] ?? "")) changed.push(s.title);
  }
  const beforeTotal = quoteTotalCents(before);
  const afterTotal = quoteTotalCents(after);
  if (beforeTotal !== afterTotal)
    changed.push(`total ${formatQuoteMoney(beforeTotal)} → ${formatQuoteMoney(afterTotal)}`);
  return changed.length ? `Changed ${changed.join(", ")}` : "No changes";
}

/** "September 24, 2026" from "2026-09-24". */
export function longDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Footer label: "Islamic Center of Boston - 126 Boston Post Road". */
export function footerLabel(fields: QuoteFields): string {
  return [fields.client.name, fields.client.address_line1].filter(Boolean).join(" - ");
}

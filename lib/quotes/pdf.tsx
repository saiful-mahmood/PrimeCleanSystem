import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Image as PdfImage, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  SECTIONS,
  footerLabel,
  formatQuoteMoney,
  longDate,
  parseParagraphs,
  parseTable,
  quoteTotalCents,
  type QuoteFields,
} from "./model";

/**
 * The quote PDF, laid out like the reference (ICB Wayland quote): logo and
 * rule at the top of every page, cover page, numbered sections, navy table
 * headers, a boxed total, signature blocks, and a footer with company,
 * page number and client.
 */

const NAVY = "#1f3a5f";
const NAVY_DARK = "#1b2f4d";
const TEXT = "#1f2937";
const MUTED = "#4b5563";
const RULE = "#9ca3af";
const BORDER = "#c7cbd1";

// No lineHeight on the Page style: with one, react-pdf 4.9 silently drops render-prop
// Texts (the page number). Line height lives on paragraph and cell styles instead.
const s = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 60,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: TEXT,
  },
  header: { position: "absolute", top: 32, left: 56, right: 56 },
  headerLogo: { width: 150, height: 45, objectFit: "contain" },
  headerRule: { marginTop: 8, borderBottomWidth: 1, borderBottomColor: RULE },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: MUTED },
  footerLeft: { textAlign: "left" },
  pageNumber: { position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: 8, color: MUTED },
  footerRight: { textAlign: "right" },
  coverTitle: {
    marginTop: 100,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: NAVY_DARK,
    letterSpacing: 0.5,
  },
  coverLabel: { marginTop: 28, textAlign: "center", fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY_DARK },
  coverName: { marginTop: 6, textAlign: "center", fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY_DARK },
  coverSub: { marginTop: 6, textAlign: "center", fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY_DARK },
  coverLogo: { marginTop: 36, alignSelf: "center", width: 360, height: 110, objectFit: "contain" },
  coverDate: { marginTop: 20, textAlign: "center", fontSize: 9.5, color: MUTED },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY_DARK, marginTop: 14, marginBottom: 8 },
  h3: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 8, lineHeight: 1.4 },
  table: { marginVertical: 6, borderWidth: 1, borderColor: BORDER },
  trHead: { flexDirection: "row", backgroundColor: NAVY },
  th: { color: "#ffffff", fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 7 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER },
  td: { fontSize: 9, paddingVertical: 5, paddingHorizontal: 7, lineHeight: 1.35 },
  wide: { flex: 3, borderRightWidth: 1, borderRightColor: BORDER },
  narrow: { flex: 1 },
  totalBox: { marginTop: 14, marginBottom: 10, flexDirection: "row", borderWidth: 1, borderColor: NAVY },
  totalLabel: {
    flex: 1,
    backgroundColor: "#e8eef5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: NAVY_DARK,
  },
  totalValue: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, fontSize: 18, textAlign: "center", color: MUTED },
  sigRow: { flexDirection: "row", marginTop: 18, gap: 24 },
  sigCol: { flex: 1 },
  sigLine: { marginTop: 14, fontSize: 9.5, lineHeight: 1.4 },
});

let logoCache: Buffer | null = null;
function logo(): Buffer {
  if (!logoCache) logoCache = readFileSync(path.join(process.cwd(), "public", "logo.png"));
  return logoCache;
}

function Chrome({ label }: { label: string }) {
  return (
    <>
      <View style={s.header} fixed>
        <PdfImage style={s.headerLogo} src={{ data: logo(), format: "png" }} />
        <View style={s.headerRule} />
      </View>
      <Text style={[s.footer, s.footerLeft]} fixed>
        PRIME CLEAN CARE
      </Text>
      <Text style={[s.footer, s.footerRight]} fixed>
        {label}
      </Text>
    </>
  );
}

function Table({ columns, rows }: { columns: [string, string]; rows: { cells: [string, string] }[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={s.table}>
      <View style={s.trHead}>
        <Text style={[s.th, s.wide]}>{columns[0]}</Text>
        <Text style={[s.th, s.narrow]}>{columns[1]}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          <Text style={[s.td, s.wide]}>{r.cells[0]}</Text>
          <Text style={[s.td, s.narrow]}>{r.cells[1]}</Text>
        </View>
      ))}
    </View>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {parseParagraphs(text).map((p, i) => (
        <Text key={i} style={s.p}>
          {p}
        </Text>
      ))}
    </>
  );
}

export function QuoteDocument({
  fields,
  quoteNumber,
  versionNo,
}: {
  fields: QuoteFields;
  quoteNumber: string;
  versionNo: number;
}) {
  const sec = fields.sections;
  const total = formatQuoteMoney(quoteTotalCents(fields));
  const label = footerLabel(fields);
  const defs = Object.fromEntries(SECTIONS.map((d) => [d.key, d]));
  const quoteRows = parseTable(sec.quote_lines);

  return (
    <Document title={`${quoteNumber} v${versionNo} - ${fields.client.name}`} author="Prime Clean Care">
      {/* Cover */}
      <Page size="LETTER" style={s.page}>
        <Chrome label={label} />
        <Text style={s.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        <Text style={s.coverTitle}>{fields.title}</Text>
        <Text style={s.coverLabel}>PREPARED FOR:</Text>
        <Text style={s.coverName}>{fields.client.name.toUpperCase()}</Text>
        <Text style={s.coverSub}>
          {[fields.client.address_line1, fields.client.address_line2].filter(Boolean).join(" - ")}
        </Text>
        <Text style={s.coverLabel}>SUBMITTED BY:</Text>
        <Text style={s.coverName}>PRIME CLEAN CARE</Text>
        <Text style={s.coverSub}>{fields.tagline}</Text>
        <PdfImage style={s.coverLogo} src={{ data: logo(), format: "png" }} />
        <Text style={s.coverDate}>
          Quote Date: {longDate(fields.quote_date)} · Quote {quoteNumber} · v{versionNo}
        </Text>
      </Page>

      {/* Body */}
      <Page size="LETTER" style={s.page}>
        <Chrome label={label} />
        <Text style={s.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />

        <Text style={s.h2}>1. Scope Summary</Text>
        <Paragraphs text={sec.scope_summary} />

        <Text style={s.h2}>2. Quote Summary</Text>
        <Table columns={defs.quote_lines.columns!} rows={[...quoteRows, { cells: ["TOTAL PROJECT QUOTE", total] }]} />
        <View style={s.totalBox} wrap={false}>
          <Text style={s.totalLabel}>TOTAL PROJECT QUOTE</Text>
          <Text style={s.totalValue}>{total}</Text>
        </View>
        <Paragraphs text={sec.pricing_note} />
        {sec.adjustments.trim() !== "" && (
          <>
            <Text style={s.h3}>Scope-Based Price Adjustments</Text>
            <Paragraphs text={sec.adjustments} />
          </>
        )}

        <Text style={s.h2} break>
          3. Detailed Scope of Work
        </Text>
        <Text style={s.p}>
          The following descriptions define exactly what will be cleaned. Work is limited to the listed surfaces and
          areas.
        </Text>
        <Table columns={defs.scope_details.columns!} rows={parseTable(sec.scope_details)} />
        <Paragraphs text={sec.process_notes} />

        <Text style={s.h2} break>
          4. Exclusions
        </Text>
        <Text style={s.p}>
          The following items are specifically excluded from this quote. They will not be cleaned unless added to the
          scope and priced separately.
        </Text>
        <Table columns={defs.exclusions.columns!} rows={parseTable(sec.exclusions)} />
        <Paragraphs text={sec.exclusion_notes} />

        <Text style={s.h2} break>
          5. Project Conditions
        </Text>
        <Paragraphs text={sec.conditions} />

        <Text style={s.h2}>6. Proposal Acceptance</Text>
        <Text style={s.p}>
          By signing below, the Client accepts the scope, pricing, limitations, and exclusions described in this
          proposal.
        </Text>
        <Text style={[s.p, { fontFamily: "Helvetica-Bold" }]}>Total Project Price: {total}</Text>
        <View style={s.sigRow} wrap={false}>
          <View style={s.sigCol}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY_DARK }}>PRIME CLEAN CARE</Text>
            <Text style={s.sigLine}>Authorized Representative: _______________</Text>
            <Text style={s.sigLine}>Signature: ______________________________</Text>
            <Text style={s.sigLine}>Date: __________________</Text>
          </View>
          <View style={s.sigCol}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY_DARK }}>{fields.client.name.toUpperCase()}</Text>
            <Text style={s.sigLine}>Authorized Representative: _______________</Text>
            <Text style={s.sigLine}>Signature: ______________________________</Text>
            <Text style={s.sigLine}>Date: __________________</Text>
          </View>
        </View>
        <Text style={{ marginTop: 24, fontSize: 8.5, color: MUTED, textAlign: "center" }}>
          Prime Clean Care - Specialty Cleaning Quote - {longDate(fields.quote_date)}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(fields: QuoteFields, quoteNumber: string, versionNo: number): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument fields={fields} quoteNumber={quoteNumber} versionNo={versionNo} />);
}

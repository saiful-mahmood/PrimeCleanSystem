import {
  SECTION_BY_KEY,
  footerLabel,
  formatQuoteMoney,
  longDate,
  parseParagraphs,
  parseTable,
  quoteTotalCents,
  type QuoteFields,
} from "@/lib/quotes/model";

const NAVY = "text-[#1b2f4d]";

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {parseParagraphs(text).map((p, i) => (
        <p key={i} className="mb-2 whitespace-pre-line">
          {p}
        </p>
      ))}
    </>
  );
}

function QuoteTable({ columns, rows }: { columns: [string, string]; rows: { cells: [string, string] }[] }) {
  if (rows.length === 0) return null;
  return (
    <table className="my-2 w-full border text-xs">
      <thead>
        <tr className="bg-[#1f3a5f] text-left text-white">
          <th className="px-2 py-1 font-normal">{columns[0]}</th>
          <th className="w-28 px-2 py-1 font-normal">{columns[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            <td className="px-2 py-1 align-top">{r.cells[0]}</td>
            <td className="px-2 py-1 align-top">{r.cells[1]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className={`text-base font-bold ${NAVY}`}>{children}</h3>;
}

function Signature({ name }: { name: string }) {
  return (
    <div>
      <p className={`font-bold ${NAVY}`}>{name}</p>
      <p className="mt-3">Authorized Representative: ____________</p>
      <p className="mt-3">Signature: ____________</p>
      <p className="mt-3">Date: ________</p>
    </div>
  );
}

/** HTML rendering of a quote snapshot; mirrors the PDF layout for on-screen review. */
export function QuotePreview({ fields, quoteNumber, versionNo }: { fields: QuoteFields; quoteNumber: string; versionNo: number }) {
  const sec = fields.sections;
  const total = formatQuoteMoney(quoteTotalCents(fields));

  return (
    <div className="space-y-4 rounded-md border bg-white p-5 text-sm text-neutral-800 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Prime Clean Care" className="h-9" />
        <span className="text-xs text-neutral-500">
          {quoteNumber} · v{versionNo}
        </span>
      </div>

      <div className="py-6 text-center">
        <p className={`text-lg font-bold ${NAVY}`}>{fields.title}</p>
        <p className={`mt-4 text-xs font-bold ${NAVY}`}>PREPARED FOR:</p>
        <p className={`text-lg font-bold ${NAVY}`}>{fields.client.name.toUpperCase() || "—"}</p>
        <p className="text-xs font-semibold">
          {[fields.client.address_line1, fields.client.address_line2].filter(Boolean).join(" - ")}
        </p>
        <p className={`mt-4 text-xs font-bold ${NAVY}`}>SUBMITTED BY:</p>
        <p className={`text-lg font-bold ${NAVY}`}>PRIME CLEAN CARE</p>
        <p className="text-xs font-semibold">{fields.tagline}</p>
        <p className="mt-4 text-xs text-neutral-500">Quote Date: {longDate(fields.quote_date)}</p>
      </div>

      <H3>1. Scope Summary</H3>
      <Paragraphs text={sec.scope_summary} />

      <H3>2. Quote Summary</H3>
      <QuoteTable
        columns={SECTION_BY_KEY.quote_lines.columns!}
        rows={[...parseTable(sec.quote_lines), { cells: ["TOTAL PROJECT QUOTE", total] }]}
      />
      <div className="flex border border-[#1f3a5f]">
        <div className={`flex-1 bg-[#e8eef5] px-4 py-2 font-bold ${NAVY}`}>TOTAL PROJECT QUOTE</div>
        <div className="flex-1 px-4 py-2 text-center text-xl text-neutral-600">{total}</div>
      </div>
      <Paragraphs text={sec.pricing_note} />
      {sec.adjustments.trim() && (
        <>
          <h4 className="font-semibold text-[#1f3a5f]">Scope-Based Price Adjustments</h4>
          <Paragraphs text={sec.adjustments} />
        </>
      )}

      <H3>3. Detailed Scope of Work</H3>
      <p>The following descriptions define exactly what will be cleaned. Work is limited to the listed surfaces and areas.</p>
      <QuoteTable columns={SECTION_BY_KEY.scope_details.columns!} rows={parseTable(sec.scope_details)} />
      <Paragraphs text={sec.process_notes} />

      <H3>4. Exclusions</H3>
      <p>
        The following items are specifically excluded from this quote. They will not be cleaned unless added to the scope
        and priced separately.
      </p>
      <QuoteTable columns={SECTION_BY_KEY.exclusions.columns!} rows={parseTable(sec.exclusions)} />
      <Paragraphs text={sec.exclusion_notes} />

      <H3>5. Project Conditions</H3>
      <Paragraphs text={sec.conditions} />

      <H3>6. Proposal Acceptance</H3>
      <p>By signing below, the Client accepts the scope, pricing, limitations, and exclusions described in this proposal.</p>
      <p className="font-semibold">Total Project Price: {total}</p>
      <div className="grid grid-cols-2 gap-6 text-xs">
        <Signature name="PRIME CLEAN CARE" />
        <Signature name={fields.client.name.toUpperCase()} />
      </div>
      <p className="border-t pt-3 text-center text-[10px] text-neutral-500">
        PRIME CLEAN CARE · {footerLabel(fields)} · {longDate(fields.quote_date)}
      </p>
    </div>
  );
}

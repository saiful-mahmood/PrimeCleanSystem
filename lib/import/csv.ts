/**
 * Minimal RFC 4180 CSV parser: quoted fields, doubled quotes, embedded
 * newlines, CRLF. Returns rows of strings; no header handling here.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM, which Google Sheets and Excel both emit.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Find the header row (the real sheets have a totals row above it), then
 * return objects keyed by trimmed header. Blank rows are dropped, trailing
 * unnamed columns ignored.
 */
export function rowsToRecords(rows: string[][], firstHeader: string): Record<string, string>[] {
  const headerIdx = rows.findIndex((r) => (r[0] ?? "").trim() === firstHeader);
  if (headerIdx === -1) {
    throw new Error(`Could not find a header row starting with "${firstHeader}".`);
  }
  const headers = rows[headerIdx].map((h) => h.trim());
  const width = headers.filter((h) => h !== "").length;
  const out: Record<string, string>[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (r.every((v) => v.trim() === "")) continue;
    const rec: Record<string, string> = {};
    for (let i = 0; i < width; i++) rec[headers[i]] = (r[i] ?? "").trim();
    out.push(rec);
  }
  return out;
}

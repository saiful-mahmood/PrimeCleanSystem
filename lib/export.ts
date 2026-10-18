/** Serialise rows to CSV with a header. Quotes everything that needs it. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Cents to a plain "123.45" string for spreadsheets. */
export function dollars(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (Number(cents) / 100).toFixed(2);
}

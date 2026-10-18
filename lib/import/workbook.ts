import ExcelJS from "exceljs";
import { rowsToRecords } from "./csv";

/**
 * Read the owner's whole workbook (.xlsx) and split it into the same
 * record sets the CSV path produces, so everything downstream is shared.
 * Tabs are matched by name, case-insensitively; missing tabs are skipped.
 */

export type Tabs = {
  clients?: Record<string, string>[];
  revenues?: Record<string, string>[];
  expenses?: Record<string, string>[];
};

const TAB_NAMES: { key: keyof Tabs; match: RegExp; firstHeader: string }[] = [
  { key: "clients", match: /^client\s*details$/i, firstHeader: "Client Name" },
  { key: "revenues", match: /^revenues?$/i, firstHeader: "Client Name" },
  { key: "expenses", match: /^expenses?$/i, firstHeader: "Subscription" },
];

export async function workbookToTabs(data: ArrayBuffer | Buffer): Promise<{ tabs: Tabs; sheetsFound: string[] }> {
  const wb = new ExcelJS.Workbook();
  // exceljs types want an older Node Buffer signature; the runtime accepts any Buffer/ArrayBuffer.
  await wb.xlsx.load(data as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const tabs: Tabs = {};
  const sheetsFound: string[] = [];
  for (const ws of wb.worksheets) {
    const def = TAB_NAMES.find((t) => t.match.test(ws.name.trim()));
    if (!def) continue;
    sheetsFound.push(ws.name);
    tabs[def.key] = rowsToRecords(sheetToRows(ws), def.firstHeader);
  }
  return { tabs, sheetsFound };
}

/** Every cell as the string the CSV export would have contained. */
export function sheetToRows(ws: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-based; index 0 is empty
    const out: string[] = [];
    for (let c = 1; c < values.length; c++) out.push(cellToString(values[c]));
    rows.push(out);
  });
  return rows;
}

export function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatExcelDate(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue);
    if ("text" in v) return typeof v.text === "string" ? v.text : cellToString(v.text as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

/**
 * ExcelJS hands back dates as JS Dates whose UTC fields hold the cell's
 * wall-clock value, so format from the UTC fields. Date-only cells become
 * "M/D/YYYY"; cells with a time keep it, matching Google Sheets' CSV export.
 */
export function formatExcelDate(d: Date): string {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const date = `${m}/${day}/${y}`;
  return h || mi || s ? `${date} ${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}` : date;
}

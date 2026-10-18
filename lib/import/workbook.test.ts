import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { cellToString, formatExcelDate, workbookToTabs } from "./workbook";

async function buildWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const exp = wb.addWorksheet("Expenses");
  exp.addRow([null, "Total Spent", 123.45]);
  exp.addRow(["Subscription", "Payment Date", "Amount", "Paid With", "Platform", "Recurring Cadence", "Notes"]);
  exp.addRow(["Gas", new Date(Date.UTC(2026, 9, 13)), 68.38, "chase card 7714", "Gas for vehicle", "one time", null]);
  const rev = wb.addWorksheet("Revenues");
  rev.addRow([null, null, null, "Stripe charge total:", null, 633.6]);
  rev.addRow([
    "Client Name",
    "Cleaning Type",
    "Cleaning Date and time",
    "Charged Amount",
    "PMT Received",
    "Stripe 2.9% fee",
    "Charge Method",
    "Provider",
    "Provider Payment",
    "Paid",
    "Payment Method",
    "Profit",
    "Profit Margin",
    "Notes",
  ]);
  rev.addRow([
    "Ali Chaudhry",
    "Deep Cleaning",
    new Date(Date.UTC(2026, 10, 17, 9, 30)),
    375,
    "No",
    11.18,
    "Stripe",
    "Pedro",
    250,
    "Unpaid",
    "Business Zelle",
    { formula: "D3-F3-I3", result: 113.82 },
    0.30352,
    null,
  ]);
  const cd = wb.addWorksheet("Client Details");
  cd.addRow(["Client Name", "Lockbox Codes", "Type of Client", "Location", "Basic Info", "Scope of Work"]);
  cd.addRow(["Ali Javid MOTW", 7530, "Coffee Shop", "Quincy", null, null]);
  wb.addWorksheet("Monthly Profits").addRow(["Month", "Overhead Expenses"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("workbookToTabs", () => {
  it("splits the tabs and renders cells like the CSV export would", async () => {
    const { tabs, sheetsFound } = await workbookToTabs(await buildWorkbook());
    expect(sheetsFound.sort()).toEqual(["Client Details", "Expenses", "Revenues"]);
    expect(tabs.expenses).toEqual([
      {
        Subscription: "Gas",
        "Payment Date": "10/13/2026",
        Amount: "68.38",
        "Paid With": "chase card 7714",
        Platform: "Gas for vehicle",
        "Recurring Cadence": "one time",
        Notes: "",
      },
    ]);
    expect(tabs.revenues?.[0]).toMatchObject({
      "Client Name": "Ali Chaudhry",
      "Cleaning Date and time": "11/17/2026 9:30:00",
      "Charged Amount": "375",
      "Stripe 2.9% fee": "11.18",
      Profit: "113.82",
    });
    expect(tabs.clients?.[0]).toMatchObject({
      "Client Name": "Ali Javid MOTW",
      "Lockbox Codes": "7530",
      Location: "Quincy",
    });
  });

  it("cell conversions", () => {
    expect(cellToString(null)).toBe("");
    expect(cellToString(0.1 + 0.2)).toBe("0.3");
    expect(cellToString({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(formatExcelDate(new Date(Date.UTC(2024, 6, 17)))).toBe("7/17/2024");
    expect(formatExcelDate(new Date(Date.UTC(2024, 6, 17, 14, 5)))).toBe("7/17/2024 14:05:00");
  });
});

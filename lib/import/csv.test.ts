import { describe, expect, it } from "vitest";
import { parseCsv, rowsToRecords } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, commas, doubled quotes and CRLF", () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""",3\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "3"],
    ]);
  });
  it("keeps embedded newlines inside quotes", () => {
    expect(parseCsv('n,"line1\nline2"\n')).toEqual([["n", "line1\nline2"]]);
  });
  it("strips a BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("rowsToRecords", () => {
  it("skips the totals row above the header and trailing empty columns", () => {
    const rows = parseCsv(
      [
        ",Total Spent,24468.24,,,,,,",
        "Subscription,Payment Date,Amount,Paid With,Platform,Recurring Cadence,Notes,,",
        "Gas,10/13/2026,68.38,chase card 7714,Gas for vehicle,one time,,,",
        ",,,,,,,,",
      ].join("\n"),
    );
    const recs = rowsToRecords(rows, "Subscription");
    expect(recs).toHaveLength(1);
    expect(recs[0]).toEqual({
      Subscription: "Gas",
      "Payment Date": "10/13/2026",
      Amount: "68.38",
      "Paid With": "chase card 7714",
      Platform: "Gas for vehicle",
      "Recurring Cadence": "one time",
      Notes: "",
    });
  });
  it("throws when the header is missing", () => {
    expect(() => rowsToRecords([["x", "y"]], "Client Name")).toThrow(/header row/);
  });
});

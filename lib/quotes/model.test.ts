import { describe, expect, it } from "vitest";
import {
  describeChanges,
  emptyFields,
  formatQuoteMoney,
  longDate,
  parseParagraphs,
  parseTable,
  quoteTotalCents,
  toQuoteFields,
} from "./model";

const client = {
  name: "Islamic Center of Boston",
  address_line1: "126 Boston Post Road",
  address_line2: "Wayland, Massachusetts 01778",
  contact_name: "",
  email: "office@example.org",
  phone: "",
  extra_emails: [],
};

describe("parsing", () => {
  it("tables split on the first pipe", () => {
    expect(parseTable("Carpet | $510\n Tile and Grout - 10,000 sq ft | $2,630 \n\nNo separator")).toEqual([
      { cells: ["Carpet", "$510"] },
      { cells: ["Tile and Grout - 10,000 sq ft", "$2,630"] },
      { cells: ["No separator", ""] },
    ]);
  });
  it("paragraphs split on blank lines", () => {
    expect(parseParagraphs("One\nstill one\n\nTwo\n\n\nThree")).toEqual(["One\nstill one", "Two", "Three"]);
  });
});

describe("totals and money", () => {
  it("sums the quote lines", () => {
    const f = emptyFields(client, "2026-09-24");
    f.sections.quote_lines = "A | $510\nB | $2,630\nC | 900\nD | tbd";
    expect(quoteTotalCents(f)).toBe(404000);
    expect(formatQuoteMoney(404000)).toBe("$4,040");
    expect(formatQuoteMoney(123456)).toBe("$1,234.56");
  });
});

describe("describeChanges", () => {
  it("names the sections that changed and a total change", () => {
    const a = emptyFields(client, "2026-09-24");
    a.sections.quote_lines = "A | $510";
    const b = structuredClone(a);
    b.sections.quote_lines = "A | $600";
    b.sections.conditions = "Access required.";
    expect(describeChanges(null, a)).toBe("Created");
    expect(describeChanges(a, b)).toBe("Changed Quote Summary, Project Conditions, total $510 → $600");
    expect(describeChanges(a, a)).toBe("No changes");
  });
});

describe("toQuoteFields and dates", () => {
  it("fills defaults for missing data", () => {
    const f = toQuoteFields({ client: { name: "X" }, sections: { conditions: "c" } });
    expect(f.client.name).toBe("X");
    expect(f.client.extra_emails).toEqual([]);
    expect(f.sections.conditions).toBe("c");
    expect(f.sections.scope_summary).toBe("");
    expect(f.title).toBe("A CUSTOMIZED CLEANING QUOTE");
  });
  it("long dates", () => {
    expect(longDate("2026-09-24")).toBe("September 24, 2026");
  });
});

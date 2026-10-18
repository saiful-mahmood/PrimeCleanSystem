import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { emptyFields } from "./model";

vi.mock("server-only", () => ({}));

const { renderQuotePdf } = await import("./pdf");

describe("renderQuotePdf", () => {
  it("renders a multi-page PDF with the logo for a filled quote", async () => {
    const f = emptyFields(
      {
        name: "Islamic Center of Boston",
        address_line1: "126 Boston Post Road",
        address_line2: "Wayland, Massachusetts 01778",
        contact_name: "",
        email: "office@example.org",
        phone: "",
        extra_emails: [],
      },
      "2026-09-24",
    );
    f.sections.scope_summary =
      "Prime Clean Care completed a thorough walkthrough of the facility.\n\nThe work covered by this quote is specialty cleaning only.";
    f.sections.quote_lines =
      "Prayer Hall Carpet Cleaning - includes deodorizer | $510\nTile and Grout Scrubbing - first floor and basement, approximately 10,000 square feet | $2,630\nWindow Cleaning Service - approximately 200 panes | $900\nPrayer Hall Window Screen and Molding Deep Cleaning | $720";
    f.sections.pricing_note =
      "Pricing is based on the scope and approximate quantities identified during the walkthrough. Any material change in area, quantity, access, or requested work will require separate approval and pricing.";
    f.sections.adjustments =
      "Tile and Grout Scrubbing: $200 off if the basement is out of scope. Adjusted tile and grout price: $2,430.";
    f.sections.scope_details =
      "Prayer Hall Carpet Cleaning | Thorough cleaning of the prayer hall carpeted areas. Deodorizer is included.\nTile and Grout Scrubbing | First floor tile and grout areas, including tiled bathrooms and kitchen, plus basement floor areas. Approximately 10,000 square feet.\nWindow Cleaning - Lower Level | Lower-level windows cleaned on the inside and outside, including window tracks.";
    f.sections.process_notes =
      "Tile and Grout Cleaning Process\nFirst, we will spray the floor with floor wash, then wash it with high-pressure hot water and extract the water.";
    f.sections.exclusions =
      "Walls | Not included\nCobwebs | Not included\nBaseboards | Not included\nBathroom fixtures | Not included, except for tile floor cleaning";
    f.sections.exclusion_notes = "Window cleaning is limited to the glass and tracks described in the scope.";
    f.sections.conditions =
      "The Client will provide reasonable access to all areas included in the scope.\n\nExisting damage, permanent staining, or deteriorated grout cannot be guaranteed to be restored.";

    const pdf = await renderQuotePdf(f, "PCC-2026-0001", 3);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(50_000);
    if (process.env.QUOTE_PDF_OUT) writeFileSync(process.env.QUOTE_PDF_OUT, pdf);
  }, 30_000);
});

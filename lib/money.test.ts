import { describe, expect, it } from "vitest";
import {
  estimateStripeAchFee,
  estimateStripeCardFee,
  formatCents,
  marginPct,
  parseDollars,
  profitCents,
} from "./money";

describe("formatCents", () => {
  it("formats whole and fractional dollars", () => {
    expect(formatCents(125000)).toBe("$1,250.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
  });
  it("formats negatives", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });
  it("rejects non-integers", () => {
    expect(() => formatCents(12.5)).toThrow();
  });
});

describe("parseDollars", () => {
  it("parses sheet-style strings", () => {
    expect(parseDollars("$1,250.00")).toBe(125000);
    expect(parseDollars("375")).toBe(37500);
    expect(parseDollars("12.5")).toBe(1250);
    expect(parseDollars(" $ 20 ")).toBe(2000);
  });
  it("parses numbers from the workbook", () => {
    expect(parseDollars(375.0)).toBe(37500);
    expect(parseDollars(11.18)).toBe(1118);
    expect(parseDollars(0.1 + 0.2)).toBe(30);
  });
  it("handles negatives and accounting parentheses", () => {
    expect(parseDollars("-5.00")).toBe(-500);
    expect(parseDollars("(5.00)")).toBe(-500);
  });
  it("returns null for blank or junk", () => {
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("  ")).toBeNull();
    expect(parseDollars(null)).toBeNull();
    expect(parseDollars(undefined)).toBeNull();
    expect(parseDollars("Yes")).toBeNull();
    expect(parseDollars("$")).toBeNull();
  });
  it("rounds third decimal", () => {
    expect(parseDollars("1.005")).toBe(101);
    expect(parseDollars("1.004")).toBe(100);
  });
});

describe("fee estimates", () => {
  it("card: 2.9% + 30c", () => {
    expect(estimateStripeCardFee(37500)).toBe(1118);
    expect(estimateStripeCardFee(12000)).toBe(378);
  });
  it("ach: 0.8% capped at $5", () => {
    expect(estimateStripeAchFee(28000)).toBe(224);
    expect(estimateStripeAchFee(100000)).toBe(500);
  });
});

describe("margin", () => {
  it("matches the sheet's profit column", () => {
    expect(profitCents(37500, 1118, 25000)).toBe(11382);
    expect(marginPct(37500, 1118, 25000)).toBe(30.4);
    expect(marginPct(28000, 0, 16500)).toBe(41.1);
  });
  it("is null when nothing was charged", () => {
    expect(marginPct(0, 0, 0)).toBeNull();
  });
});

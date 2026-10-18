import { describe, expect, it } from "vitest";
import {
  normalizeAll,
  normalizeCadence,
  normalizeChargeMethod,
  normalizePmt,
  normalizeServiceName,
  parseSheetDate,
  proposeAlias,
  proposeCategory,
  proposeClientType,
} from "./normalize";

describe("parseSheetDate", () => {
  it("US dates with and without time", () => {
    expect(parseSheetDate("11/17/2026")).toEqual({ local: "2026-11-17", time: null });
    expect(parseSheetDate("7/17/2024 9:00:00")).toEqual({ local: "2024-07-17", time: "09:00" });
    expect(parseSheetDate("7/17/2024 2:30 PM")).toEqual({ local: "2024-07-17", time: "14:30" });
    expect(parseSheetDate("7/17/2024 0:00:00")).toEqual({ local: "2024-07-17", time: null });
  });
  it("ISO dates", () => {
    expect(parseSheetDate("2026-11-17")).toEqual({ local: "2026-11-17", time: null });
    expect(parseSheetDate("2026-11-17 09:00:00")).toEqual({ local: "2026-11-17", time: "09:00" });
    expect(parseSheetDate("2026-11-17T14:00:00Z")).toEqual({ local: "2026-11-17", time: "09:00" });
  });
  it("junk is null", () => {
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("next tuesday")).toBeNull();
  });
});

describe("value normalisers", () => {
  it("service names, trimmed and case-folded", () => {
    expect(normalizeServiceName(" Regular Cleaning")).toBe("Regular Cleaning");
    expect(normalizeServiceName("Event cleaning")).toBe("Event Cleaning");
    expect(normalizeServiceName("Patio Walkway Build")).toBe("Landscaping / Construction");
    expect(normalizeServiceName("Move Out Cleaning")).toBe("Move-Out Cleaning");
    expect(normalizeServiceName("Construction Cleaning")).toBe("Post-Construction Cleaning");
  });
  it("charge methods incl. Venmo", () => {
    expect(normalizeChargeMethod("Stripe")).toBe("stripe_card");
    expect(normalizeChargeMethod("ACH")).toBe("stripe_ach");
    expect(normalizeChargeMethod("Venmo")).toBe("venmo");
    expect(normalizeChargeMethod("Check")).toBe("check");
    expect(normalizeChargeMethod("")).toBeNull();
  });
  it("PMT Received states", () => {
    expect(normalizePmt("Yes")).toBe("yes");
    expect(normalizePmt("No")).toBe("no");
    expect(normalizePmt("In Progress")).toBe("in_progress");
  });
  it("cadence", () => {
    expect(normalizeCadence("yearly")).toEqual({ cadence: "annual", note: null });
    expect(normalizeCadence("na")).toEqual({ cadence: "one_time", note: null });
    expect(normalizeCadence("two years")).toEqual({ cadence: "one_time", note: "Cadence in sheet: two years" });
  });
  it("expense categories", () => {
    expect(proposeCategory("Ad Expenditure", "Google LSA")).toBe("ads");
    expect(proposeCategory("General Liability Insurance", "Thimble")).toBe("insurance");
    expect(proposeCategory("BookingKoala", "bookingkoala")).toBe("software");
    expect(proposeCategory("Cleaning Supplies", "Home Depot")).toBe("supplies");
    expect(proposeCategory("Gas", "Gas for vehicle")).toBe("overhead");
  });
});

describe("proposeAlias", () => {
  it("collapses service suffixes onto the client", () => {
    expect(proposeAlias("Sharon ICNE - Regular Cleaning")).toEqual({
      canonical: "Sharon ICNE",
      service: "Regular Cleaning",
      label: "Sharon ICNE - Regular Cleaning",
    });
    expect(proposeAlias("Sharon ICNE - Ramadan").canonical).toBe("Sharon ICNE");
    expect(proposeAlias("Malik Academy - week of 10_26")).toMatchObject({ canonical: "Malik Academy", service: null });
  });
  it("puts the place first when the head is a service", () => {
    expect(proposeAlias("Lawn Mowing - Weston House")).toEqual({
      canonical: "Weston House",
      service: "Lawn Mowing",
      label: "Lawn Mowing - Weston House",
    });
  });
  it("special cases and plain names", () => {
    expect(proposeAlias("Sharon Lockbox Code").canonical).toBe("Sharon ICNE");
    expect(proposeAlias("Kerry Kurz")).toEqual({ canonical: "Kerry Kurz", service: null, label: null });
    expect(proposeAlias("Sharon School - Regular Cleaning").canonical).toBe("Sharon School");
  });
});

describe("proposeClientType", () => {
  it("Client Details rows are commercial; people are residential; businesses are commercial", () => {
    expect(proposeClientType("Zaid Arwa Coffee", true)).toBe("commercial");
    expect(proposeClientType("Kerry Kurz", false)).toBe("residential");
    expect(proposeClientType("Malik Academy", false)).toBe("commercial");
    expect(proposeClientType("266 Central St", false)).toBe("residential");
    expect(proposeClientType("Watch City MMA", false)).toBe("commercial");
  });
});

describe("normalizeAll on sheet-shaped rows", () => {
  const revenues = [
    {
      "Client Name": "Sharon ICNE - Regular Cleaning",
      "Cleaning Type": " Regular Cleaning",
      "Cleaning Date and time": "11/1/2026",
      "Charged Amount": "280",
      "PMT Received": "No",
      "Stripe 2.9% fee": "0",
      "Charge Method": "Check",
      Provider: "Luciane",
      "Provider Payment": "165",
      Paid: "Unpaid",
      "Payment Method": "Business Zelle",
      Profit: "115",
      "Profit Margin": "0.41",
      Notes: "",
    },
    {
      "Client Name": "Ali Chaudhry",
      "Cleaning Type": "Deep Cleaning",
      "Cleaning Date and time": "3/10/2026 10:00:00",
      "Charged Amount": "$375.00",
      "PMT Received": "Yes",
      "Stripe 2.9% fee": "0",
      "Charge Method": "Stripe",
      Provider: "Caludia",
      "Provider Payment": "250",
      Paid: "Paid",
      "Payment Method": "Personal Zelle",
      Profit: "",
      "Profit Margin": "",
      Notes: "100 deposit paid",
    },
    {
      "Client Name": "Malik Academy - week of 10_26",
      "Cleaning Type": "Regular Cleaning",
      "Cleaning Date and time": "10/26/2026",
      "Charged Amount": "900",
      "PMT Received": "In Progress",
      "Stripe 2.9% fee": "0",
      "Charge Method": "ACH",
      Provider: "Pedro",
      "Provider Payment": "600",
      Paid: "Paid",
      "Payment Method": "Business Zelle",
      Profit: "",
      "Profit Margin": "",
      Notes: "",
    },
  ];
  const clients = [
    {
      "Client Name": "Sharon Lockbox Code",
      "Lockbox Codes": "7890.0",
      "Type of Client": "Mosque",
      Location: "Sharon",
      "Basic Info": "",
      "Scope of Work": "",
    },
  ];
  const now = new Date("2026-10-17T12:00:00Z");
  const n = normalizeAll({ clients, revenues, now });

  it("resolves aliases and types", () => {
    expect(n.clientAliases["Sharon ICNE - Regular Cleaning"]).toBe("Sharon ICNE");
    expect(n.clientAliases["Sharon Lockbox Code"]).toBe("Sharon ICNE");
    expect(n.clientAliases["Malik Academy - week of 10_26"]).toBe("Malik Academy");
    expect(n.clientTypes["Sharon ICNE"]).toBe("commercial");
    expect(n.clientTypes["Ali Chaudhry"]).toBe("residential");
    expect(n.clients[0].lockboxCode).toBe("7890");
    expect(n.clients[0].city).toBe("Sharon");
  });

  it("maps money, payment state and times", () => {
    const [sharon, ali, malik] = n.revenues;
    expect(sharon.pmt).toBe("no");
    expect(sharon.paid).toBe(false);
    expect(sharon.feeCents).toBe(0);
    expect(sharon.scheduledStart).toBe("2026-11-01T14:00:00.000Z"); // 09:00 EST default
    expect(sharon.isFuture).toBe(true);
    expect(sharon.notes).toBe("Sheet label: Sharon ICNE - Regular Cleaning");

    expect(ali.chargeCents).toBe(37500);
    expect(ali.provider).toBe("Claudia");
    expect(ali.paid).toBe(true);
    expect(ali.feeEstimated).toBe(true);
    expect(ali.feeCents).toBe(1118);
    expect(ali.hadTime).toBe(true);
    expect(ali.scheduledStart).toBe("2026-03-10T14:00:00.000Z"); // 10:00 EDT
    expect(ali.payoutLabel).toBe("Personal Zelle");
    expect(ali.notes).toBe("100 deposit paid");

    expect(malik.pmt).toBe("in_progress");
    expect(malik.chargeMethod).toBe("stripe_ach");
    expect(malik.feeCents).toBe(500); // 0.8% of $900 = $7.20, capped at $5
  });

  it("collects warnings and mapping tables", () => {
    expect(n.warnings.filter((w) => w.message.includes("estimated"))).toHaveLength(2);
    expect(Object.keys(n.providerMerges).sort()).toEqual(["Claudia", "Luciane", "Pedro"]);
    expect(n.serviceNames).toEqual(["Deep Cleaning", "Regular Cleaning"]);
  });
});

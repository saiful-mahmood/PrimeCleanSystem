// Money is integer cents everywhere. These are the only places dollars appear.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 125000 -> "$1,250.00"; -500 -> "-$5.00" */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatCents expects integer cents, got ${cents}`);
  }
  return usd.format(cents / 100);
}

/**
 * Parse a dollar string or number into integer cents.
 * "$1,250.00" -> 125000, "12.5" -> 1250, "(5.00)" -> -500, 375 -> 37500.
 * Returns null for blank or unparseable input.
 */
export function parseDollars(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let s = input.trim();
  if (s === "") return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Math.round(Number((frac + "000").slice(0, 3)) / 10);
  return negative ? -cents : cents;
}

/**
 * Stripe US standard pricing (stripe.com/pricing, checked Nov 2026):
 *   cards            2.9% + 30¢ per successful charge
 *   ACH Direct Debit 0.8%, capped at $5.00
 *   Invoicing        +0.4% of each paid invoice (Starter tier), on top of the payment fee
 * Fees are computed on the amount actually paid and rounded to the cent.
 */
export const STRIPE_CARD_PCT = 0.029;
export const STRIPE_CARD_FIXED_CENTS = 30;
export const STRIPE_ACH_PCT = 0.008;
export const STRIPE_ACH_CAP_CENTS = 500;
export const STRIPE_INVOICING_PCT = 0.004;

/** Stripe card pricing: 2.9% + 30¢, rounded to the nearest cent. */
export function estimateStripeCardFee(amountCents: number): number {
  return Math.round(amountCents * STRIPE_CARD_PCT) + STRIPE_CARD_FIXED_CENTS;
}

/** Stripe ACH Direct Debit pricing: 0.8% capped at $5. */
export function estimateStripeAchFee(amountCents: number): number {
  return Math.min(Math.round(amountCents * STRIPE_ACH_PCT), STRIPE_ACH_CAP_CENTS);
}

/** Stripe Invoicing adds 0.4% of the paid amount to whichever payment fee applied. */
export function estimateStripeInvoicingFee(amountCents: number): number {
  return Math.round(amountCents * STRIPE_INVOICING_PCT);
}

/**
 * The fee Stripe keeps for a payment made a given way; 0 for Zelle, check,
 * cash and Venmo. Commercial invoices are paid by ACH (SPEC), so a Stripe
 * invoice is the ACH fee plus the invoicing fee.
 */
export function estimateStripeFee(method: string | null | undefined, amountCents: number): number {
  switch (method) {
    case "stripe_card":
      return estimateStripeCardFee(amountCents);
    case "stripe_ach":
      return estimateStripeAchFee(amountCents);
    case "stripe_invoice":
      return estimateStripeAchFee(amountCents) + estimateStripeInvoicingFee(amountCents);
    default:
      return 0;
  }
}

export function isStripeMethod(method: string | null | undefined): boolean {
  return method === "stripe_card" || method === "stripe_ach" || method === "stripe_invoice";
}

/** Per-job margin: charge minus fees minus cleaner pay. */
export function profitCents(chargeCents: number, feeCents: number, providerPayCents: number): number {
  return chargeCents - feeCents - providerPayCents;
}

/** Margin as a percentage of charge, one decimal; null when charge is 0. */
export function marginPct(chargeCents: number, feeCents: number, providerPayCents: number): number | null {
  if (chargeCents === 0) return null;
  return Math.round((1000 * profitCents(chargeCents, feeCents, providerPayCents)) / chargeCents) / 10;
}

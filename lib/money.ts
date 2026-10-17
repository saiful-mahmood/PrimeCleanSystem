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

/** Stripe card pricing: 2.9% + 30¢, rounded to the nearest cent. */
export function estimateStripeCardFee(amountCents: number): number {
  return Math.round(amountCents * 0.029) + 30;
}

/** Stripe ACH Direct Debit pricing: 0.8% capped at $5. */
export function estimateStripeAchFee(amountCents: number): number {
  return Math.min(Math.round(amountCents * 0.008), 500);
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

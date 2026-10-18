import { estimateStripeAchFee, estimateStripeCardFee, parseDollars } from "@/lib/money";
import { localToInstant } from "@/lib/tz";

/**
 * Pure normalisation of the three CSV tabs into typed rows plus warnings and
 * proposed mappings. Everything here is testable without a database; the
 * owner reviews the output in the import preview before anything is written.
 * Rules: docs/IMPORT_MAPPING.md.
 */

export type Warning = { tab: "clients" | "revenues" | "expenses"; row: number; message: string };

export type ClientDetailRow = {
  row: number;
  sheetName: string;
  canonical: string;
  category: string | null; // "Coffee Shop", "Church"...
  city: string | null;
  basicInfo: string | null;
  scopeOfWork: string | null;
  lockboxCode: string | null; // plain text, encrypted at commit; never persisted in the preview payload
};

export type PmtState = "yes" | "no" | "in_progress";
export type ChargeMethod = "stripe_card" | "stripe_ach" | "stripe_invoice" | "zelle" | "check" | "cash" | "venmo";

export type RevenueRow = {
  row: number;
  sheetClient: string;
  canonical: string; // client after alias resolution (editable in preview)
  serviceName: string; // normalised service type name
  scheduledStart: string; // ISO instant
  hadTime: boolean;
  chargeCents: number;
  pmt: PmtState;
  feeCents: number;
  feeEstimated: boolean;
  chargeMethod: ChargeMethod | null;
  provider: string | null; // after merges
  providerPayCents: number;
  paid: boolean;
  payoutLabel: string | null; // "Business Zelle" / "Personal Zelle"
  notes: string | null;
  isFuture: boolean;
};

export type ExpenseRow = {
  row: number;
  name: string;
  paidAt: string; // YYYY-MM-DD
  amountCents: number;
  paidWith: string | null;
  platform: string | null;
  cadence: "one_time" | "weekly" | "monthly" | "quarterly" | "annual";
  category: "overhead" | "software" | "ads" | "supplies" | "insurance" | "other";
  notes: string | null;
};

export type Normalized = {
  clients: ClientDetailRow[];
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
  warnings: Warning[];
  /** sheet name → canonical client, for every distinct name seen */
  clientAliases: Record<string, string>;
  /** canonical client → residential | commercial (proposed) */
  clientTypes: Record<string, "residential" | "commercial">;
  /** sheet provider → canonical provider */
  providerMerges: Record<string, string>;
  serviceNames: string[];
};

// ---------------------------------------------------------------------------
// Dates and amounts
// ---------------------------------------------------------------------------

/** "11/17/2026", "11/17/2026 9:00", "11/17/2026 9:00:00 AM", "2026-11-17 09:00", "2026-11-17T14:00:00Z" */
export function parseSheetDate(raw: string): { local: string; time: string | null } | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/);
  if (m) {
    const [, mo, d, yRaw, h, mi, , ampm] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return { local: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, time: toTime(h, mi, ampm) };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[AaPp][Mm])?)?$/);
  if (m) {
    const [, y, mo, d, h, mi, , suffix] = m;
    if (suffix === "Z" && h) {
      // A true UTC instant (e.g. from a programmatic export): convert to local.
      const inst = new Date(`${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:00Z`);
      const local = inst.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const time = inst.toLocaleTimeString("en-GB", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
      });
      return { local, time };
    }
    return { local: `${y}-${mo}-${d}`, time: toTime(h, mi, suffix) };
  }
  return null;
}

function toTime(h?: string, mi?: string, ampm?: string): string | null {
  if (!h || !mi) return null;
  let hour = Number(h);
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (hour === 0 && Number(mi) === 0 && !ampm) return null; // midnight = "no time given"
  return `${String(hour).padStart(2, "0")}:${mi}`;
}

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const SERVICE_MAP: [RegExp, string][] = [
  [/^regular/i, "Regular Cleaning"],
  [/^deep/i, "Deep Cleaning"],
  [/^home/i, "Home Cleaning"],
  [/move.?out|move.?in/i, "Move-Out Cleaning"],
  [/^event cleaning/i, "Event Cleaning"],
  [/^event support/i, "Event Support"],
  [/carpet/i, "Carpet Cleaning"],
  [/steam/i, "Steam Cleaning"],
  [/post.?construction|construction cleaning/i, "Post-Construction Cleaning"],
  [/lawn/i, "Lawn Mowing"],
  [/spring/i, "Spring Cleanup"],
  [/snow/i, "Snow Plowing"],
  [/patio|fence|tree|prun|weed|walkway|build|install/i, "Landscaping / Construction"],
  [/commercial/i, "Commercial Cleaning"],
];

export function normalizeServiceName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  for (const [re, name] of SERVICE_MAP) if (re.test(s)) return name;
  return s || "Regular Cleaning";
}

export function normalizeChargeMethod(raw: string): ChargeMethod | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("ach")) return "stripe_ach";
  if (s.includes("invoice")) return "stripe_invoice";
  if (s.includes("stripe") || s.includes("card")) return "stripe_card";
  if (s.includes("zelle")) return "zelle";
  if (s.includes("venmo")) return "venmo";
  if (s.includes("check") || s.includes("cheque")) return "check";
  if (s.includes("cash")) return "cash";
  return null;
}

export function normalizePmt(raw: string): PmtState {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("y") || s === "paid" || s === "true" || s === "✓") return "yes";
  if (s.includes("progress") || s.includes("pending") || s.includes("invoice")) return "in_progress";
  return "no";
}

export function normalizePaid(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  return s === "paid" || s === "yes" || s === "y" || s === "true" || s === "✓";
}

/** Known typos from the real sheet; exact match otherwise (DECISIONS.md). */
const PROVIDER_FIXES: Record<string, string> = { caludia: "Claudia" };

export function normalizeProvider(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  return PROVIDER_FIXES[s.toLowerCase()] ?? s;
}

/**
 * Propose the canonical client for a sheet name. "Sharon ICNE - Event
 * Cleaning" → "Sharon ICNE"; "Lawn Mowing - Weston House" → "Weston House";
 * "Sharon Lockbox Code" → "Sharon ICNE". Returns the canonical and, when the
 * suffix names a service, that service.
 */
export function proposeAlias(sheetName: string): { canonical: string; service: string | null; label: string | null } {
  const s = sheetName.trim().replace(/\s+/g, " ");
  if (/^sharon lockbox/i.test(s)) return { canonical: "Sharon ICNE", service: null, label: null };
  const parts = s.split(/\s+-\s+/);
  if (parts.length < 2) return { canonical: s, service: null, label: null };
  const [head, ...rest] = parts;
  const tail = rest.join(" - ");
  const headIsService = SERVICE_MAP.some(([re]) => re.test(head)) && !/icne|academy|house|school/i.test(head);
  if (headIsService) {
    // "Lawn Mowing - Weston House": the place is the client, the head is the service.
    return { canonical: tail, service: normalizeServiceName(head), label: s };
  }
  const tailIsService = SERVICE_MAP.some(([re]) => re.test(tail)) && !/week of|house|apartment/i.test(tail);
  return { canonical: head, service: tailIsService ? normalizeServiceName(tail) : null, label: s };
}

const BUSINESS_WORDS =
  /\b(icne|academy|school|church|parish|masjid|mosque|center|centre|restaurant|cafe|coffee|pub|house of|realty|real estate|llc|inc|mma|spa|salon|hall|clinic|storage|building|remodel|festival|pockets|motw|wic|isgm|arwa|boston|providence|streetcar|revive|built)\b/i;

export function proposeClientType(canonical: string, fromClientDetails: boolean): "residential" | "commercial" {
  if (fromClientDetails) return "commercial";
  if (BUSINESS_WORDS.test(canonical)) return "commercial";
  if (/\d/.test(canonical)) return "residential"; // "266 Central St", "100 Angelica Drive"
  const words = canonical.trim().split(/\s+/);
  return words.length <= 3 ? "residential" : "commercial";
}

const CATEGORY_RULES: [RegExp, ExpenseRow["category"]][] = [
  [/ad expend|google lsa|\bads?\b|prospix|yelp|thumbtack|angi/i, "ads"],
  [/thimble|insurance/i, "insurance"],
  [
    /bookingkoala|google drive|slack|godaddy|squarespace|openphone|vercel|replicate|chatgpt|cohesive|miro|fiverr|canva|davinci|visible|quo\b|openai|r&d app|app development/i,
    "software",
  ],
  [/cleaning suppl|cleaning equip|^equipment|autozone|supplies/i, "supplies"],
];

export function proposeCategory(name: string, platform: string): ExpenseRow["category"] {
  const hay = `${name} ${platform}`;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return "overhead";
}

export function normalizeCadence(raw: string): { cadence: ExpenseRow["cadence"]; note: string | null } {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("month")) return { cadence: "monthly", note: null };
  if (s.startsWith("week")) return { cadence: "weekly", note: null };
  if (s.startsWith("quarter")) return { cadence: "quarterly", note: null };
  if (s.startsWith("year") || s.startsWith("annual")) return { cadence: "annual", note: null };
  if (s === "" || s === "na" || s === "n/a" || s === "once" || s.startsWith("one"))
    return { cadence: "one_time", note: null };
  return { cadence: "one_time", note: `Cadence in sheet: ${raw.trim()}` };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export function normalizeClientDetails(recs: Record<string, string>[], warnings: Warning[]): ClientDetailRow[] {
  const out: ClientDetailRow[] = [];
  recs.forEach((r, i) => {
    const row = i + 1;
    const sheetName = r["Client Name"] ?? "";
    if (!sheetName) {
      warnings.push({ tab: "clients", row, message: "Blank client name; row skipped." });
      return;
    }
    const code = (r["Lockbox Codes"] ?? "").trim();
    out.push({
      row,
      sheetName,
      canonical: proposeAlias(sheetName).canonical,
      category: r["Type of Client"]?.trim() || null,
      city: r["Location"]?.trim() || null,
      basicInfo: r["Basic Info"]?.trim() || null,
      scopeOfWork: r["Scope of Work"]?.trim() || null,
      lockboxCode: code ? code.replace(/\.0+$/, "") : null,
    });
  });
  return out;
}

export function normalizeRevenues(recs: Record<string, string>[], warnings: Warning[], now = new Date()): RevenueRow[] {
  const out: RevenueRow[] = [];
  recs.forEach((r, i) => {
    const row = i + 1;
    const sheetClient = (r["Client Name"] ?? "").trim();
    if (!sheetClient) {
      warnings.push({ tab: "revenues", row, message: "Blank client name; row skipped." });
      return;
    }
    const date = parseSheetDate(r["Cleaning Date and time"] ?? "");
    if (!date) {
      warnings.push({
        tab: "revenues",
        row,
        message: `Unparseable date "${r["Cleaning Date and time"]}"; row skipped.`,
      });
      return;
    }
    const charge = parseDollars(r["Charged Amount"]);
    if (charge === null) {
      warnings.push({
        tab: "revenues",
        row,
        message: `Unparseable Charged Amount "${r["Charged Amount"]}"; row skipped.`,
      });
      return;
    }
    const alias = proposeAlias(sheetClient);
    const serviceName = alias.service ?? normalizeServiceName(r["Cleaning Type"] ?? "");
    const chargeMethod = normalizeChargeMethod(r["Charge Method"] ?? "");
    if ((r["Charge Method"] ?? "").trim() && !chargeMethod) {
      warnings.push({ tab: "revenues", row, message: `Unknown Charge Method "${r["Charge Method"]}"; left blank.` });
    }
    let fee = parseDollars(r["Stripe 2.9% fee"]) ?? 0;
    let feeEstimated = false;
    if (fee === 0 && (chargeMethod === "stripe_card" || chargeMethod === "stripe_ach")) {
      fee = chargeMethod === "stripe_ach" ? estimateStripeAchFee(charge) : estimateStripeCardFee(charge);
      feeEstimated = true;
      warnings.push({ tab: "revenues", row, message: `Stripe row with no fee; estimated $${(fee / 100).toFixed(2)}.` });
    }
    const provider = normalizeProvider(r["Provider"] ?? "");
    const pay = parseDollars(r["Provider Payment"]) ?? 0;
    if (!provider && pay > 0)
      warnings.push({ tab: "revenues", row, message: "Provider Payment without a Provider; pay ignored." });
    const paid = normalizePaid(r["Paid"] ?? "");
    const scheduledStart = localToInstant(date.local, date.time ?? "09:00");
    const notesParts = [alias.label ? `Sheet label: ${alias.label}` : null, (r["Notes"] ?? "").trim() || null].filter(
      Boolean,
    );
    out.push({
      row,
      sheetClient,
      canonical: alias.canonical,
      serviceName,
      scheduledStart: scheduledStart.toISOString(),
      hadTime: date.time !== null,
      chargeCents: charge,
      pmt: normalizePmt(r["PMT Received"] ?? ""),
      feeCents: fee,
      feeEstimated,
      chargeMethod,
      provider,
      providerPayCents: provider ? pay : 0,
      paid: provider ? paid : false,
      payoutLabel: (r["Payment Method"] ?? "").trim() || null,
      notes: notesParts.length ? notesParts.join("\n") : null,
      isFuture: scheduledStart.getTime() > now.getTime(),
    });
  });
  return out;
}

export function normalizeExpenses(recs: Record<string, string>[], warnings: Warning[]): ExpenseRow[] {
  const out: ExpenseRow[] = [];
  recs.forEach((r, i) => {
    const row = i + 1;
    const name = (r["Subscription"] ?? "").trim();
    if (!name) {
      warnings.push({ tab: "expenses", row, message: "Blank name; row skipped." });
      return;
    }
    const date = parseSheetDate(r["Payment Date"] ?? "");
    if (!date) {
      warnings.push({ tab: "expenses", row, message: `Unparseable Payment Date "${r["Payment Date"]}"; row skipped.` });
      return;
    }
    const amount = parseDollars(r["Amount"]);
    if (amount === null) {
      warnings.push({ tab: "expenses", row, message: `"${name}" has no amount; row skipped.` });
      return;
    }
    const { cadence, note } = normalizeCadence(r["Recurring Cadence"] ?? "");
    const platform = (r["Platform"] ?? "").trim();
    const notes = [(r["Notes"] ?? "").trim() || null, note].filter(Boolean).join("\n") || null;
    out.push({
      row,
      name,
      paidAt: date.local,
      amountCents: amount,
      paidWith: (r["Paid With"] ?? "").trim() || null,
      platform: platform || null,
      cadence,
      category: proposeCategory(name, platform),
      notes,
    });
  });
  return out;
}

/** Combine the tabs and derive the mapping tables the preview edits. */
export function normalizeAll(input: {
  clients?: Record<string, string>[];
  revenues?: Record<string, string>[];
  expenses?: Record<string, string>[];
  now?: Date;
}): Normalized {
  const warnings: Warning[] = [];
  const clients = normalizeClientDetails(input.clients ?? [], warnings);
  const revenues = normalizeRevenues(input.revenues ?? [], warnings, input.now);
  const expenses = normalizeExpenses(input.expenses ?? [], warnings);

  // Case-insensitive canonical grouping: "Locs By Us" and "Locs by us" are one client.
  const canonicalByLower = new Map<string, string>();
  const canon = (name: string) => {
    const key = name.toLowerCase();
    if (!canonicalByLower.has(key)) canonicalByLower.set(key, name);
    return canonicalByLower.get(key)!;
  };
  const clientAliases: Record<string, string> = {};
  const fromDetails = new Set<string>();
  for (const c of clients) {
    c.canonical = canon(c.canonical);
    clientAliases[c.sheetName] = c.canonical;
    fromDetails.add(c.canonical);
  }
  for (const r of revenues) {
    r.canonical = canon(r.canonical);
    clientAliases[r.sheetClient] = r.canonical;
  }
  const clientTypes: Record<string, "residential" | "commercial"> = {};
  for (const name of new Set(Object.values(clientAliases))) {
    clientTypes[name] = proposeClientType(name, fromDetails.has(name));
  }
  const providerMerges: Record<string, string> = {};
  for (const r of revenues) if (r.provider) providerMerges[r.provider] = r.provider;
  const serviceNames = [...new Set(revenues.map((r) => r.serviceName))].sort();

  return { clients, revenues, expenses, warnings, clientAliases, clientTypes, providerMerges, serviceNames };
}

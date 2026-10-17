# Importing the old Google Sheet

The source is the workbook **Prime Clean Care CRM.xlsx** (four tabs). Export each tab as CSV
(File → Download → Comma Separated Values) and upload them in Settings → Import. Headers must
match the templates in `data/imports/` exactly. Blank cells are fine. Real exports are never
committed to the repo.

Facts about the real workbook as of 2026-10-17 that the importer must handle:

- **Expenses and Revenues have a totals row above the header.** The header is row 2. The
  importer finds the header by looking for the first row whose first cell is `Subscription` /
  `Client Name`.
- Trailing empty columns exist on every tab; ignore columns with no header.
- Every amount is numeric and every date parses; the mess is in the text columns.

## Client Details → `clients` + `locations`

7 rows, all commercial. "Type of Client" is a business category, not residential/commercial.

| Sheet column | Goes to | Notes |
|---|---|---|
| Client Name | `clients.name` via alias table | Must resolve to one client. "Sharon Lockbox Code" → Sharon ICNE. |
| Lockbox Codes | `locations.lockbox_code_enc` | Encrypted on import. Numeric in the sheet; store as text, keep leading zeros. Plain text is never stored or logged. |
| Type of Client | `clients.type` = `commercial`; original text → `clients.basic_info` | Coffee Shop, Restaurant, Church, Mosque, Salon. |
| Location | `locations.city` | City only in the real sheet. `address_line1` stays blank until the owner fills it in. |
| Basic Info | appended to `clients.basic_info` | Blank in the real sheet. |
| Scope of Work | `locations.scope_of_work` | Blank in the real sheet. |

Clients that appear only in Revenues are created with one location labelled "Main" and no
address.

## Revenues → `clients` + `jobs` + `job_assignments` + `payments` + `invoices` + `payouts`

702 rows, 2024-07-17 to 2026-11-17 (19 future rows). 114 distinct client strings.

| Sheet column | Goes to | Notes |
|---|---|---|
| Client Name | `jobs.client_id` via **alias table** | Names carry suffixes: "Sharon ICNE - Event Cleaning", "Malik Academy - week of 10_26", "Lawn Mowing - Weston House". The preview proposes canonical client ← aliases; the owner edits. Suffix text → `jobs.notes` (prefixed "Sheet label: "). Where the suffix names a service type it overrides Cleaning Type. **Sharon ICNE ≠ Sharon School.** |
| Cleaning Type | `jobs.service_type_id` via lookup | Trim and case-fold (" Regular Cleaning", "Event cleaning"). 20 variants map onto the seeded service types; unknown → warning with a dropdown. |
| Cleaning Date and time | `jobs.scheduled_start` | Parsed in America/New_York. 574 rows are midnight → 09:00; 128 carry a real time. |
| Charged Amount | `jobs.charge_cents` | Dollars → cents. |
| PMT Received | see below | **Yes / No / In Progress**, not an amount. |
| Stripe 2.9% fee | `payments.fee_cents` | Kept as entered. If Charge Method is Stripe/ACH and the fee is 0, estimate 2.9% + 30¢ (card) or 0.8% capped at $5 (ACH) and flag the row. |
| Charge Method | `jobs.charge_method`, `payments.method` | Check → `check`; Zelle → `zelle`; Stripe → `stripe_card`; ACH → `stripe_ach`; **Venmo → `venmo`** (added in migration 0002). |
| Provider | `job_assignments.provider_id` via exact match | 28 distinct names incl. companies. Creates missing providers (flagged). Merge rule: **Caludia → Claudia**. |
| Provider Payment | `job_assignments.pay_cents` | |
| Paid | `payouts` | `Paid` → a one-assignment payout, `paid_at` = cleaning date, `reference` = "imported". `Unpaid` → assignment stays unpaid and appears in "owed". |
| Payment Method | `payouts.method` = `zelle`; original text → `payouts.notes` | Business Zelle / Personal Zelle. |
| Profit, Profit Margin | not imported | Recomputed by `v_job_economics`; shown side by side in the preview. |
| Notes | appended to `jobs.notes` | 71 rows have notes. |

**PMT Received:**

| Value | Rows | Effect |
|---|---|---|
| Yes | 662 | `payments` row: amount = charge, fee from the fee column, `received_at` = cleaning date, `external_ref` = "imported". |
| No | 18 | No payment. Past rows show in `v_ar_aging` as unpaid jobs. |
| In Progress | 22 | Invoice sent, waiting on the client: `invoices` row (`status = sent`, `method` from Charge Method, `amount` = charge, `sent_at` = cleaning date) linked via `invoice_jobs`. No payment. |

**Job status:** past rows → `done` (`completed_at` = scheduled end); future rows → `scheduled`.
Assignments on past rows → `done`; on future rows → `accepted`.

## Expenses → `expenses`

327 rows, 2024-05-16 to 2026-10-13. 5 rows have no amount → skipped with a warning.

| Sheet column | Goes to | Notes |
|---|---|---|
| Subscription | `expenses.name` | |
| Payment Date | `expenses.paid_at` | |
| Amount | `expenses.amount_cents` | |
| Paid With | `expenses.paid_with` | |
| Platform | `expenses.platform` | |
| Recurring Cadence | `expenses.cadence` | monthly → `monthly`; yearly / Yearly → `annual`; one time / once / na / blank → `one_time`; "two years", "on-usage" → `one_time` with the text in notes. |
| Notes | `expenses.notes` | |

**Category** (owner can change in the preview):

| Match on name or platform | Category |
|---|---|
| Ad Expenditure, Google LSA, Prospix | `ads` |
| Thimble, insurance | `insurance` |
| BookingKoala, Google Drive, Slack, GoDaddy, SquareSpace, OpenPhone, Vercel, Replicate, ChatGPT, Cohesive, Miro, Fiverr, Canva, Davinci | `software` |
| Cleaning Supplies, Cleaning Equipment, Equipment, AutoZone | `supplies` |
| everything else (Gas, Food and Entertainment, Parking, Visible, car repair...) | `overhead` |

## Monthly Profits

Not imported. The old tab is **by cleaning date**, and its "Received Payments" column is the
charged amount of every job dated in the month whether or not the client paid. After import,
open P&L in "by job date" mode (`v_monthly_pnl_by_job`) and compare each month to the old tab.
Expected differences: the fee estimates above, the 5 skipped expenses, and any alias you
changed in the preview.

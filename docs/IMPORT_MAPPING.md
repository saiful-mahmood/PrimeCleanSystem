# Importing the old Google Sheet

Export each tab as CSV (File → Download → Comma Separated Values) and drop them into
`data/imports/`. The headers must match the templates there exactly. Blank cells are fine.

## Client Details → `clients` + `locations`

| Sheet column | Goes to | Notes |
|---|---|---|
| Client Name | `clients.name` | Must be unique; duplicates are flagged in the preview. |
| Lockbox Codes | `locations.lockbox_code_enc` | Encrypted on import. The plain text is never stored. |
| Type of Client | `clients.type` | "residential" / "commercial" (case-insensitive; "res", "comm" accepted). |
| Location | `locations.address_line1` (+ city/state/zip if parseable) | One location labelled "Main". |
| Basic Info | `clients.basic_info` | |
| Scope of Work | `locations.scope_of_work` | |

## Revenues → `jobs` + `job_assignments` + `payments` + `payouts`

| Sheet column | Goes to | Notes |
|---|---|---|
| Client Name | `jobs.client_id` via lookup | Unknown name → warning; you can create the client in the preview. |
| Cleaning Type | `jobs.service_type_id` via lookup | Unknown → warning with a dropdown to map. |
| Cleaning Date and time | `jobs.scheduled_start` | Parsed in America/New_York. Date only → 09:00. |
| Charged Amount | `jobs.charge_cents` | "$1,250.00" → 125000. |
| PMT Received | `payments.amount_cents` | Row created only if > 0. |
| Stripe 2.9% fee | `payments.fee_cents` | Kept as entered for history; new payments use the real fee from Stripe. |
| Charge Method | `jobs.charge_method` and `payments.method` | stripe / card → stripe_card; ach → stripe_ach; invoice → stripe_invoice; zelle; check; cash. |
| Provider | `job_assignments.provider_id` via lookup | Creates the provider if missing (flagged in preview). |
| Provider Payment | `job_assignments.pay_cents` | |
| Paid | `payouts` | yes/true/✓ → a one-assignment payout with `paid_at` = cleaning date, `reference` = "imported". |
| Payment Method | `payouts.method` | zelle (default) / cash / check. |
| Profit, Profit Margin | not imported | Recomputed by `v_job_economics`; shown side by side in the preview so you can spot rows that disagree. |
| Notes | `jobs.notes` | |

Status: rows dated in the past become `done`; future rows become `scheduled`.

## Expenses → `expenses`

| Sheet column | Goes to | Notes |
|---|---|---|
| Subscription | `expenses.name` | |
| Payment Date | `expenses.paid_at` | |
| Amount | `expenses.amount_cents` | |
| Paid With | `expenses.paid_with` | |
| Platform | `expenses.platform` | |
| Recurring Cadence | `expenses.cadence` | monthly / annual / weekly / quarterly / one-time. |
| Notes | `expenses.notes` | |

Category defaults to `software` when Platform looks like a SaaS name and `ads` when the name
contains "ads", "Google Ads", "Yelp", "Thumbtack", "Angi"; otherwise `overhead`. You can change it
in the preview.

## Monthly Profits

Not imported. After import, open P&L and compare each month to the old tab. Differences come from
fee rounding or rows that were in the sheet but had no client; the preview lists those.

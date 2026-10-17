# Decisions log

Answers from the owner that resolve ambiguities in `SPEC.md`. When this file and SPEC.md
disagree, this file wins. Dates are when the decision was made.

## Session 0 — 2026-10-17

### Business
- Business name: **Prime Clean Care**. Seed `settings.business_name` with it.
- One owner email only (`OWNER_EMAIL`). No second login.
- The business also sells non-cleaning work (lawn mowing, snow plowing, carpet cleaning, event
  support, small construction via subcontractors). `service_types` must cover those; it is a
  table, not an enum, so this is seed data, not a schema change.

### Scheduling
- **Job done = all cleaners done.** A multi-assignment job becomes `done` only when every
  non-declined assignment is `done`.
- **Reschedule a one-off job: update `scheduled_start` in place** and write an `audit_log` row
  (`job.reschedule` with old and new start). No cancel-and-recreate.
- **"Edit this and future" on a series**: set `end_date` on the current series to the day before
  the edited instance, create a new `job_series` starting on that date, regenerate. Two series
  rows, clean history.
- **Skip a series instance**: job → `skipped`; its `offered`/`accepted` assignments → `declined`.
- Job duration: series `duration_min`, falling back to the service type's
  `default_duration_min`.
- `BUSINESS_TZ` is treated as a constant (`America/New_York`). The unique index in
  `0001_init.sql` hardcodes it; do not generalize.

### Money
- **Cancellations: cleaners are usually not paid.** Owner may choose to pay a fee. Cancelling a
  job asks "Pay cleaner a cancellation fee?" (default $0). A non-zero fee sets the assignment's
  `pay_cents` to the fee and its status to `cancelled_paid` (new enum value, migration `0002`),
  so it shows in "owed" and flows through the normal payout ledger.
- **The old Monthly Profits tab is by cleaning date, not cash basis**, and its "Received
  Payments" column is the *charged* amount of every job in that month regardless of whether the
  client has paid (verified: Nov 2026 shows $775 = three future, unpaid jobs). Add
  `v_monthly_pnl_by_job` in `0002`: charge, estimated fee and provider pay grouped by the job's
  local date; expenses by `paid_at`. The P&L screen shows both views; **"by job date" is the
  default** because that is what the owner is used to. The Phase 1 acceptance check compares
  `v_monthly_pnl_by_job` to the old tab.
- `v_ar_aging` keeps done-but-uninvoiced jobs as receivable from the cleaning date, including
  monthly-billed commercial clients.
- `expenses.paid_at` stays a `date`.

### Import (the real workbook is "Prime Clean Care CRM.xlsx"; findings in IMPORT_MAPPING.md)
- A client that appears with two different addresses is **two clients**.
- **Client aliases**: the Revenues tab encodes service or period in the client name
  ("Sharon ICNE - Event Cleaning", "Malik Academy - week of 10_26"). The importer collapses
  these to one client via an alias table the owner reviews in the preview; the suffix becomes
  the job's notes (and drives the service type where it names one). **Sharon ICNE and Sharon
  School are different clients.** "Sharon Lockbox Code" in Client Details is Sharon ICNE.
- Provider names match **exactly**; no fuzzy matching. One known typo is merged on import:
  **Caludia → Claudia**. Companies (GCI Construction, Radiant Cleaning, Statewide Cleaning,
  McCann family carpet, Christian's Carpet, Cohesive, Nus) are imported as providers like
  everyone else.
- `PMT Received` is **Yes / No / In Progress**, not an amount. `Yes` → a `payments` row for the
  full charge on the cleaning date. `No` → no payment; the job shows in AR. **`In Progress` =
  invoice sent, waiting on the client** → an `invoices` row with status `sent`, `sent_at` =
  cleaning date, linked through `invoice_jobs`; no payment.
- `Charge Method` includes **Venmo** (10 rows): add `venmo` to `charge_method` in migration
  `0002`. `Check` → `check`, `ACH` → `stripe_ach`, `Stripe` → `stripe_card`.
- `Payment Method` (to cleaner) is Business Zelle / Personal Zelle. Both import as `zelle`;
  the original label goes in `payouts.notes`.
- `Stripe 2.9% fee` is kept as entered. Where Charge Method is Stripe or ACH and the fee is 0,
  the importer estimates **2.9% + 30¢** (card) or **0.8% capped at $5** (ACH) and flags the
  row in the preview.
- Client type: every Client Details row is `commercial`, with the sheet's "Type of Client"
  (Coffee Shop, Church, Mosque...) kept in `clients.basic_info`. Revenues-only clients with a
  person's name are `residential`; business-looking names are `commercial`. The preview lets
  the owner flip any of them.
- Service types seed (replaces the five in `0001`): Regular Cleaning, Deep Cleaning, Home
  Cleaning, Move-Out Cleaning, Event Cleaning, Event Support, Carpet Cleaning, Steam Cleaning,
  Post-Construction Cleaning, Lawn Mowing, Spring Cleanup, Snow Plowing, Landscaping /
  Construction (Patio, Fence, Tree Removal, Pruning, Weed Treatment). Matching trims whitespace
  and ignores case.
- Expense category mapping: Ad Expenditure, Google LSA, Prospix → `ads`; Thimble → `insurance`;
  BookingKoala, Google Drive, Slack, GoDaddy, SquareSpace, OpenPhone, Vercel, Replicate, ChatGPT
  API, Cohesive, Miro, Fiverr, Canva → `software`; cleaning supplies/equipment → `supplies`;
  everything else → `overhead`. Cadence: "na", "once", blank → `one_time`; "yearly" → `annual`;
  "two years", "on-usage" → `one_time` with the original text in notes.
- Rate card numbers: ask the owner for real figures right before the Session 3 import; the
  seeded values are placeholders.
- Real sheet exports are **not** committed. The import wizard takes file uploads from the
  browser; `data/imports/*.csv` stay header-only templates.

### Infrastructure
- No Docker on the owner's machine. Development targets the hosted Supabase project directly;
  there is no local Supabase and no `pnpm db:reset`. Migrations are applied with
  `supabase db push` against the hosted project (or pasted into the SQL editor).
- Repo: `github.com/saiful-mahmood/PrimeCleanSystem` (private).

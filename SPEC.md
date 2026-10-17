# CleanOps — product and technical spec

Version 1.0 · Single owner, single tenant · Replaces a 4-tab Google Sheet

## 1. The business in one paragraph

The owner sells cleaning services by phone (residential) or after a walkthrough (commercial),
schedules the job, and finds an independent cleaner to do it. Clients pay by Stripe (card, ACH, or
invoice) or Zelle (Chase). Cleaners are paid by Zelle. The owner's margin is the charged amount
minus Stripe fees minus what the cleaner is paid. The owner avoids walkthroughs unless necessary,
sends cleaners their weekly schedule, and wants cleaners to confirm when a job is done. The owner
writes commercial proposals from a template using Claude, with walkthrough notes from Granola as
input, and often regenerates a proposal several times before it is right.

## 2. What hurts today (the problems this must solve)

- Jobs are rows copied month to month; recurring jobs get mislabeled or lost.
- Nobody can tell at a glance who has been paid, who did which clean, or who still owes.
- Cleaners are sometimes paid twice, or not at all.
- Proposals live in chat history; there is no way to find the version that was sent.
- Stripe fees are estimated at 2.9% instead of recorded.
- Monthly P&L is assembled by hand.
- Lockbox codes live in a spreadsheet.

## 3. Users

- **Owner** (one person). Logs in with email magic link (Supabase Auth). Full access. Uses laptop
  and phone.
- **Provider / cleaner** (a handful). Never logs in. Receives SMS with a magic link to a mobile
  page for the job or the week. Can accept/decline, see the address and (on the day) the lockbox
  code, follow a checklist, mark done, upload before/after photos, add a note.
- **Client**. No login. Receives confirmations, reminders, payment links, review requests.
- **Claude (the owner's assistant)**. Connected through the MCP server. Can read everything and
  perform the write actions listed in §9, each of which is logged to `audit_log` with actor
  `claude-mcp`.

## 4. Data model

The schema is already written in `supabase/migrations/0001_init.sql` and tested. Summary:

| Table | Purpose |
|---|---|
| `clients` | One per customer. Type residential/commercial, default charge method, Stripe customer id, the old "Basic Info". |
| `locations` | One or more per client. Address, sqft/bed/bath, scope of work, access notes, **encrypted** lockbox code. |
| `providers` | Cleaners. Zelle handle, default pay, W-9 on file, active. |
| `service_types` | Standard, Deep, Move-in/out, Commercial, Post-construction. |
| `rate_cards` | Base + per-bedroom + per-bathroom + per-sqft + minimum, per service type and client type. Drives instant quotes. |
| `leads` | Pipeline: new → contacted → quoted → won/lost, with intake answers and lost reason. |
| `proposals` / `proposal_versions` | One proposal per lead/client; every generation or edit is a new version with structured `fields` and `rendered_md`. |
| `job_series` | Recurring template: RRULE, start/end date, time, duration, charge, provider pay, default provider. |
| `jobs` | Every scheduled visit (one-off or generated from a series). Status, charge, charge method, completion data, photos. Unique per series per local day. |
| `job_assignments` | Which provider does a job and for how much. `payout_id` is set when paid. |
| `payouts` | A batch of assignments paid to one provider at once (one Zelle). Total maintained by trigger; frozen once `paid_at` is set. |
| `invoices` / `invoice_jobs` | Stripe invoices or payment links; an invoice can cover many jobs (monthly commercial billing). |
| `payments` | Money actually received, with the **real** fee from Stripe's balance transaction, or Zelle/check reference. |
| `expenses` | The old Expenses tab, with category and cadence. |
| `messages` | Every SMS/email sent, with template and status; unique per (job, template, recipient). |
| `magic_links` | Tokens for cleaner pages. |
| `audit_log` | Lockbox reveals, payouts, cancellations, MCP writes. |
| `settings` | Business timezone, send times, nudge thresholds. |

Views: `v_job_economics` (per-job margin), `v_monthly_pnl` (the old Monthly Profits tab, cash
basis), `v_provider_owed` (what you owe each cleaner now), `v_ar_aging` (who owes you),
`v_provider_ytd` (1099 totals).

Row-level security: only the owner's authenticated session can read or write through the
Supabase client. Cleaner pages, cron, webhooks, and MCP run server-side with the service role.

## 5. Screens (owner)

All screens are responsive; the phone layout is a first-class target.

1. **Today / Dashboard** — jobs today and tomorrow with provider and status; unassigned jobs in
   the next 7 days; owed to cleaners (total + per provider); unpaid from clients (AR total,
   oldest); this month's profit vs last month; alerts (job done but unpaid > N days, provider
   hasn't accepted, series ending soon).
2. **Calendar** — week and month views. Click a slot to create a job; drag to reschedule; click a
   job for a side panel (client, location, provider, charge, pay, status, payment status, notes).
   For jobs in a series: "edit this one", "edit this and future", "skip this one", "end series".
   Filters: provider, status, client type. Color by status.
3. **Jobs list** — table with filters, bulk actions (assign provider, mark done, create payment
   link), CSV export. Columns mirror the old Revenues tab plus the computed margin.
4. **Job detail** — everything about one visit, with the payment timeline, assignment and payout
   status, photos, messages sent, and a "Charge" button (Stripe link / invoice / mark Zelle
   received).
5. **Clients** — list and detail. Detail shows locations (with "Reveal lockbox" that logs an
   audit row), series, upcoming and past jobs, proposals, invoices and payments, lifetime margin.
6. **Providers** — list and detail: contact, Zelle handle, pay default, W-9, jobs done, no-shows,
   YTD paid (1099 view), owed now.
7. **Pay cleaners** — the double-pay killer. Per provider: list of done-but-unpaid assignments
   with job date, client, pay. Select → "Create payout" → shows total and Zelle handle → you send
   the Zelle → paste the confirmation number → "Mark paid". Paid batches are read-only.
8. **Payments / AR** — unpaid invoices and unpaid done jobs by age; "send reminder"; "record Zelle
   received"; Stripe payouts pending (from the Stripe balance API).
9. **Expenses** — the old Expenses tab with recurring entries that auto-create next month's row.
10. **Leads** — kanban (new / contacted / quoted / won / lost) with intake form link, instant
    quote from the rate card, and "Create proposal".
11. **Proposals** — list; editor with structured fields on the left (scope lines, frequency,
    price per visit, add-ons, terms, start date) and the rendered document on the right;
    "Generate from notes" (paste Granola notes or pull via Granola MCP in the Claude app);
    "Regenerate section"; version history with diff; "Send" (emails a PDF/link and marks
    `sent`); "Accept" creates the client, location, and series in one step.
12. **P&L** — `v_monthly_pnl` as a table and simple chart, with YTD, exportable as CSV and synced
    nightly to the Google Sheet (Phase 4).
13. **Settings** — business name, timezone, send times, rate card editor, proposal template,
    SMS templates, integrations status (Stripe/Twilio/Anthropic keys present, webhook health).

## 6. Screens (cleaner, mobile, no login)

- `/p/[token]` — **This job**: date/time, client first name, address with map link, service
  type, scope checklist, access notes, "Reveal lockbox code" (only within 12 hours before the
  start until 6 hours after; logs to `audit_log`), Accept / Decline, Start, "Mark done" with
  before/after photo upload and a note. Done sets `job_assignments.status = done`,
  `jobs.status = done`, `completed_at`.
- `/p/[token]/week` — **My week**: the provider's jobs for the next 7 days with accept/decline
  per job.
- Tokens expire 7 days after the job; the week token rotates weekly. Reply "DONE" by SMS also
  marks the provider's job for today as done (Twilio inbound webhook).

## 7. Automations (cron; all idempotent)

| When | What |
|---|---|
| Nightly 02:00 | Generate job instances from active series for the next 8 weeks. Auto-assign the series' default provider as `offered`. |
| Sunday 18:00 | Send each provider their week (one SMS with the week link). |
| Daily 17:00 | Send day-before reminders to clients (and providers who haven't accepted). |
| Hourly | Jobs whose end time passed and are still `scheduled`/`in_progress` → nudge the provider "Mark done?" once. |
| Daily 09:00 | Owner digest: done-but-unpaid jobs older than N days; providers owed more than N days; unassigned jobs in the next 3 days; series ending within 30 days. |
| Daily 10:00 | Review request to clients 24h after a one-time job is done and paid (Google review link). |
| Monthly 1st | Create next month's recurring expenses. |
| Nightly 03:00 (Phase 4) | Push `v_monthly_pnl`, jobs, and expenses to the Google Sheet. |

## 8. Integrations

### Stripe
- Residential: Checkout Session (or Payment Link) per job; link is stored on the job and sent by
  SMS/email. No extra Stripe fee beyond 2.9% + 30¢.
- Commercial: Stripe Invoice with ACH Direct Debit enabled (0.8% capped at $5) plus card; can
  cover many jobs via `invoice_jobs`. Invoicing fee 0.4% per paid invoice.
- Webhooks: `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`,
  `charge.refunded`, `invoice.voided`. On success: insert a `payments` row with the actual fee
  from the balance transaction, link to the job/invoice, mark invoice paid. Idempotent on
  `stripe_payment_intent_id`.
- Test mode until the owner says otherwise.

### Zelle (no API)
- Zelle has no API for small-business accounts. The app models it: "Zelle requested" is a message
  with the amount and the owner's Zelle handle; "Record Zelle received" creates a `payments` row
  with `external_ref` = Chase confirmation number. Same for payouts to cleaners. Optional later:
  Chase CSV import to reconcile.

### Twilio
- Outbound SMS for the templates in §7; inbound webhook for "DONE" / "YES" / "NO" replies.
- A2P 10DLC registration must be done once in the Twilio console (sole proprietor campaign).
  Until approved, use email (Resend) for the same templates.

### Anthropic API (proposals)
- `templates/proposal.md` is the owner's template with `{{placeholders}}`.
- "Generate" sends: template, structured fields so far, the notes, and the previous version (if
  regenerating) to Claude, asking for JSON `fields` + `rendered_md`. Store as a new version.
- "Regenerate section" sends only that section with instructions; the rest is kept verbatim.
- Model: Claude Sonnet (configurable). Expect a few cents per generation.

### MCP server (`/mcp`)
- Streamable HTTP, authenticated with OAuth (Supabase Auth as the identity; use the
  `@modelcontextprotocol/sdk` server with an OAuth provider layer) so the owner can add it as a
  custom connector in the Claude app (Customize → Connectors → Add custom connector).
- Tools in §9. Every write tool logs to `audit_log` with actor `claude-mcp`.

### Granola
- Nothing to build. The owner either pastes notes into the proposal editor, or (on a Granola plan
  with API/MCP access) connects Granola's MCP server in the Claude app and asks Claude to pull the
  notes and call `generate_proposal`.

## 9. MCP tools

Read: `get_today`, `list_jobs(from, to, status?, provider_id?)`, `get_job(id)`,
`list_clients(query?)`, `get_client(id)`, `list_providers(active?)`, `provider_balances()`,
`ar_aging()`, `pnl(month?)`, `list_proposals(status?)`, `get_proposal(id, version?)`,
`list_leads(status?)`, `instant_quote(service_type, client_type, bedrooms?, bathrooms?, sqft?)`.

Write (each returns what it changed; each logs to `audit_log`): `upsert_client`, `upsert_location`
(lockbox write-only, never returned), `create_lead`, `update_lead_status`, `create_job`,
`create_series`, `reschedule_job`, `skip_job`, `cancel_job`, `assign_provider`, `mark_job_done`,
`create_payment_link`, `create_invoice`, `record_zelle_payment`, `create_payout_draft`,
`mark_payout_paid(reference)`, `generate_proposal(lead_or_client_id, notes, overrides?)`,
`update_proposal_fields(id, patch)`, `send_proposal(id)`, `add_expense`, `send_message(template,
job_id)`.

Destructive or money-moving tools (`cancel_job`, `mark_payout_paid`, `create_invoice`,
`send_*`) must describe the action in their result and rely on the Claude app's tool approval.

## 10. Import from the Google Sheet

CSV templates in `data/imports/` match the old tab headers exactly. Mapping in
`docs/IMPORT_MAPPING.md`. The import wizard (Settings → Import) uploads the four CSVs, shows a
preview with warnings (unknown client, unparseable date, provider name not found, amount with
`$`), lets you fix mappings, and then writes: clients + locations from Client Details; providers
from the distinct Provider column; jobs + assignments + payments + payouts from Revenues
(a row with `Paid = yes` creates a one-assignment payout marked paid on the cleaning date, so
history is consistent with the ledger); expenses from Expenses. Monthly Profits is not imported;
it is recomputed and compared against the old tab as a sanity check.

## 11. Security

- Owner auth: Supabase email magic link; one allowed email set in `OWNER_EMAIL`.
- RLS on every table; service role only on the server.
- Lockbox encryption key in env; rotate by re-encrypting (write a script in Phase 1).
- Cleaner tokens: 32 random bytes, base64url, single purpose, expiring.
- Webhook signature verification; rate limiting on `/p/*` and `/api/*`.
- No PII in logs. Photos in a private Storage bucket with signed URLs.

## 12. Phases and acceptance checks

### Phase 1 — Off the spreadsheet
Scope: project scaffold, Supabase project, migration applied, owner login, Clients, Providers,
Calendar with one-off and recurring jobs, instance generation, Jobs list, Job detail, Pay cleaners,
Expenses, Dashboard (basic), Import wizard, CSV export of jobs and P&L.
Accept when: the owner's real sheet imports with zero unexplained rows; a biweekly series
created today shows the right instances through 8 weeks and "skip this one" works; creating a
payout for two assignments and marking it paid makes them disappear from "owed"; attempting to
pay the same assignment again is impossible in the UI and rejected by the DB; `v_monthly_pnl`
for last month matches the old Monthly Profits tab within rounding.

### Phase 2 — Money and messages
Scope: Stripe (checkout, invoices with ACH, webhooks, real fee capture), Zelle request/receive
flow, Payments/AR screen, Twilio (or Resend fallback) with weekly schedule, day-before
reminders, done-nudge, owner digest; cleaner pages with accept/decline, lockbox reveal window,
mark done with photos; inbound "DONE".
Accept when: a test-mode card payment and an ACH invoice both create `payments` rows with the real
fee; re-delivering the webhook does not duplicate; a cleaner can go from SMS → page → done → photo
without logging in; the weekly schedule SMS is sent exactly once per provider.

### Phase 3 — Proposals and Claude
Scope: Leads kanban, intake form (public link), rate card and instant quote, proposal editor with
generation, section regeneration, versions and diff, send and accept flow, MCP server with OAuth
and the tools in §9.
Accept when: pasting walkthrough notes produces a proposal matching the template; changing the
price per visit creates a new version without touching other text; the owner can add the MCP
server as a custom connector in the Claude app and ask "who do I owe this week" and "schedule
the Hendersons biweekly Tuesdays at 9 starting the 28th with Maria at $120" and both work.

### Phase 4 — Polish and growth
Scope: P&L chart, review requests, Google Sheet nightly sync, recurring expense generation,
provider reliability stats, Chase CSV reconciliation (optional), PWA install prompts.
Accept when: the owner has not opened the old sheet for two weeks.

## 13. Out of scope (for now)

Multi-user staff accounts, payroll/W-2, route optimization, customer self-booking portal,
QuickBooks sync, native mobile apps, multi-tenant SaaS.

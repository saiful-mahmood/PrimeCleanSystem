# CleanOps — project instructions for Claude Code

Read `SPEC.md` before doing anything. It is the source of truth for what we are building.
`docs/DECISIONS.md` records the owner's answers to ambiguities in the spec and wins over SPEC.md
where they differ. `docs/PROMPTS.md` has the session-by-session plan; work in that order and do
not start a later phase until the current phase's acceptance checks in SPEC.md pass.

## What this is

A small operations app for a cleaning-services arbitrage business run by one owner who closes
clients by phone, schedules jobs, and subcontracts the cleaning to independent cleaners
("providers"). It replaces a Google Sheet with four tabs (Expenses, Revenues, Monthly Profits,
Client Details). The owner uses it on a laptop and a phone. Cleaners never log in; they get
magic links by SMS.

## Stack (do not substitute without asking)

- Next.js (App Router, TypeScript, Tailwind, shadcn/ui), deployed on Vercel
- Supabase: Postgres, Auth (owner only), Storage (job photos), pg_cron where useful
- Stripe: Payment Links / Checkout for residential, Invoices with ACH for commercial, webhooks
- Twilio: SMS to cleaners and clients (email via Resend as fallback)
- Anthropic API (`@anthropic-ai/sdk`) for proposal generation
- An MCP server (`/mcp` route, Streamable HTTP) so the owner's Claude app can drive the system
- Tests: Vitest for unit tests, Playwright for the handful of end-to-end flows in SPEC.md
- Package manager: pnpm

## Non-negotiable rules

1. Money is integer cents everywhere (DB, API, UI state). Format to dollars only at render time.
2. All times are stored as `timestamptz`. The business runs in `America/New_York`; use the
   `BUSINESS_TZ` setting for every "today", "this week", and day-boundary calculation.
3. Never overwrite history. Proposals get a new `proposal_versions` row on every change.
   Jobs are cancelled or skipped, not deleted. Payments and payouts are never deleted.
4. The payout ledger is the anti-double-pay mechanism. A `job_assignment` is paid exactly once,
   by being attached to one `payout`. Do not add any other "paid" flag for providers.
5. Lockbox codes are encrypted at rest (AES-256-GCM, key in `LOCKBOX_ENC_KEY`). They are never
   logged, never returned by list endpoints, never put in an SMS, and every reveal writes an
   `audit_log` row. Cleaners see the code only on their job page, only on the day of the job.
6. The Supabase service-role key is used only in server code (route handlers, server actions,
   cron, webhooks, MCP). Never ship it to the browser.
7. Every Stripe and Twilio webhook verifies its signature and is idempotent (re-delivery must
   not create a second payment or message).
8. Scheduled sends are idempotent: check `messages` for an existing (job_id, template, to)
   row before sending.
9. Recurrence uses RFC 5545 RRULE strings via the `rrule` package. Instances are generated
   into `jobs` 8 weeks ahead by a nightly cron; the unique index on
   `(series_id, local date)` makes regeneration safe.
10. Write tests for all money logic (margins, fees, payout totals, P&L) before UI polish.

## Working style

- Before each phase, print a short plan and wait for my OK.
- Make small commits with clear messages. Run `pnpm typecheck && pnpm test` before committing.
- When something in SPEC.md is ambiguous, ask one specific question rather than guessing.
- Ask before: adding a paid dependency or service, changing the schema in a way that drops a
  column, sending any real SMS/email, or touching Stripe live mode. Test mode is the default.
- Keep the UI plain and fast. Mobile layout matters for the owner's phone and the cleaner pages.
- Do not build an admin panel, multi-tenant support, roles beyond owner/provider, or a
  marketing site. Single-tenant, one owner.

## Commands

```
pnpm dev            # local dev server
pnpm typecheck
pnpm test           # vitest (pure unit tests)
pnpm test:db        # vitest against the hosted database (payout ledger guards); needs .env.local
pnpm test:e2e       # playwright
pnpm db:push        # supabase db push to the hosted project (migrations in supabase/migrations)
pnpm db:check       # query every table and view on the hosted project; run after each migration
pnpm db:rollback-import   # undo the last sheet import (ids from audit_log); --partial cleans a failed one
```

There is no local Supabase (the owner has no Docker). Development and tests run against the
hosted Supabase project; seed scripts must be idempotent.

## Layout

```
app/                 Next.js routes (owner UI under app/(owner), cleaner pages under app/p/[token])
app/api/webhooks/    stripe, twilio
app/api/cron/        nightly generate-instances, reminders, nudges, export
app/mcp/             MCP server route
lib/                 db client, money, tz, rrule helpers, crypto (lockbox), stripe, twilio, claude
supabase/migrations/ SQL migrations (0001_init.sql is already written; do not rewrite it)
data/imports/        CSV templates matching the old Google Sheet tabs
templates/           proposal template(s)
docs/                PROMPTS.md, IMPORT_MAPPING.md, DECISIONS.md
```

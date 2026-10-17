# Session prompts for Claude Code

Paste these one at a time, in order. Each one is a session. Finish a session (tests pass,
changes committed) before starting the next. If a session runs long, say "commit what works and
summarize what is left" and pick up with `claude -c` later.

Before every session, Claude Code will read `CLAUDE.md` automatically. The first prompt makes it
read `SPEC.md` too.

---

## Session 0 — Orientation and scaffold (about 1 hour)

```
Read CLAUDE.md and SPEC.md fully. Then:
1. Tell me, in 10 lines or fewer, what we are building and the Phase 1 scope as you understand it.
2. List anything in SPEC.md that is ambiguous or that you would do differently, as questions. Do not resolve them yourself.
Wait for my answers before writing any code.
```

After you answer its questions:

```
Scaffold the project per CLAUDE.md: Next.js App Router with TypeScript, Tailwind, shadcn/ui, pnpm, Vitest, Playwright, Supabase client (server and browser helpers), and the folder layout in CLAUDE.md. Add the package.json scripts listed in CLAUDE.md. Copy .env.example to .env.local and tell me exactly which values I need to fill in and where to get each one. Set up Supabase locally (supabase init, supabase start) and apply supabase/migrations/0001_init.sql with supabase db reset. Do NOT rewrite 0001_init.sql. Confirm the migration applies cleanly and show me the tables. Commit.
```

## Session 1 — Owner login, clients, providers (2–3 hours)

```
Phase 1, part 1. Implement owner authentication with Supabase email magic link restricted to OWNER_EMAIL, and a profiles row with role owner created on first login. Then build the Clients screen (list, create, edit, detail with locations) and the Providers screen (list, create, edit, detail) per SPEC.md §5. Locations must store the lockbox code encrypted with AES-256-GCM using LOCKBOX_ENC_KEY (write lib/crypto.ts with tests), with a "Reveal" button that decrypts server-side and writes an audit_log row. Lockbox codes must never appear in list queries or logs. Keep the UI plain with shadcn components; make sure it works at 390px wide. Write Vitest tests for lib/crypto.ts and lib/money.ts (cents formatting and parsing). Run typecheck and tests, then commit.
```

## Session 2 — Calendar, series, instances (3–4 hours; the hardest session)

```
Phase 1, part 2. Implement scheduling per SPEC.md:
- lib/rrule.ts: helpers around the rrule package to expand a job_series into local-date instances in BUSINESS_TZ. Test DST transitions (a 9:00 series must stay at 9:00 local across the March and November changes) and biweekly/monthly rules.
- A generate-instances function (callable from a cron route at app/api/cron/generate-instances and from the series editor) that creates jobs 8 weeks ahead, relying on the unique index to be idempotent, and auto-creates an offered job_assignment for the default provider.
- Calendar screen with week and month views, create job from a slot, drag to reschedule, side panel with job details, and for series jobs: edit this one / this and future / skip this one / end series.
- Jobs list with filters and the columns from the old Revenues tab plus margin (use v_job_economics).
- Job detail page.
Write tests for the rrule helpers and the generator (including "regenerating does not duplicate"). Then commit.
```

## Session 3 — Pay cleaners, expenses, dashboard, import (2–3 hours)

```
Phase 1, part 3.
- Pay cleaners screen per SPEC.md §5 item 7, using v_provider_owed. Creating a payout attaches selected assignments; marking it paid sets paid_at and the Zelle reference. Show that the DB triggers reject double-pay by writing a test that tries to re-attach a paid assignment and expects an error.
- Expenses screen mirroring the old Expenses tab with category and cadence.
- Dashboard per SPEC.md §5 item 1 (basic version).
- Import wizard under Settings → Import that accepts the four CSVs in data/imports and follows docs/IMPORT_MAPPING.md, with a preview-and-warnings step before writing. Rows in Revenues with Paid = yes must create a paid payout so history is consistent with the ledger.
- CSV export for jobs and for v_monthly_pnl.
Then run through the Phase 1 acceptance checks in SPEC.md §12 with me and list what passes and what does not. Commit.
```

Stop here and use the app for real for a few days before Phase 2.

## Session 4 — Stripe (2–3 hours)

```
Phase 2, part 1: Stripe in test mode. Implement lib/stripe.ts, "Create payment link" on a job (Checkout Session, stored on the job and shown as a copyable link), "Create invoice" for commercial clients with ACH and card enabled covering one or more jobs (invoice_jobs), and the webhook route at app/api/webhooks/stripe handling checkout.session.completed, payment_intent.succeeded, invoice.paid, charge.refunded, invoice.voided. On success insert a payments row with the real fee from the balance transaction. Make the webhook idempotent on stripe_payment_intent_id and verify signatures. Add the Zelle flow: "Request Zelle" (creates a message with amount and the owner's Zelle handle from settings) and "Record Zelle received" (payments row with external_ref). Build the Payments / AR screen from v_ar_aging. Use the Stripe CLI to replay events in tests. Commit.
```

## Session 5 — Messaging and cleaner pages (3–4 hours)

```
Phase 2, part 2. Implement lib/messaging.ts with a Twilio SMS sender and a Resend email fallback selected by env (MESSAGING_PROVIDER=twilio|email), template rendering for: weekly_schedule, day_before_client, day_before_provider, job_done_nudge, zelle_request, payment_link, owner_digest, review_request. Every send checks the messages table first so a (job, template, recipient) is never sent twice. Build the cron routes in SPEC.md §7 (secured with CRON_SECRET) and the vercel.json cron config. Build the cleaner pages /p/[token] and /p/[token]/week per SPEC.md §6, including the lockbox reveal window, accept/decline, start, mark done with photo upload to a private Storage bucket, and the Twilio inbound webhook for DONE replies. Add rate limiting on /p/* and /api/*. Playwright test: create a job, assign a provider, open the magic link, mark done with a photo. Commit.
```

## Session 6 — Leads, rate card, proposals (3–4 hours)

```
Phase 3, part 1. Build the Leads kanban with a public intake form link (bedrooms, bathrooms, sqft, condition, add-ons, photos, preferred days) that creates a lead, and an instant quote from rate_cards (lib/quote.ts with tests). Build the Proposals screen per SPEC.md §5 item 11: structured fields on the left, rendered markdown on the right, "Generate from notes" using the Anthropic SDK with templates/proposal.md, "Regenerate section", version history with a diff view, Send (email with a link to a read-only proposal page and a PDF), and Accept which creates the client, location, and job_series in one step. Every change is a new proposal_versions row. Add a rate card editor and the proposal template editor under Settings. Commit.
```

## Session 7 — MCP server (2–3 hours)

```
Phase 3, part 2. Implement the MCP server at app/mcp using @modelcontextprotocol/sdk with Streamable HTTP transport, protected by OAuth so I can add it as a custom connector in the Claude app (use Supabase Auth as the identity provider behind a small OAuth authorization-server layer; dynamic client registration is fine). Implement every tool in SPEC.md §9 with zod schemas and clear descriptions. Write tools log to audit_log with actor claude-mcp. Lockbox codes are write-only through MCP. Give me step-by-step instructions to add it under Customize → Connectors in the Claude app, then we will test "who do I owe this week" and a scheduling request together. Commit.
```

## Session 8 — Polish (2–3 hours)

```
Phase 4. P&L screen with a simple monthly chart and YTD; review-request automation; recurring expense generation on the 1st; provider reliability stats on the provider detail page; nightly Google Sheets sync of v_monthly_pnl, jobs, and expenses via a service account (GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_JSON); PWA manifest and install prompt. Then do a security pass: confirm the service-role key is never in client bundles, RLS is on for every table, webhooks verify signatures, and no PII is logged. Commit.
```

---

## Useful mid-session phrases

- "Show me the plan first, don't write code yet."
- "That's too much at once. Do only the first bullet, run the tests, then stop."
- "Commit what works and summarize what's left."
- "Write a test that reproduces this bug before fixing it."
- "Explain this error to me like I'm not a developer, then fix it."
- `/clear` when switching to an unrelated task so the context stays focused.
- `Shift+Tab` to change how much Claude Code does without asking (plan mode is great before big sessions).

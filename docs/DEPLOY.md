# Deploying to Vercel

One-time setup, about 15 minutes. Afterwards every push to `main` deploys automatically.

## 1. Create the Vercel project

1. Go to **vercel.com**, sign in with GitHub, and pick the **Pro** plan ($20/mo) when asked: the
   Hobby plan does not allow commercial use.
2. **Add New → Project → Import** `saiful-mahmood/PrimeCleanSystem`.
3. Leave the detected settings: Framework **Next.js**, build `pnpm build`, install `pnpm install`.
   The repo pins the package manager in `package.json`.
4. Do **not** click Deploy yet; open **Environment Variables** first (step 2).

## 2. Environment variables

Easiest: open `.env.local` on your Mac, copy its contents, and paste the whole thing into the
**Environment Variables** box (Vercel splits it into rows). Then change two values:

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` (Vercel shows the name before the first deploy; you can rename it under Settings → General) |
| `CRON_SECRET` | any long random string; `openssl rand -hex 32` in Terminal. Vercel Cron sends it as the bearer token to `/api/cron/*`. |

Keep as they are: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, `LOCKBOX_ENC_KEY`, `BUSINESS_TZ`,
`SUPABASE_PHOTOS_BUCKET`, `MESSAGING_PROVIDER`, `PROPOSAL_MODEL`.

Leave blank for now (later sessions): Stripe, Twilio, Resend, Anthropic, Google Sheets.

`LOCKBOX_ENC_KEY` **must be the same value as on your Mac**, or the codes you imported cannot be
decrypted in production.

Click **Deploy**. The first build takes 2–3 minutes.

## 3. Tell Supabase about the production URL

Supabase → your project → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-project>.vercel.app`
- **Redirect URLs**: add `https://<your-project>.vercel.app/**` (keep `http://localhost:3000/**` for
  development).

Without this, the magic-link email points back at localhost.

## 4. Check

1. Open `https://<your-project>.vercel.app` on your phone. It should show the sign-in page.
2. Request a sign-in link, open the email **on the same phone**, and you should land on Today.
3. Vercel → project → **Settings → Cron Jobs** should list `/api/cron/generate-instances` at
   `0 7 * * *` (07:00 UTC, 2 or 3 am Eastern). You can run it by hand with **Run** there.
4. Vercel → **Logs** shows every request; errors appear in red.

## Later

- **Custom domain** (e.g. `app.primecleancare.com`): Vercel → Settings → Domains, then add that
  domain to the Supabase redirect list and change `NEXT_PUBLIC_APP_URL`.
- **Preview deployments**: every pull request gets its own URL. They share the production
  database, so treat them as production.
- The dev sign-in link script (`pnpm dev:login`) refuses to run against anything but localhost,
  on purpose.

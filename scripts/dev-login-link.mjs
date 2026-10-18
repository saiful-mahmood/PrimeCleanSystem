// Development only: mint a one-time owner sign-in link without sending an
// email, for when Supabase's built-in mailer is rate-limited (2/hour).
// Uses the service role, so it must never run anywhere but the owner's machine.
// Usage: node scripts/dev-login-link.mjs   → open the printed URL in your browser
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;
const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!url || !key || !email) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_EMAIL must be set in .env.local");
  process.exit(1);
}
if (!app.startsWith("http://localhost")) {
  console.error("Refusing: NEXT_PUBLIC_APP_URL is not localhost. This script is for local development only.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("Could not generate link:", error.message);
  process.exit(1);
}

const link = `${app}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink`;
console.log("\nOpen this in your browser (valid once, expires in about an hour):\n");
console.log(link, "\n");

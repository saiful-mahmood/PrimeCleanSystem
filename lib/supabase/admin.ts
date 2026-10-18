import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. Bypasses RLS. Only for server code that acts on behalf
 * of the system: cleaner magic-link pages, cron, webhooks, MCP, and the
 * owner's own profile bootstrap. The "server-only" import makes any
 * client-bundle import a build error.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

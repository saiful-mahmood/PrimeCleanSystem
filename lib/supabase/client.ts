"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Supabase client for client components (anon key, RLS applies). */
export function createClient() {
  const { url, anonKey } = publicEnv();
  return createBrowserClient<Database>(url, anonKey);
}

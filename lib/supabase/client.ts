"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Supabase client for client components (anon key, RLS applies). */
export function createClient() {
  const { url, anonKey } = publicEnv();
  return createBrowserClient(url, anonKey);
}

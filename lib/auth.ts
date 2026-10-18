import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

/** Case-insensitive check against the single allowed owner address. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = serverEnv().OWNER_EMAIL;
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner.trim().toLowerCase();
}

/** The logged-in owner, or null. Only trusts a user whose email is OWNER_EMAIL. */
export async function getOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) return null;
  return user;
}

/** For owner pages and actions: redirects to /login when not signed in as the owner. */
export async function requireOwner() {
  const user = await getOwner();
  if (!user) redirect("/login");
  return user;
}

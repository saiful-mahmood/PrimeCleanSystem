import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "@/lib/auth";

/**
 * Magic-link landing. Supabase redirects here with either a PKCE `code` or a
 * `token_hash` (depending on the email template). Exchange it for a session,
 * refuse anyone who is not the owner, and make sure the owner's `profiles`
 * row exists so `is_owner()` passes under RLS.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = { message: "missing code" };
  }
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwnerEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_owner`);
  }

  // First login: the profiles row cannot be written by the user themself
  // (RLS requires is_owner(), which needs the row), so use the service role.
  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { user_id: user.id, role: "owner", full_name: user.user_metadata?.full_name ?? null },
      { onConflict: "user_id" },
    );
  if (profileError) {
    console.error("profile bootstrap failed", profileError.message);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail, requestOrigin } from "@/lib/auth";

export type LoginState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const { email } = parsed.data;

  // Only the owner may log in. Any other address gets the same neutral reply,
  // so the form does not reveal which address is the owner's.
  if (!isOwnerEmail(email)) {
    return { status: "sent", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // The host the owner is actually using (vercel.app, a custom domain, or
      // localhost), so the emailed link comes back to the same place.
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "sent", email };
}

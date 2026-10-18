"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">Check your email.</p>
        <p className="text-muted-foreground">
          If <span className="font-mono">{state.email}</span> is the owner address, a sign-in link is on its way. It
          expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {error && state.status === "idle" && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}

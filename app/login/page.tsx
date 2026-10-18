import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwner } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_owner: "That account is not allowed to sign in here.",
  link_invalid: "That sign-in link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getOwner()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Prime Clean Care</CardTitle>
          <CardDescription>Owner sign-in. No password; we email you a link.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm error={message} />
        </CardContent>
      </Card>
    </main>
  );
}

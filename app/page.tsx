import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">Prime Clean Care</h1>
          </CardTitle>
          <CardDescription>Operations app. Owner login comes in Session 1.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Scaffold is up: Next.js, Tailwind, shadcn/ui, Supabase helpers, Vitest and Playwright.
        </CardContent>
      </Card>
    </main>
  );
}

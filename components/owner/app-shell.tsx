import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <MobileNav email={email} />
          <Link href="/" className="font-semibold tracking-tight">
            Prime Clean Care
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="max-w-48 truncate text-xs text-muted-foreground">{email}</span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

import { cookies } from "next/headers";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";
import { Sidebar, SIDEBAR_COOKIE } from "./sidebar";

export async function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "1";
  return (
    <div className="flex min-h-full">
      <Sidebar email={email} defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
          <MobileNav email={email} />
          <Link href="/" className="whitespace-nowrap font-semibold tracking-tight">
            Prime Clean Care
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

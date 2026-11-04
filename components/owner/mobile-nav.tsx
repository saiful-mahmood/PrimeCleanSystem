"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground">
        <SheetHeader>
          <SheetTitle className="text-sidebar-foreground">Prime Clean Care</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 py-3 text-base text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
                onNavigate={() => setOpen(false)}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-sidebar-border p-4">
          <p className="truncate text-xs text-sidebar-foreground/60">{email}</p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm" className="w-full border-sidebar-border bg-transparent">
              Sign out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

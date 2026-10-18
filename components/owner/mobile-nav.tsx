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
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Prime Clean Care</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} className="py-3 text-base" onNavigate={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t p-4">
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

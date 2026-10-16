"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Plus,
  ReceiptText,
  CupSoda,
  Wallet,
  BarChart3,
  CalendarCheck,
  Settings,
  GlassWater,
  LogOut,
  Menu as MenuIcon,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/menu", label: "Menu Management", icon: CupSoda },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/closing", label: "Daily Closing", icon: CalendarCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2.5 px-2 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <GlassWater className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{businessName}</div>
          <div className="text-xs text-muted-foreground">Business Console</div>
        </div>
      </div>

      <Link href="/pos" onClick={() => setOpen(false)}>
        <Button variant="accent" className="w-full justify-start" size="lg">
          <Plus className="h-5 w-5" /> New Order
        </Button>
      </Link>

      <nav className="mt-2 flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden no-print">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GlassWater className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{businessName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pos">
            <Button variant="accent" size="sm">
              <Plus className="h-4 w-4" /> Order
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
            <MenuIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card/40 p-3 md:block no-print">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card p-3 shadow-xl">
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/budget", label: "Budget" },
  { href: "/recurring", label: "Recurring" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings/categories", label: "Categories" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto text-sm">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              active &&
                "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

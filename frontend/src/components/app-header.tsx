import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { WalletIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

// Later phases add their pages here.
const NAV_LINKS = [{ href: "/dashboard", label: "Dashboard" }] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <WalletIcon className="size-5 text-primary" aria-hidden />
          <span className="hidden sm:inline">AI Expense Tracker</span>
        </Link>
        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}

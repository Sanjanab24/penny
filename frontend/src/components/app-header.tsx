import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { UserRoundIcon, WalletIcon } from "lucide-react";

import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="bg-hero inline-flex size-8 items-center justify-center rounded-lg text-white shadow-sm shadow-primary/30">
            <WalletIcon className="size-4" aria-hidden />
          </span>
          <span className="hidden text-lg tracking-tight sm:inline">Penny</span>
        </Link>
        <NavLinks />
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profile" aria-label="Your profile" title="Your profile">
            <UserRoundIcon className="size-4" />
          </Link>
        </Button>
        <UserButton />
      </div>
    </header>
  );
}

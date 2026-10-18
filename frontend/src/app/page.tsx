import { Suspense } from "react";
import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { WalletIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <WalletIcon className="size-10 text-primary" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI Expense Tracker</h1>
      <p className="max-w-md text-muted-foreground">
        Track expenses, plan a monthly budget, and get AI-powered budget suggestions.
      </p>
      {/* <Show> reads the session at request time, so it streams in behind a boundary. */}
      <Suspense fallback={<Skeleton className="h-9 w-56" />}>
        <AuthActions />
      </Suspense>
    </main>
  );
}

function AuthActions() {
  return (
    <div className="flex gap-3">
      <Show
        when="signed-in"
        fallback={
          <>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline">Create account</Button>
            </SignUpButton>
          </>
        }
      >
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </Show>
    </div>
  );
}

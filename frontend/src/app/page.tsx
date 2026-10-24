import { Suspense } from "react";
import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { ChartPieIcon, RepeatIcon, SparklesIcon, WalletIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const FEATURES = [
  {
    icon: ChartPieIcon,
    title: "See where it goes",
    text: "Category breakdowns, trends and month-by-month savings.",
    tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  {
    icon: RepeatIcon,
    title: "Autopays handled",
    text: "Rent and subscriptions are added on their billing day.",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    icon: SparklesIcon,
    title: "AI budget plans",
    text: "Suggestions from your habits and upcoming plans.",
    tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
];

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <span className="bg-hero inline-flex size-16 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/30">
        <WalletIcon className="size-8" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="bg-hero bg-clip-text text-transparent">Penny</span>
        </h1>
        <p className="text-lg font-medium sm:text-xl">Your AI money buddy</p>
      </div>
      <p className="max-w-md text-muted-foreground">
        Track expenses, plan a monthly budget, and get AI-powered budget suggestions.
      </p>
      {/* <Show> reads the session at request time, so it streams in behind a boundary. */}
      <Suspense fallback={<Skeleton className="h-9 w-56" />}>
        <AuthActions />
      </Suspense>
      <ul className="mt-6 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text, tone }) => (
          <li key={title} className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
            <span
              className={`mb-3 inline-flex size-9 items-center justify-center rounded-lg ${tone}`}
            >
              <Icon className="size-4.5" aria-hidden />
            </span>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
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

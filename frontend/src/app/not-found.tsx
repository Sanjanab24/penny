import Link from "next/link";
import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="bg-hero inline-flex size-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/30">
        <CompassIcon className="size-7" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">This page doesn&apos;t exist or has moved.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to Penny</Link>
      </Button>
    </main>
  );
}

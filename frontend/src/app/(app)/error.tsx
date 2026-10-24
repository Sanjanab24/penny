"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api";

/** Shown in place of a signed-in page that crashed; the header and navigation keep working. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // API errors carry a message written for people; anything else gets a generic one.
  const message =
    error instanceof ApiError
      ? error.message
      : "Something unexpected happened while showing this page.";

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-red-500/12 text-red-600 dark:text-red-300">
          <TriangleAlertIcon className="size-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">This page ran into a problem</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCcwIcon /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

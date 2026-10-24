"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClockIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { daysLeftInMonth, formatMonthName, shiftMonth } from "@/lib/month";
import { useBudget } from "@/lib/queries";

// Shown in the last days of a month, when there's still time to plan the next one.
const REMIND_DAYS_BEFORE_MONTH_END = 10;

const dismissKey = (month: string) => `plan-reminder-dismissed:${month}`;

function readDismissed(month: string) {
  try {
    return localStorage.getItem(dismissKey(month)) === "1";
  } catch {
    return false; // storage blocked (private mode etc.): just show the reminder
  }
}

/** "November has no budget yet" nudge near the end of the month. Dismissed per month. */
export function PlanNextMonthReminder({ today }: { today: string }) {
  const daysLeft = daysLeftInMonth(today);
  const nextMonth = shiftMonth(today.slice(0, 7), 1);
  const inWindow = daysLeft < REMIND_DAYS_BEFORE_MONTH_END;
  const next = useBudget(inWindow ? nextMonth : null);
  const [dismissed, setDismissed] = useState(() => readDismissed(nextMonth));

  const summary = next.data?.month === nextMonth ? next.data : undefined;
  if (!inWindow || dismissed || !summary || summary.has_budget) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(nextMonth), "1");
    } catch {
      // Not remembered across reloads without storage; hiding it for now is enough.
    }
  };

  const name = formatMonthName(nextMonth);
  const ends =
    daysLeft === 0 ? "ends today" : `ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
  return (
    <Card size="sm" className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3">
        <CalendarClockIcon className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium">
            {formatMonthName(today.slice(0, 7))} {ends}.
          </span>{" "}
          {name} doesn&apos;t have a budget yet. Plan it now, with an AI suggestion if you like.
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" asChild>
            <Link href={`/budget?month=${nextMonth}`}>Plan {name}</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Dismiss the ${name} planning reminder`}
            onClick={dismiss}
          >
            <XIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

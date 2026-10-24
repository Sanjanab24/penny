"use client";

import Link from "next/link";
import { PiggyBankIcon, TrendingDownIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { formatMonthName } from "@/lib/month";
import { useSavings } from "@/lib/queries";
import type { SavingsPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "You saved ₹966 in September", plus how this month is tracking. Savings = budget - spent. */
export function SavedLastMonthCard({ current }: { current: string }) {
  const savings = useSavings(current, 1);
  const data = savings.data?.points.at(-1)?.month === current ? savings.data : undefined;

  if (savings.isError) return null; // the rest of the dashboard still works without it
  if (!data) return <Skeleton className="h-24 w-full" />;

  const thisMonth = data.points.at(-1);
  return (
    <Card size="sm">
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <LastMonth point={data.last_month} />
        {thisMonth && <ThisMonth point={thisMonth} />}
      </CardContent>
    </Card>
  );
}

function LastMonth({ point }: { point: SavingsPoint }) {
  const name = formatMonthName(point.month);
  if (point.saved === null) {
    return (
      <div className="flex items-start gap-3">
        <PiggyBankIcon className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm text-muted-foreground">Saved in {name}</p>
          <p className="text-sm">
            No budget was set for {name}, so there&apos;s no savings figure
            {Number(point.spent) > 0 && ` (you spent ${formatMoney(point.spent)})`}.
          </p>
        </div>
      </div>
    );
  }

  const saved = Number(point.saved);
  const overspent = saved < 0;
  const Icon = overspent ? TrendingDownIcon : PiggyBankIcon;
  return (
    <div className="flex items-start gap-3">
      <Icon
        className={cn(
          "mt-0.5 size-6 shrink-0",
          overspent ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">
          {overspent ? `Overspent in ${name}` : `Saved in ${name}`}
        </p>
        <p
          className={cn(
            "text-2xl font-semibold",
            overspent ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {formatMoney(Math.abs(saved))}
        </p>
        <p className="text-xs text-muted-foreground">
          {point.savings_rate !== null &&
            `${Math.abs(Number(point.savings_rate))}% ${overspent ? "over" : "of"} `}
          your {formatMoney(point.budget ?? 0)} budget · spent {formatMoney(point.spent)}
        </p>
      </div>
    </div>
  );
}

function ThisMonth({ point }: { point: SavingsPoint }) {
  const name = formatMonthName(point.month);
  return (
    <div className="border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
      <p className="text-sm text-muted-foreground">{name} so far</p>
      {point.saved === null ? (
        <p className="text-sm">
          <Link
            href={`/budget?month=${point.month}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Set a budget
          </Link>{" "}
          to track savings this month.
        </p>
      ) : Number(point.saved) >= 0 ? (
        <p className="text-sm">
          <span className="text-lg font-semibold">{formatMoney(point.saved)}</span> left of your
          budget, which you&apos;ll save if spending stops here.
        </p>
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          <span className="text-lg font-semibold">
            {formatMoney(Math.abs(Number(point.saved)))}
          </span>{" "}
          over budget already.
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        <Link href="/analytics" className="underline-offset-4 hover:underline">
          See savings over time
        </Link>
      </p>
    </div>
  );
}

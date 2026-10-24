import { WalletIcon } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { formatMonthName } from "@/lib/month";
import type { BudgetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The month's headline numbers on the brand gradient: budget, spent, what's left and a progress
 * bar. Text is white on the indigo -> violet gradient (well above 4.5:1).
 */
export function BudgetOverview({ summary }: { summary: BudgetSummary }) {
  const remaining = Number(summary.remaining);
  const percent = summary.percent_used === null ? null : Number(summary.percent_used);
  const over = remaining < 0;

  return (
    <section
      aria-label={`${formatMonthName(summary.month)} budget overview`}
      className="bg-hero relative overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-primary/25 sm:p-6"
    >
      {/* Soft decorative circles; purely visual. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-24 size-40 rounded-full bg-white/5"
      />

      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/80">
              {formatMonthName(summary.month)} budget
            </p>
            <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatMoney(summary.total_amount)}
            </p>
          </div>
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <WalletIcon className="size-5" aria-hidden />
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
          <HeroStat label="Spent" value={formatMoney(summary.spent_total)} />
          <HeroStat
            label={over ? "Over budget" : "Left to spend"}
            value={formatMoney(Math.abs(remaining))}
            alert={over}
          />
        </dl>

        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="Total budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent ?? 0, 100)}
            aria-valuetext={percent === null ? "No funds budgeted" : `${percent}% used`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-white/20"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                (percent ?? 0) > 100
                  ? "bg-red-300"
                  : (percent ?? 0) >= 90
                    ? "bg-amber-300"
                    : "bg-white",
              )}
              style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/80">
            {percent === null
              ? "No funds budgeted this month"
              : `${percent.toFixed(1)}% of budget used`}
          </p>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
      <dt className="text-xs text-white/75">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", alert && "text-red-200")}>{value}</dd>
    </div>
  );
}

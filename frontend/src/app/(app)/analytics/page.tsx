"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  MinusIcon,
  TrophyIcon,
  WalletIcon,
} from "lucide-react";

import { CategoryDonut } from "@/components/analytics/category-donut";
import { CompareBars } from "@/components/analytics/compare-bars";
import { SavingsChart } from "@/components/analytics/savings-chart";
import { TrendChart } from "@/components/analytics/trend-chart";
import { CategorySwatch } from "@/components/category-icon";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { formatMonth, useCurrentMonth } from "@/lib/month";
import { useMonthComparison, useMonthSummary, useSavings, useTrends } from "@/lib/queries";
import type { MonthComparison, MonthSummary, Savings } from "@/lib/types";
import { cn } from "@/lib/utils";

const TREND_MONTHS = 6;
const TOP_COUNT = 3;

export default function AnalyticsPage() {
  const current = useCurrentMonth();
  const [picked, setPicked] = useState<string>();
  const month = picked ?? current;

  const summary = useMonthSummary(month);
  const trends = useTrends(month, TREND_MONTHS);
  const comparison = useMonthComparison(month);
  const savings = useSavings(month, TREND_MONTHS);
  // Ignore placeholder data from the previously selected month.
  const summaryData = summary.data?.month === month ? summary.data : undefined;
  const comparisonData = comparison.data?.month === month ? comparison.data : undefined;
  const trendData = trends.data?.points.at(-1)?.month === month ? trends.data : undefined;
  const savingsData = savings.data?.points.at(-1)?.month === month ? savings.data : undefined;
  const error = summary.error ?? trends.error ?? comparison.error;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ChartPieIcon}
        title="Analytics"
        description="Where your money goes, month by month."
        actions={
          month && current && <MonthPicker month={month} onChange={setPicked} current={current} />
        }
      />

      {error ? (
        <Card size="sm">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load analytics: {error.message}
          </CardContent>
        </Card>
      ) : !month || !summaryData || !comparisonData ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <StatTiles summary={summaryData} comparison={comparisonData} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>{formatMonth(month)}</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryData.categories.length > 0 ? (
                  <CategoryDonut categories={summaryData.categories} total={summaryData.total} />
                ) : (
                  <Empty>No spending in {formatMonth(month)}.</Empty>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top categories</CardTitle>
                <CardDescription>
                  Where most of {formatMonth(month)}&apos;s money went
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopCategories summary={summaryData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly spending trend</CardTitle>
              <CardDescription>
                Total spent in the {TREND_MONTHS} months up to {formatMonth(month)}
                {trendData && ` · average ${formatMoney(trendData.average)} a month`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendData ? (
                <TrendChart points={trendData.points} />
              ) : (
                <Skeleton className="h-64 w-full" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings</CardTitle>
              <CardDescription>
                Budget minus spending, for the {TREND_MONTHS} months up to {formatMonth(month)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {savingsData ? (
                <>
                  <SavingsTotals savings={savingsData} />
                  {savingsData.points.some((p) => p.budget !== null) ? (
                    <SavingsChart points={savingsData.points} />
                  ) : (
                    <Empty>
                      Set a monthly budget to see how much you save: savings are your budget minus
                      what you spend.
                    </Empty>
                  )}
                </>
              ) : (
                <Skeleton className="h-56 w-full" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Month comparison</CardTitle>
              <CardDescription>
                {formatMonth(comparisonData.month)} vs {formatMonth(comparisonData.previous_month)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparisonData.categories.length > 0 ? (
                <CompareBars comparison={comparisonData} />
              ) : (
                <Empty>No spending in either month yet.</Empty>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Totals over finished months that had a budget; the current month isn't final yet. */
function SavingsTotals({ savings }: { savings: Savings }) {
  if (savings.months_counted === 0) return null;
  const total = Number(savings.total_saved);
  const months = `${savings.months_counted} finished ${savings.months_counted === 1 ? "month" : "months"}`;
  return (
    <dl className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt className="text-muted-foreground">
          {total < 0 ? "Overspent in total" : "Saved in total"}
        </dt>
        <dd className={cn("text-xl font-semibold", total < 0 && "text-red-600 dark:text-red-400")}>
          {formatMoney(Math.abs(total))}
        </dd>
        <dd className="text-xs text-muted-foreground">over {months}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Average a month</dt>
        <dd className="text-xl font-semibold">{formatMoney(savings.average_saved ?? 0)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Savings rate</dt>
        <dd className="text-xl font-semibold">{savings.average_rate ?? "—"}%</dd>
        <dd className="text-xs text-muted-foreground">of your budgets</dd>
      </div>
    </dl>
  );
}

function StatTiles({
  summary,
  comparison,
}: {
  summary: MonthSummary;
  comparison: MonthComparison;
}) {
  const top = summary.categories[0];
  const change = Number(comparison.change);
  const percent = comparison.change_percent;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={WalletIcon}
        tone="rose"
        label="Spent"
        value={formatMoney(summary.total)}
        hint={`${summary.expense_count} ${summary.expense_count === 1 ? "expense" : "expenses"}`}
      />
      {/* Spending going up is bad news: up is red, down is green, always with an arrow + words. */}
      <StatCard
        icon={change > 0 ? ArrowUpIcon : change < 0 ? ArrowDownIcon : MinusIcon}
        tone={change > 0 ? "red" : change < 0 ? "emerald" : "violet"}
        label={`vs ${formatMonth(comparison.previous_month)}`}
        value={formatMoney(Math.abs(change))}
        hint={
          change === 0
            ? "Same as last month"
            : `${change > 0 ? "More" : "Less"} than last month${percent !== null ? ` (${Math.abs(Number(percent))}%)` : ""}`
        }
      />
      <StatCard
        icon={CalendarDaysIcon}
        tone="sky"
        label="Daily average"
        value={formatMoney(summary.daily_average)}
      />
      <StatCard
        icon={TrophyIcon}
        tone="violet"
        label="Top category"
        value={
          top ? (
            <span className="flex items-center gap-2">
              <CategorySwatch icon={top.icon} color={top.color} className="size-5 [&_svg]:size-3" />
              <span className="truncate">{top.name}</span>
            </span>
          ) : (
            "—"
          )
        }
        hint={top ? `${formatMoney(top.amount)} · ${top.percent}% of spending` : undefined}
      />
    </div>
  );
}

function TopCategories({ summary }: { summary: MonthSummary }) {
  const top = summary.categories.slice(0, TOP_COUNT);
  if (top.length === 0) return <Empty>Nothing spent yet.</Empty>;
  const max = Number(top[0].amount);
  return (
    <ol className="space-y-4">
      {top.map((c, index) => (
        <li key={c.category_id} className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-4 text-muted-foreground tabular-nums">{index + 1}</span>
            <CategorySwatch icon={c.icon} color={c.color} className="size-6" />
            <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
            <span className="font-medium tabular-nums">{formatMoney(c.amount)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {c.percent}%
            </span>
          </div>
          {/* Relative to the largest category, so the ranking reads at a glance. */}
          <div className="ml-6 h-2 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(Number(c.amount) / max) * 100}%`, backgroundColor: c.color }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

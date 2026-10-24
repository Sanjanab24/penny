"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  LayoutDashboardIcon,
  PiggyBankIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  TrophyIcon,
} from "lucide-react";

import { BudgetOverview } from "@/components/budget/budget-overview";
import { CategoryUtilization } from "@/components/budget/category-utilization";
import { PlanNextMonthReminder } from "@/components/budget/plan-next-month-reminder";
import { CategorySwatch } from "@/components/category-icon";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/page-header";
import { SavedLastMonthCard } from "@/components/savings/saved-last-month-card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import {
  daysLeftInMonth,
  formatMonth,
  formatMonthName,
  monthRange,
  shiftMonth,
  useCurrentMonth,
  useTodayISO,
} from "@/lib/month";
import { useBudget, useCategories, useExpenses } from "@/lib/queries";
import type { BudgetSummary, Category, Expense } from "@/lib/types";

const RECENT_COUNT = 5;

/**
 * Opens on the current month only. Older months stay in the database and are shown when the
 * user steps back with the month picker.
 */
export default function DashboardPage() {
  const current = useCurrentMonth();
  const [picked, setPicked] = useState<string>();
  const month = picked ?? current;
  const [addOpen, setAddOpen] = useState(false);
  const categories = useCategories();
  const today = useTodayISO();
  const nextMonth = current ? shiftMonth(current, 1) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboardIcon}
        title="Dashboard"
        description={month ? `${formatMonth(month)} at a glance` : "Your month at a glance"}
        actions={
          <>
            {month && current && (
              <MonthPicker month={month} onChange={setPicked} current={current} />
            )}
            {nextMonth && (
              <Button variant="outline" asChild>
                <Link href={`/budget?month=${nextMonth}`}>
                  <CalendarPlusIcon /> Plan {formatMonthName(nextMonth)}
                </Link>
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)} disabled={!categories.data}>
              <PlusIcon /> Add expense
            </Button>
          </>
        }
      />

      {/* Only while looking at this month: the nudge is about what comes after it. */}
      {today && month === current && <PlanNextMonthReminder today={today} />}

      {month && today ? (
        <MonthDashboard
          month={month}
          current={current}
          today={today}
          categories={categories.data}
        />
      ) : (
        <DashboardSkeleton />
      )}

      {categories.data && (
        <ExpenseFormDialog open={addOpen} onOpenChange={setAddOpen} categories={categories.data} />
      )}
    </div>
  );
}

function MonthDashboard({
  month,
  current,
  today,
  categories,
}: {
  month: string;
  current: string | null;
  today: string;
  categories?: Category[];
}) {
  const budget = useBudget(month);
  const summary = budget.data?.month === month ? budget.data : undefined;

  if (budget.isError) {
    return <Message>Couldn&apos;t load this month: {budget.error.message}</Message>;
  }
  if (!summary) return <DashboardSkeleton />;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {summary.has_budget ? (
            <BudgetOverview summary={summary} />
          ) : (
            <NoBudget month={month} summary={summary} />
          )}
        </div>
        <QuickStats summary={summary} month={month} current={current} today={today} />
      </div>

      {current && month === current && <SavedLastMonthCard current={current} />}

      <section aria-labelledby="utilization-heading" className="space-y-3">
        <SectionTitle id="utilization-heading">Category Utilization</SectionTitle>
        {summary.categories.length > 0 ? (
          <CategoryUtilization categories={summary.categories} />
        ) : (
          <Message>
            Nothing budgeted or spent in {formatMonth(month)} yet.{" "}
            <Link
              href={`/budget?month=${month}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Set a budget
            </Link>
          </Message>
        )}
      </section>

      <RecentExpenses month={month} categories={categories} />
    </>
  );
}

/** Three small cards beside the hero: daily pace, recurring commitments, top category. */
function QuickStats({
  summary,
  month,
  current,
  today,
}: {
  summary: BudgetSummary;
  month: string;
  current: string | null;
  today: string;
}) {
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  // Days you can still spend in: the rest of this month (today included), or all of a future one.
  const daysToGo =
    month === current ? daysLeftInMonth(today) + 1 : current && month > current ? daysInMonth : 0;
  const remaining = Number(summary.remaining);
  const top = [...summary.categories].sort((a, b) => Number(b.spent) - Number(a.spent))[0];
  const topSpent = top && Number(top.spent) > 0 ? top : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
      {summary.has_budget && daysToGo > 0 ? (
        <StatCard
          icon={CalendarDaysIcon}
          tone={remaining < 0 ? "red" : "sky"}
          label="Left per day"
          value={remaining < 0 ? "Over budget" : formatMoney(remaining / daysToGo)}
          hint={`${daysToGo} ${daysToGo === 1 ? "day" : "days"} to go`}
        />
      ) : (
        <StatCard
          icon={CalendarDaysIcon}
          tone="sky"
          label="Spent per day"
          value={formatMoney(Number(summary.spent_total) / daysInMonth)}
          hint={`Average over ${daysInMonth} days`}
        />
      )}
      <StatCard
        icon={RepeatIcon}
        tone="amber"
        label="Recurring this month"
        value={formatMoney(summary.recurring_total)}
        hint={
          <Link href="/recurring" className="underline-offset-4 hover:underline">
            Manage recurring
          </Link>
        }
      />
      <StatCard
        icon={TrophyIcon}
        tone="violet"
        label="Top category"
        value={topSpent ? topSpent.name : "—"}
        hint={topSpent ? `${formatMoney(topSpent.spent)} spent` : "Nothing spent yet"}
      />
    </div>
  );
}

function NoBudget({ month, summary }: { month: string; summary: BudgetSummary }) {
  return (
    <Card className="h-full border-2 border-dashed border-primary/30 bg-primary/5 shadow-none ring-0">
      <CardContent className="flex h-full flex-col items-start justify-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-hero inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-primary/25">
            <PiggyBankIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">No budget for {formatMonth(month)}</p>
            <p className="text-sm text-muted-foreground">
              {Number(summary.spent_total) > 0
                ? `You've spent ${formatMoney(summary.spent_total)} this month without a budget.`
                : "Set the funds you have and split them across categories."}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/budget?month=${month}`}>Set budget</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentExpenses({ month, categories }: { month: string; categories?: Category[] }) {
  const { from, to } = monthRange(month);
  const expenses = useExpenses({
    page: 1,
    page_size: RECENT_COUNT,
    sort: "date_desc",
    date_from: from,
    date_to: to,
  });
  const categoryById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );
  const items = expenses.data?.items;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-primary" aria-hidden /> Recent expenses
        </CardTitle>
        <Button variant="link" size="sm" asChild className="h-auto p-0">
          <Link href="/expenses">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {expenses.isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load expenses: {expenses.error.message}
          </p>
        ) : !items || expenses.isPlaceholderData ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No expenses in {formatMonth(month)}.
          </p>
        ) : (
          <ul className="-mx-2 space-y-1">
            {items.map((expense) => (
              <RecentRow
                key={expense.id}
                expense={expense}
                category={categoryById.get(expense.category_id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRow({ expense, category }: { expense: Expense; category?: Category }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60">
      {category && (
        <CategorySwatch icon={category.icon} color={category.color} className="size-9" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {expense.description || category?.name || "Expense"}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(expense.date)}
          {category && expense.description && ` · ${category.name}`}
        </p>
      </div>
      <span className="font-semibold tabular-nums">−{formatMoney(expense.amount)}</span>
    </li>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
      <span aria-hidden className="bg-hero h-5 w-1 rounded-full" />
      {children}
    </h2>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 w-full rounded-2xl lg:col-span-2" />
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

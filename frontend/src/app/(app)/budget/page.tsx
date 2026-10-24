"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarPlusIcon,
  CopyIcon,
  PiggyBankIcon,
  PlusIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AiSuggestionDialog,
  type AppliedSuggestion,
} from "@/components/budget/ai-suggestion-dialog";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategorySwatch } from "@/components/category-icon";
import { MonthPicker } from "@/components/month-picker";
import { fromPaise, MONEY_PATTERN, MoneyInput, toPaise } from "@/components/money-input";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { formatMonth, formatMonthName, isMonth, shiftMonth, useCurrentMonth } from "@/lib/month";
import { useBudget, useCategories, useSaveBudget } from "@/lib/queries";
import type { BudgetSummary, Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || MONEY_PATTERN.test(v), "Enter an amount like 1500 or 249.50");

const schema = z.object({
  total: z
    .string()
    .trim()
    .min(1, "Enter the funds available this month")
    .regex(MONEY_PATTERN, "Enter an amount like 25000 or 24999.50"),
  // Keyed "c<categoryId>": a purely numeric key would make react-hook-form build an array.
  allocations: z.record(z.string(), optionalMoney),
});

type FormValues = z.infer<typeof schema>;

const fieldKey = (categoryId: number) => `c${categoryId}`;

export default function BudgetPage() {
  const current = useCurrentMonth();
  // The month lives in the URL (/budget?month=2026-11) so other pages can link to a plan.
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("month");
  const month = isMonth(param) ? param : current;
  const setMonth = (next: string) =>
    router.replace(next === current ? pathname : `${pathname}?month=${next}`, { scroll: false });

  const categories = useCategories();
  const budget = useBudget(month);
  const previousMonth = month ? shiftMonth(month, -1) : null;
  const previous = useBudget(previousMonth);
  // While another month loads, the previous month's data is kept as a placeholder; wait for it.
  const summary = budget.data?.month === month ? budget.data : undefined;
  const previousSummary =
    previous.data?.month === previousMonth && previous.data.has_budget ? previous.data : undefined;
  const nextMonth = current ? shiftMonth(current, 1) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PiggyBankIcon}
        title="Budget"
        description="Set the funds available for the month and split them across categories."
        actions={
          <>
            {month && current && (
              <MonthPicker month={month} onChange={setMonth} current={current} />
            )}
            {/* Planning ahead: next month gets its own budget while this one is still running. */}
            {month === current && nextMonth && (
              <Button variant="outline" size="sm" onClick={() => setMonth(nextMonth)}>
                <CalendarPlusIcon /> Plan {formatMonthName(nextMonth)}
              </Button>
            )}
          </>
        }
      />

      {budget.isError || categories.isError ? (
        <Card size="sm">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load the budget: {(budget.error ?? categories.error)?.message}
          </CardContent>
        </Card>
      ) : !month || !summary || !categories.data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        // Keyed by month so switching months starts from that month's saved values.
        <BudgetForm
          key={month}
          month={month}
          summary={summary}
          previous={previousSummary}
          categories={categories.data}
        />
      )}
    </div>
  );
}

function BudgetForm({
  month,
  summary,
  previous,
  categories,
}: {
  month: string;
  summary: BudgetSummary;
  /** The month before's saved budget, offered as a starting point. */
  previous?: BudgetSummary;
  categories: Category[];
}) {
  const save = useSaveBudget();
  const [aiOpen, setAiOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const usageById = new Map(summary.categories.map((u) => [u.category_id, u]));

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      total: summary.has_budget ? summary.total_amount : "",
      allocations: Object.fromEntries(
        categories.map((c) => {
          const allocated = usageById.get(c.id)?.allocated;
          return [fieldKey(c.id), allocated && Number(allocated) > 0 ? allocated : ""];
        }),
      ),
    },
  });

  // Live totals in paise so the cap check is exact.
  const values = useWatch({ control });
  const totalPaise = toPaise(values.total);
  const allocatedPaise = Object.values(values.allocations ?? {}).reduce(
    (sum, v) => sum + toPaise(v),
    0,
  );
  const overBy = allocatedPaise - totalPaise;
  const recurringTotal = Number(summary.recurring_total);

  /** Recurring payments are counted first: lift each category to at least what they need. */
  const coverRecurring = () => {
    for (const usage of summary.categories) {
      const key = fieldKey(usage.category_id);
      const needed = toPaise(usage.recurring);
      if (needed > toPaise(values.allocations?.[key])) {
        setValue(`allocations.${key}`, fromPaise(needed), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  };
  const recurringUncovered = summary.categories.some(
    (u) => toPaise(u.recurring) > toPaise(values.allocations?.[fieldKey(u.category_id)]),
  );

  /** Puts a reviewed suggestion into the form. It is saved only when the user clicks Save. */
  const applySuggestion = ({ total, allocations }: AppliedSuggestion) => {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    setValue("total", total, options);
    for (const category of categories) {
      const amount = allocations[category.id];
      setValue(
        `allocations.${fieldKey(category.id)}`,
        amount && toPaise(amount) > 0 ? amount : "",
        options,
      );
    }
    toast.success("Suggestion applied. Review it, then save your budget.");
  };

  /** Fills the form with the previous month's saved budget. Saved only when the user clicks Save. */
  const copyPrevious = () => {
    if (!previous) return;
    const options = { shouldDirty: true, shouldValidate: true } as const;
    const allocated = new Map(previous.categories.map((u) => [u.category_id, u.allocated]));
    setValue("total", previous.total_amount, options);
    for (const category of categories) {
      const amount = allocated.get(category.id);
      setValue(
        `allocations.${fieldKey(category.id)}`,
        amount && toPaise(amount) > 0 ? amount : "",
        options,
      );
    }
    toast.success(`Copied ${formatMonthName(previous.month)}'s budget. Review it, then save.`);
  };

  const onSubmit = (form: FormValues) => {
    if (overBy > 0) return;
    save.mutate(
      {
        month,
        input: {
          total_amount: form.total,
          allocations: categories
            .map((c) => ({ category_id: c.id, amount: form.allocations[fieldKey(c.id)] ?? "" }))
            .filter((a) => toPaise(a.amount) > 0),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Budget saved for ${formatMonth(month)}`);
          // The saved values become the new baseline for "unsaved changes".
          reset(undefined, { keepValues: true });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      {/* Outside the form: React events bubble through portals, so a submit inside the dialog
          would otherwise also submit (and save) the budget form. */}
      <AiSuggestionDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        month={month}
        initialFunds={values.total ?? ""}
        categories={categories}
        onApply={applySuggestion}
      />
      <CategoryFormDialog
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        // It appears in the list once the categories refresh; focus its amount field then.
        onSaved={(category) =>
          setTimeout(() => document.getElementById(fieldKey(category.id))?.focus(), 400)
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Total budget</CardTitle>
              <div className="flex flex-wrap gap-2">
                {previous && (
                  <Button type="button" variant="outline" size="sm" onClick={copyPrevious}>
                    <CopyIcon /> Copy {formatMonthName(previous.month)}&apos;s budget
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setAiOpen(true)}>
                  <SparklesIcon /> Get AI suggestion
                </Button>
              </div>
            </div>
            <CardDescription>
              Funds available for {formatMonth(month)}.{" "}
              {Number(summary.spent_total) > 0 &&
                `You've spent ${formatMoney(summary.spent_total)} so far.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-xs space-y-1.5">
            <Label htmlFor="total" className="sr-only">
              Total budget
            </Label>
            <MoneyInput
              id="total"
              className="text-base"
              aria-invalid={!!errors.total}
              aria-describedby={errors.total ? "total-error" : undefined}
              {...register("total")}
            />
            {errors.total && (
              <p id="total-error" className="text-xs text-destructive">
                {errors.total.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Category allocations</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatingCategory(true)}
              >
                <PlusIcon /> New category
              </Button>
            </div>
            <CardDescription>
              Leave a category empty to give it no budget. Allocations can&apos;t add up to more
              than the total.
            </CardDescription>
            {recurringTotal > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span>
                  Recurring payments take <strong>{formatMoney(summary.recurring_total)}</strong>{" "}
                  every month and are counted first.
                </span>
                {recurringUncovered && (
                  <Button type="button" variant="outline" size="sm" onClick={coverRecurring}>
                    Cover recurring payments
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {categories.map((category) => {
                const key = fieldKey(category.id);
                const error = errors.allocations?.[key]?.message;
                const usage = usageById.get(category.id);
                const spent = usage?.spent;
                const recurringPaise = toPaise(usage?.recurring);
                const short = recurringPaise > toPaise(values.allocations?.[key]);
                return (
                  <li
                    key={category.id}
                    className="grid grid-cols-[1fr_9rem] items-center gap-3 py-2.5 sm:grid-cols-[1fr_auto_11rem]"
                  >
                    <Label htmlFor={key} className="flex min-w-0 items-center gap-2 font-medium">
                      <CategorySwatch icon={category.icon} color={category.color} />
                      <span className="truncate">{category.name}</span>
                    </Label>
                    <span className="hidden text-right text-xs text-muted-foreground tabular-nums sm:block">
                      {[
                        spent && Number(spent) > 0 && `Spent ${formatMoney(spent)}`,
                        recurringPaise > 0 && `Recurring ${formatMoney(fromPaise(recurringPaise))}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <div className="space-y-1">
                      <MoneyInput
                        id={key}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${key}-error` : undefined}
                        {...register(`allocations.${key}`)}
                      />
                      {error ? (
                        <p id={`${key}-error`} className="text-xs text-destructive">
                          {error}
                        </p>
                      ) : (
                        short && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Below its {formatMoney(fromPaise(recurringPaise))} recurring
                          </p>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Sticky so the running total stays visible while editing a long category list. */}
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm tabular-nums" aria-live="polite">
              Allocated <strong>{formatMoney(fromPaise(allocatedPaise))}</strong> of{" "}
              {formatMoney(fromPaise(totalPaise))}
              {" · "}
              <span
                className={cn(
                  overBy > 0
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "text-muted-foreground",
                )}
              >
                {overBy > 0
                  ? `Over the total by ${formatMoney(fromPaise(overBy))}`
                  : `${formatMoney(fromPaise(-overBy))} unallocated`}
              </span>
            </p>
            <div className="flex items-center gap-2">
              {isDirty && (
                // Back to the last saved plan (or the empty form), e.g. after trying a suggestion.
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reset()}
                  disabled={save.isPending}
                >
                  <Undo2Icon /> {summary.has_budget ? "Discard changes" : "Clear"}
                </Button>
              )}
              <Button
                type="submit"
                disabled={overBy > 0 || save.isPending || (!isDirty && summary.has_budget)}
              >
                {save.isPending ? "Saving…" : summary.has_budget ? "Save changes" : "Save budget"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
